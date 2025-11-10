import { ConsentMethod, ConsentType, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  createConsentTemplate,
  deleteConsentTemplate,
  listConsentTemplates,
  listConsentRecords,
  recordConsentBatch,
  updateConsentTemplate,
  exportConsentRecords,
} from "../services/consent.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
};

const listQuerySchema = z.object({
  form_type: z.string().trim().min(1).optional(),
  include_inactive: z.union([z.string(), z.boolean()]).optional(),
  applicationFormId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
});

const consentRecordListQuerySchema = z.object({
  leadId: z.string().cuid().optional(),
  consentType: z.nativeEnum(ConsentType).optional(),
  consentMethod: z.nativeEnum(ConsentMethod).optional(),
  consentGiven: z.union([z.string(), z.boolean()]).optional(),
  recordedByUserId: z.string().cuid().optional(),
  partnerId: z.string().cuid().optional(),
  recordedAtStart: z.coerce.date().optional(),
  recordedAtEnd: z.coerce.date().optional(),
  withdrawnAtStart: z.coerce.date().optional(),
  withdrawnAtEnd: z.coerce.date().optional(),
  clientSearch: z.string().trim().min(1).optional(), // New: for searching client name, email, phone
  sortBy: z.enum(["recordedAt", "consentType", "clientName"]).default("recordedAt"), // New: sorting
  sortOrder: z.enum(["asc", "desc"]).default("desc"), // New: sorting order
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

const consentRecordSchema = z.object({
  applicationFormId: z.string().cuid(),
  leadId: z.string().cuid(),
  accessCodeHash: z.string().min(8),
  ipAddress: z.string().max(128).optional(),
  userAgent: z.string().max(512).optional(),
  consents: z
    .array(
      z.object({
        consentTemplateId: z.string().cuid(),
        version: z.number().int().positive(),
        consentGiven: z.boolean(),
        consentMethod: z
          .enum(["online_form", "phone_call", "partner_submission"])
          .optional(),
        consentText: z.string().min(1).max(20000).optional(),
        acceptedAt: z.coerce.date().optional(),
      }),
    )
    .min(1),
});

const templateCreateSchema = z.object({
  consentType: z.nativeEnum(ConsentType),
  formType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  helpText: z.string().trim().optional(),
  version: z.number().int().positive(),
  isActive: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const templateUpdateSchema = templateCreateSchema.partial();

const consentMethodMap: Record<
  "online_form" | "phone_call" | "partner_submission",
  ConsentMethod
> = {
  online_form: ConsentMethod.ONLINE_FORM,
  phone_call: ConsentMethod.PHONE_CALL,
  partner_submission: ConsentMethod.PARTNER_SUBMISSION,
};

router.get(
  "/consent-templates",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const includeInactive = parseBoolean(query.include_inactive) ?? false;
    const templates = await listConsentTemplates({
      formType: query.form_type ?? undefined,
      applicationFormId: query.applicationFormId,
      leadId: query.leadId,
      includeInactive,
    });

    res.json({ data: templates });
  }),
);

router.post(
  "/consent-templates",
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const payload = templateCreateSchema.parse(req.body);
    const template = await createConsentTemplate({
      ...payload,
      createdByUserId: req.user!.id,
    });
    res.status(201).json(template);
  }),
);

router.put(
  "/consent-templates/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
    const payload = templateUpdateSchema.parse(req.body);
    const template = await updateConsentTemplate(id, payload);
    res.json(template);
  }),
);

router.delete(
  "/consent-templates/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
    await deleteConsentTemplate(id);
    res.status(204).send();
  }),
);

router.get(
  "/consent-records",
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR),
  asyncHandler(async (req, res) => {
    const query = consentRecordListQuerySchema.parse(req.query);
    const { consentGiven, ...rest } = query;
    const records = await listConsentRecords({
      ...rest,
      consentGiven: parseBoolean(consentGiven),
    });
    res.json({ data: records.records, count: records.count });
  }),
);

router.get(
  "/consent-records/export",
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const query = consentRecordListQuerySchema.parse(req.query);
    const { consentGiven, sortBy, sortOrder, ...rest } = query;
    const format = z.enum(["csv", "json"]).parse(req.query.format ?? "csv");

    const { data, filename } = await exportConsentRecords({
      ...rest,
      consentGiven: parseBoolean(consentGiven),
      sortBy,
      sortOrder,
      // No skip/take for export
    }, format);

    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(data);
  }),
);

router.post(
  "/consent-records",
  asyncHandler(async (req, res) => {
    const body = consentRecordSchema.parse(req.body);

    const normalizedConsents = body.consents.map((consent) => ({
      ...consent,
      consentMethod: consent.consentMethod
        ? consentMethodMap[consent.consentMethod]
        : undefined,
    }));

    const result = await recordConsentBatch({
      applicationFormId: body.applicationFormId,
      leadId: body.leadId,
      ipAddress: req.ip, // Capture IP from the request for security
      userAgent: body.userAgent,
      accessCodeHash: body.accessCodeHash,
      consents: normalizedConsents,
    });

    res.status(201).json(result);
  }),
);

export { router as consentRouter };
