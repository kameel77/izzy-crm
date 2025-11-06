import { LeadStatus, UserRole } from "@prisma/client";
import type { Express } from "express";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import {
  addLeadDocument,
  assignLeadOwner,
  createLead,
  createLeadNote,
  deleteLeadNote,
  findLeadNoteAttachment,
  getLeadById,
  listLeads,
  transitionLeadStatus,
  upsertFinancingApplication,
} from "../services/lead.service.js";
import {
  upload,
  saveUploadedFile,
  deleteStoredFile,
  getStoredFileStream,
} from "../utils/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const PARTNER_SCOPED_ROLES: UserRole[] = [
  UserRole.PARTNER,
  UserRole.PARTNER_MANAGER,
  UserRole.PARTNER_EMPLOYEE,
];

const isPartnerScopedRole = (role?: UserRole | null): role is UserRole =>
  Boolean(role && PARTNER_SCOPED_ROLES.includes(role));

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

const uploadDocumentBodySchema = z.object({
  type: z.string().min(1).optional(),
  checksum: z.string().optional(),
});

const createNoteBodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const noteParamsSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
});

const noteAttachmentParamsSchema = noteParamsSchema.extend({
  attachmentId: z.string().min(1),
});


const assignmentSchema = z.object({
  userId: z.union([z.string().cuid(), z.literal("")]).optional(),
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

    if (isPartnerScopedRole(req.user?.role)) {
      if (!req.user.partnerId) {
        return res.status(403).json({ message: "Partner context is missing" });
      }

      if (partnerFilter && partnerFilter !== req.user.partnerId) {
        return res
          .status(403)
          .json({ message: "Cannot view leads for other partners" });
      }

      partnerFilter = req.user.partnerId;
    } else if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      if (partnerFilter && partnerFilter !== req.user.partnerId) {
        return res
          .status(403)
          .json({ message: "Cannot view leads for other partners" });
      }

      partnerFilter = req.user.partnerId;
    }

    let assignedFilter: string | null | undefined = undefined;
    if (query.assigned === "unassigned") {
      assignedFilter = null;
    } else if (query.assignedUserId) {
      assignedFilter = query.assignedUserId;
    }

    const limitToCreator =
      req.user?.role === UserRole.PARTNER_EMPLOYEE ? req.user.id : undefined;

    const { items, total } = await listLeads({
      status: query.status,
      partnerId: partnerFilter,
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

    if (isPartnerScopedRole(req.user?.role)) {
      if (!req.user.partnerId || lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        req.user.role === UserRole.PARTNER_EMPLOYEE &&
        lead.createdByUserId !== req.user.id
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    return res.json(lead);
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

    if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
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

    if (body.unassign && body.status !== LeadStatus.NEW_LEAD) {
      return res
        .status(400)
        .json({ message: "Unassign is only allowed when returning to NEW_LEAD" });
    }

    if (assignToUserId && body.unassign) {
      return res.status(400).json({ message: "Cannot assign and unassign simultaneously" });
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
  "/:id/notes",
  authorize(
    UserRole.PARTNER,
    UserRole.PARTNER_MANAGER,
    UserRole.PARTNER_EMPLOYEE,
    UserRole.OPERATOR,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  ),
  upload.array("attachments", 5),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const body = createNoteBodySchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (isPartnerScopedRole(req.user.role)) {
      if (!req.user.partnerId || lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        req.user.role === UserRole.PARTNER_EMPLOYEE &&
        lead.createdByUserId !== req.user.id
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (req.user.role === UserRole.OPERATOR && req.user.partnerId) {
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const uploadedFiles = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : [];

    const storedFiles: Array<Awaited<ReturnType<typeof saveUploadedFile>>> = [];

    try {
      for (const file of uploadedFiles) {
        storedFiles.push(
          await saveUploadedFile({ leadId: id, file, category: "notes" }),
        );
      }

      const note = await createLeadNote({
        leadId: id,
        authorId: req.user.id,
        content: body.content,
        attachments: storedFiles.map((stored) => ({
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          publicUrl: stored.filePath,
        })),
      });

      return res.status(201).json(note);
    } catch (error) {
      await Promise.allSettled(
        storedFiles.map((stored) =>
          deleteStoredFile({
            storageProvider: stored.storageProvider,
            storageKey: stored.storageKey,
          }),
        ),
      );
      throw error;
    }
  }),
);

router.delete(
  "/:id/notes/:noteId",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const params = noteParamsSchema.parse(req.params);

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const lead = await getLeadById(params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (req.user.role === UserRole.OPERATOR && req.user.partnerId) {
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    await deleteLeadNote({
      leadId: params.id,
      noteId: params.noteId,
      actorUserId: req.user.id,
    });

    return res.status(204).send();
  }),
);

router.get(
  "/:id/notes/:noteId/attachments/:attachmentId/download",
  authorize(
    UserRole.PARTNER,
    UserRole.PARTNER_MANAGER,
    UserRole.PARTNER_EMPLOYEE,
    UserRole.OPERATOR,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  ),
  asyncHandler(async (req, res) => {
    const params = noteAttachmentParamsSchema.parse(req.params);

    const attachment = await findLeadNoteAttachment(
      params.id,
      params.noteId,
      params.attachmentId,
    );

    if (!attachment || !attachment.note) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const leadMeta = attachment.note.lead;

    if (isPartnerScopedRole(req.user?.role)) {
      if (!req.user?.partnerId || leadMeta?.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        req.user.role === UserRole.PARTNER_EMPLOYEE &&
        leadMeta?.createdByUserId !== req.user.id
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      if (leadMeta?.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const stream = await getStoredFileStream({
      storageProvider: attachment.storageProvider,
      storageKey: attachment.storageKey,
    });

    const safeName = (attachment.originalName || "attachment").replace(/"/g, "'");

    res.setHeader("Content-Type", attachment.mimeType ?? "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(
        attachment.originalName || "attachment",
      )}`,
    );
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");

    await new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      res.on("error", reject);
      res.on("finish", resolve);
      res.on("close", resolve);
      stream.pipe(res);
    });
  }),
);

router.post(
  "/:id/financing",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);
    const payload = financingSchema.parse(req.body);

    if (req.user?.role === UserRole.OPERATOR && req.user.partnerId) {
      const lead = await getLeadById(id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      if (lead.partnerId !== req.user.partnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
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

    const stored = await saveUploadedFile({
      leadId: id,
      file: req.file,
      category: "documents",
    });

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

export { router as leadRouter };
