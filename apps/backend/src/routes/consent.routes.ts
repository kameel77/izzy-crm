import { ConsentMethod } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import {
  listConsentTemplates,
  recordConsentBatch,
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
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      accessCodeHash: body.accessCodeHash,
      consents: normalizedConsents,
    });

    res.status(201).json(result);
  }),
);

export { router as consentRouter };
