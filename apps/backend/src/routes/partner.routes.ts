import { PartnerStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createPartner,
  listPartners,
  PartnerContactInput,
  updatePartner,
} from "../services/partner.service.js";

const router = Router();

const contactSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .partial();

const jsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonRecordSchema = z.record(jsonScalarSchema).optional();

const listPartnersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  search: z.string().optional(),
});

const createPartnerSchema = z.object({
  name: z.string().min(1),
  status: z.nativeEnum(PartnerStatus).optional(),
  contact: contactSchema.nullable().optional(),
  slaRules: jsonRecordSchema.nullable(),
  notes: z.string().nullable().optional(),
});

const updatePartnerSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  contact: contactSchema.nullable().optional(),
  slaRules: jsonRecordSchema.nullable(),
  notes: z.string().nullable().optional(),
});

router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const query = listPartnersSchema.parse(req.query);
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const { items, total } = await listPartners({
      status: query.status,
      search: query.search,
      skip,
      take: perPage,
    });

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    res.json({
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

router.post(
  "/",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createPartnerSchema.parse(req.body);

    const partner = await createPartner({
      name: payload.name,
      status: payload.status,
      contact: payload.contact ?? undefined,
      slaRules: payload.slaRules ?? undefined,
      notes: payload.notes ?? undefined,
    });

    res.status(201).json(partner);
  }),
);

router.patch(
  "/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const payload = updatePartnerSchema.parse(req.body);

    const partner = await updatePartner({
      id,
      name: payload.name,
      status: payload.status,
      contact: typeof payload.contact === "undefined" ? undefined : (payload.contact as PartnerContactInput | null),
      slaRules: typeof payload.slaRules === "undefined" ? undefined : payload.slaRules,
      notes: payload.notes,
    });

    res.json(partner);
  }),
);

export { router as partnerRouter };
