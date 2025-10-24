import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import { createLead } from "../services/lead.service.js";
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

export { router as leadRouter };
