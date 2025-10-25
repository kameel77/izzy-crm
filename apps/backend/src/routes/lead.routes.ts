import { LeadStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import {
  addLeadDocument,
  createLead,
  getLeadById,
  listLeads,
  transitionLeadStatus,
  upsertFinancingApplication,
} from "../services/lead.service.js";
import { upload, getPublicPath } from "../utils/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

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

router.post(
  "/",
  authorize(UserRole.PARTNER, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createLeadSchema.parse(req.body);

    const partnerIdFromToken = req.user?.partnerId;

    const partnerId =
      req.user?.role === UserRole.PARTNER ? partnerIdFromToken : payload.partnerId;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    if (
      req.user?.role === UserRole.PARTNER &&
      payload.partnerId &&
      payload.partnerId !== partnerId
    ) {
      return res.status(403).json({ message: "Cannot create leads for other partners" });
    }

    const lead = await createLead({ ...payload, partnerId });

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
  authorize(UserRole.PARTNER, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    let partnerFilter = query.partnerId;

    if (req.user?.role === UserRole.PARTNER) {
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

    const { items, total } = await listLeads({
      status: query.status,
      partnerId: partnerFilter,
      assignedUserId: assignedFilter,
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
  authorize(UserRole.PARTNER, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = leadIdParamSchema.parse(req.params);

    const lead = await getLeadById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (req.user?.role === UserRole.PARTNER) {
      if (!req.user.partnerId || lead.partnerId !== req.user.partnerId) {
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

    const publicPath = getPublicPath(id, req.file.filename);

    const document = await addLeadDocument({
      leadId: id,
      userId: req.user!.id,
      type,
      filePath: publicPath,
      checksum: body.checksum,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    res.status(201).json(document);
  }),
);

export { router as leadRouter };
