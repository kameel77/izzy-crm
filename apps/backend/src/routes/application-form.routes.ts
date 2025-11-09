import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  logUnlockAttempt,
  unlockApplicationForm,
} from "../services/application-form.service.js";

const router = Router();

const formIdSchema = z.object({ id: z.string().cuid() });
const unlockSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const logUnlockAttemptSchema = z.object({
  success: z.boolean(),
});

router.post(
  "/:id/unlock",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const { id } = formIdSchema.parse(req.params);
    const body = unlockSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const form = await unlockApplicationForm({
      applicationFormId: id,
      actorUserId: req.user.id,
      reason: body.reason,
    });

    return res.json(form);
  }),
);

router.post(
  "/:id/log-unlock-attempt",
  asyncHandler(async (req, res) => {
    const { id } = formIdSchema.parse(req.params);
    const { success } = logUnlockAttemptSchema.parse(req.body);

    await logUnlockAttempt({
      applicationFormId: id,
      success,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(204).send();
  }),
);

export { router as applicationFormRouter };
