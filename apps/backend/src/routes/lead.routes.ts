import { LeadStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import {
  ensureOperatorCanMutateLead,
  generateApplicationFormLink,
} from "../services/application-form.service.js";
import {
  addLeadDocument,
  addLeadNote,
  assignLeadOwner,
  createLead,
  getLeadById,
  listLeads,
  transitionLeadStatus,
  upsertFinancingApplication,
  updateLeadVehicles,
  anonymizeLead,
} from "../services/lead.service.js";
import { upload, saveUploadedFile } from "../utils/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const PARTNER_SCOPED_ROLES: UserRole[] = [
  UserRole.PARTNER,
  UserRole.PARTNER_MANAGER,
  UserRole.PARTNER_EMPLOYEE,
];

const isPartnerScopedRole = (role?: UserRole | null) =>
  Boolean(role && PARTNER_SCOPED_ROLES.includes(role));

const isOperatorAssignedToLead = (
  user: { role?: UserRole | null; id?: string | null } | undefined,
  lead: { assignedUser?: { id: string | null } | null },
) =>
  user?.role === UserRole.OPERATOR &&
  Boolean(lead.assignedUser?.id && lead.assignedUser.id === user.id);

const canAccessLead = (
  lead: { partnerId: string; createdByUserId?: string | null; assignedUser?: { id: string | null } | null },
  user: { role?: UserRole | null; partnerId?: string | null; id?: string | null } | undefined,
) => {
  const operatorAssigned = isOperatorAssignedToLead(user, lead);

  if (user && isPartnerScopedRole(user.role)) {
    const partnerId = typeof user.partnerId === "string" ? user.partnerId : null;

    if (!partnerId || lead.partnerId !== partnerId) {
      return false;
    }

    if (user.role === UserRole.PARTNER_EMPLOYEE && lead.createdByUserId !== user.id) {
      return false;
    }

    return true;
  }

  if (user && user.role === UserRole.OPERATOR) {
    const partnerId = typeof user.partnerId === "string" ? user.partnerId : null;

    if (partnerId) {
      if (lead.partnerId !== partnerId && !operatorAssigned) {
        return false;
      }
    } else if (!operatorAssigned) {
      return false;
    }
  }

  return true;
};

const createLeadSchema = z.object({
  partnerId: z.string().min(1).optional(),
  sourceMetadata: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
  }),
  currentVehicle: z
    .object({
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
      mileage: z.number().int().min(0).optional(),
      ownershipStatus: z.string().optional(),
    })
    .optional(),
  desiredVehicle: z
    .object({
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
      budget: z.number().min(0).optional(),
      preferences: z.record(z.unknown()).optional(),
    })
    .optional(),
  financing: z
    .object({
      bank: z.string().optional(),
      loanAmount: z.number().min(0).optional(),
      downPayment: z.number().min(0).optional(),
      termMonths: z.number().int().positive().optional(),
      income: z.number().min(0).optional(),
      expenses: z.number().min(0).optional(),
    })
    .optional(),
  consents: z
    .array(
      z.object({
        templateId: z.string(),
        version: z.number(),
        given: z.boolean(),
      }),
    )
    .optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z
    .preprocess((value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        return value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return value;
    }, z.array(z.nativeEnum(LeadStatus)).optional()),
  partnerId: z.string().optional(),
  assignedUserId: z.string().optional(),
  assigned: z.enum(["unassigned"]).optional(),
  search: z.string().optional(),
});

const leadIdParamSchema = z.object({
  id: z.string().min(1),
});

const transitionSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  notes: z.string().max(2000).optional(),
  assignToUserId: z.string().optional(),
  unassign: z.boolean().optional(),
  lastContactAt: z.coerce.date().optional(),
  nextActionAt: z.coerce.date().optional(),
});

const financingSchema = z.object({
  applicationId: z.string().optional(),
  bank: z.string().min(1),
  loanAmount: z.number().min(0).optional(),
  downPayment: z.number().min(0).optional(),
  termMonths: z.number().int().positive().optional(),
  income: z.number().min(0).optional(),
  expenses: z.number().min(0).optional(),
  decision: z.string().optional(),
});

const documentSchema = z.object({
  type: z.string().min(1),
  filePath: z.string().min(1),
  checksum: z.string().optional(),
});

const leadNoteSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  link: z
    .preprocess((value) => {
      if (typeof value === "string" && value.trim().length === 0) {
        return undefined;
      }
      return value;
    }, z.string().trim().url().max(2048))
    .optional(),
});

const uploadDocumentBodySchema = z.object({
  type: z.string().min(1).optional(),
  checksum: z.string().optional(),
});

const createApplicationFormSchema = z.object({
  accessCode: z.string().trim().min(4).max(32),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});


const assignmentSchema = z.object({
  userId: z.union([z.string().cuid(), z.literal("")]).optional(),
});

const vehicleCurrentUpdateSchema = z
  .object({
    make: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    mileage: z.number().int().min(0).optional(),
    ownershipStatus: z.string().max(100).optional(),
  })
  .partial();

