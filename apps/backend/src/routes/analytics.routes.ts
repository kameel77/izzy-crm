import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardAnalytics } from "../services/analytics.service.js";

const router = Router();

const dashboardQuerySchema = z.object({
  partnerId: z.string().min(1).optional(),
  rangeDays: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return Number(value);
    }, z.number().int().min(1).max(365).optional()),
});

router.get(
  "/dashboard",
  authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const query = dashboardQuerySchema.parse(req.query);

    const analytics = await getDashboardAnalytics({
      partnerId: query.partnerId,
      rangeDays: query.rangeDays,
    });

    res.json(analytics);
  }),
);

export { router as analyticsRouter };
