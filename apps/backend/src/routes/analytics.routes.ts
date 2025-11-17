import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getDashboardAnalytics,
  getDashboardMonitoringData,
} from "../services/analytics.service.js";

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
      assignedUserId: req.user?.role === UserRole.OPERATOR ? req.user.id : undefined,
      rangeDays: query.rangeDays,
    });

    res.json(analytics);
  }),
);

router.get(
  "/monitoring",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR),
  asyncHandler(async (req, res) => {
    const data = await getDashboardMonitoringData({
      assignedUserId: req.user?.role === UserRole.OPERATOR ? req.user.id : undefined,
    });
    res.json(data);
  }),
);

export { router as analyticsRouter };