const desiredVehicleUpdateSchema = z
  .object({
    make: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    budget: z.number().min(0).nullable().optional(),
    notes: z.string().max(500).optional(),
  })
  .partial();

const vehicleUpdateSchema = z.object({
  current: vehicleCurrentUpdateSchema.nullable().optional(),
  desired: desiredVehicleUpdateSchema.nullable().optional(),
  amountAvailable: z.number().min(0).nullable().optional(),
});

router.post(
  "/",
  authorize(
    UserRole.PARTNER,
    UserRole.PARTNER_MANAGER,
    UserRole.PARTNER_EMPLOYEE,
    UserRole.OPERATOR,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  ),
  asyncHandler(async (req, res) => {
    const payload = createLeadSchema.parse(req.body);

    const partnerIdFromToken = req.user?.partnerId;

    const partnerId =
      isPartnerScopedRole(req.user?.role) ? partnerIdFromToken : payload.partnerId;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    if (
      isPartnerScopedRole(req.user?.role) &&
      payload.partnerId &&
      payload.partnerId !== partnerId
    ) {
      return res.status(403).json({ message: "Cannot create leads for other partners" });
    }

    const lead = await createLead({
      ...payload,
      partnerId,
      createdByUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(201).json({
      id: lead.id,
      status: lead.status,
      partnerId: lead.partnerId,
      leadCreatedAt: lead.leadCreatedAt,
    });
  }),
);

router.get(
  "/",
  authorize(
    UserRole.PARTNER,
    UserRole.PARTNER_MANAGER,
    UserRole.PARTNER_EMPLOYEE,
    UserRole.OPERATOR,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  ),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    let partnerFilter = query.partnerId;
    let scopedPartnerId: string | undefined;
    let includeAssignedUserId: string | undefined;
    let includeAssignedOnly = false;

    if (req.user && isPartnerScopedRole(req.user.role)) {
      if (!req.user.partnerId) {
        return res.status(403).json({ message: "Partner context is missing" });
      }

      if (partnerFilter && partnerFilter !== req.user.partnerId) {
        return res
          .status(403)
          .json({ message: "Cannot view leads for other partners" });
      }

      partnerFilter = req.user.partnerId;
      scopedPartnerId = req.user.partnerId;
    } else if (req.user?.role === UserRole.OPERATOR) {
      includeAssignedUserId = req.user.id;

      if (req.user.partnerId) {
        if (partnerFilter && partnerFilter !== req.user.partnerId) {
          return res
            .status(403)
            .json({ message: "Cannot view leads for other partners" });
        }

        scopedPartnerId = req.user.partnerId;
        partnerFilter = partnerFilter ?? undefined;
      } else {
        partnerFilter = partnerFilter ?? undefined;
      }
    }

    let assignedFilter: string | null | undefined = undefined;
    if (query.assigned === "unassigned") {
      assignedFilter = null;
    } else if (query.assignedUserId) {
      assignedFilter = query.assignedUserId;
    }

    let limitToCreator: string | undefined;
    if (req.user?.role === UserRole.PARTNER_EMPLOYEE) {
      limitToCreator = req.user.id;
      includeAssignedOnly = true;
    }

    const { items, total } = await listLeads({
      status: query.status,
      partnerId: partnerFilter,
      scopedPartnerId,
      includeAssignedUserId,
      includeAssignedOnly,
      assignedUserId: assignedFilter,
      createdByUserId: limitToCreator,
      search: query.search,
      skip,
      take: perPage,
    });

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return res.json({
      data: items,
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    });
  }),
);

router.get(
  "/:id",
  authorize(
    UserRole.PARTNER,
    UserRole.PARTNER_MANAGER,
    UserRole.PARTNER_EMPLOYEE,
    UserRole.OPERATOR,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  ),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccessLead(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { leadNotes, ...leadRest } = lead;

    return res.json({
      ...leadRest,
      notes: leadNotes,
    });
  }),
);

router.post(
  "/:id/notes",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const body = leadNoteSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user?.role === UserRole.OPERATOR) {
      await ensureOperatorCanMutateLead({
        leadId: id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
      });
    }

    const note = await addLeadNote({
      leadId: id,
      userId: req.user.id,
      content: body.content.trim(),
      link: body.link,
    });

    return res.status(201).json(note);
  }),
);

router.patch(
  "/:id/vehicles",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const body = vehicleUpdateSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccessLead(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user?.role === UserRole.OPERATOR) {
      await ensureOperatorCanMutateLead({
        leadId: id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
      });
    }

    const currentInput =
      typeof body.current === "object" && body.current !== null
        ? {
            make: body.current.make?.trim() || undefined,
            model: body.current.model?.trim() || undefined,
            year: body.current.year,
            mileage: body.current.mileage,
            ownershipStatus: body.current.ownershipStatus?.trim() || undefined,
          }
        : body.current;

    const desiredInput =
      typeof body.desired === "object" && body.desired !== null
        ? {
            make: body.desired.make?.trim() || undefined,
            model: body.desired.model?.trim() || undefined,
            year: body.desired.year,
            budget:
              typeof body.desired.budget === "number" || body.desired.budget === null
                ? body.desired.budget
                : undefined,
            preferences:
              typeof body.desired.notes === "string"
                ? body.desired.notes.trim().length
                  ? { notes: body.desired.notes.trim() }
                  : null
                : undefined,
          }
        : body.desired;
    const amountAvailableInput =
      typeof body.amountAvailable === "number" || body.amountAvailable === null
        ? body.amountAvailable
        : undefined;

    const updatedVehicles = await updateLeadVehicles({
      leadId: id,
      userId: req.user.id,
      current: typeof body.current === "undefined" ? undefined : currentInput,
      desired: typeof body.desired === "undefined" ? undefined : desiredInput,
      amountAvailable: amountAvailableInput,
    });

    return res.json(updatedVehicles);
  }),
);

router.patch(
  "/:id/assignment",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const { userId } = assignmentSchema.parse(req.body ?? {});
    const assignTo = typeof userId === "string" && userId.length > 0 ? userId : null;

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const updated = await assignLeadOwner({
      leadId: id,
      assignToUserId: assignTo,
      actorUserId: req.user.id,
    });

    return res.json(updated);
  }),
);

router.post(
  "/:id/status",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const body = transitionSchema.parse(req.body);

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccessLead(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    let assignToUserId: string | null | undefined = undefined;
    if (body.unassign) {
      assignToUserId = null;
    } else if (body.assignToUserId) {
      assignToUserId = body.assignToUserId;
    }

    if (
      req.user?.role === UserRole.OPERATOR &&
      assignToUserId &&
      assignToUserId !== req.user.id
    ) {
      return res.status(403).json({ message: "Cannot assign lead to another user" });
    }

    if (req.user?.role === UserRole.OPERATOR && body.unassign) {
      return res.status(403).json({ message: "Cannot unassign lead" });
    }

    if (body.unassign && body.status !== LeadStatus.NEW) {
      return res
        .status(400)
        .json({ message: "Unassign is only allowed when returning to NEW" });
    }

    if (assignToUserId && body.unassign) {
      return res.status(400).json({ message: "Cannot assign and unassign simultaneously" });
    }

    if (req.user?.role === UserRole.OPERATOR) {
      await ensureOperatorCanMutateLead({
        leadId: id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
      });
    }

    const result = await transitionLeadStatus({
      leadId: id,
      targetStatus: body.status,
      userId: req.user!.id,
      notes: body.notes,
      assignToUserId,
      lastContactAt: body.lastContactAt,
      nextActionAt: body.nextActionAt,
    });

    return res.json(result);
  }),
);

router.post(
  "/:id/financing",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const payload = financingSchema.parse(req.body);

    const lead = await getLeadById(id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (!canAccessLead(lead, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user?.role === UserRole.OPERATOR) {
      await ensureOperatorCanMutateLead({
        leadId: id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
      });
    }

    const application = await upsertFinancingApplication({
      leadId: id,
      applicationId: payload.applicationId,
      bank: payload.bank,
      loanAmount: payload.loanAmount,
      downPayment: payload.downPayment,
      termMonths: payload.termMonths,
      income: payload.income,
      expenses: payload.expenses,
      decision: payload.decision,
      userId: req.user!.id,
    });

    res.status(payload.applicationId ? 200 : 201).json(application);
  }),
);

router.post(
  "/:id/documents",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const payload = documentSchema.parse(req.body);

    if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      const lead = await getLeadById(id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (req.user?.role === UserRole.OPERATOR) {
      await ensureOperatorCanMutateLead({
        leadId: id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
      });
    }

    const document = await addLeadDocument({
      leadId: id,
      userId: req.user!.id,
      type: payload.type,
      filePath: payload.filePath,
      checksum: payload.checksum,
    });

    res.status(201).json(document);
  }),
);

router.post(
  "/:id/documents/upload",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);

    const body = uploadDocumentBodySchema.parse(req.body ?? {});
    const type = body.type ?? "document";

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (req.user?.role === UserRole.OPERATOR) {
      await ensureOperatorCanMutateLead({
        leadId: id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
      });
    }

    const stored = await saveUploadedFile({ leadId: id, file: req.file });

    const document = await addLeadDocument({
      leadId: id,
      userId: req.user!.id,
      type,
      filePath: stored.filePath,
      checksum: body.checksum,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      size: stored.size,
      storageProvider: stored.storageProvider,
      storageKey: stored.storageKey,
    });

    res.status(201).json(document);
  }),
);

router.post(
  "/:id/application-form",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const body = createApplicationFormSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await generateApplicationFormLink({
      leadId: id,
      actorUserId: req.user.id,
      accessCode: body.accessCode,
      expiresInDays: body.expiresInDays,
    });

    return res.status(201).json(result);
  }),
);

router.post(
  "/:id/anonymize",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const actorUserId = req.user!.id;

    await anonymizeLead({ leadId: id, actorUserId });

    res.status(200).json({ message: "Lead anonymized successfully" });
  }),
);

export { router as leadRouter };
