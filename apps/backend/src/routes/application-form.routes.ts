import { timingSafeEqual } from "crypto";
import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authorize } from "../middlewares/authorize.js";
import { authenticate } from "../middlewares/authenticate.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";
import { canAccessLead } from "../utils/leadAccess.js";
import {
  getApplicationFormById,
  heartbeatApplicationForm,
  logUnlockAttempt,
  saveApplicationFormProgress,
  submitApplicationForm,
  unlockApplicationForm,
  verifyApplicationFormAccess,
} from "../services/application-form.service.js";

const router = Router();

const formVerifyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: "app-form-verify",
  message: "Zbyt wiele prób weryfikacji kodu dostępu. Spróbuj ponownie później.",
});

const formPublicRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyPrefix: "app-form-public",
});

const safeCompare = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

const formIdSchema = z.object({ id: z.string().cuid() });
const unlockSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const logUnlockAttemptSchema = z.object({
  success: z.boolean(),
});

const saveProgressSchema = z.object({
  formData: z.record(z.unknown()),
  currentStep: z.number().int().min(1),
  completionPercent: z.number().min(0).max(100),
});

const verifyAccessSchema = z.object({
  applicationFormId: z.string().cuid(),
  leadId: z.string().cuid(),
  code: z.string().trim().min(1),
});

const authorizeApplicationFormAccess = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = formIdSchema.parse(req.params);

    const form = await prisma.applicationForm.findUnique({
      where: { id },
      select: {
        id: true,
        accessCodeHash: true,
        linkExpiresAt: true,
        lead: {
          select: {
            id: true,
            partnerId: true,
            createdByUserId: true,
            assignedUserId: true,
          },
        },
      },
    });

    if (!form) {
      return res.status(404).json({ message: "Application form not found" });
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const payload = verifyToken(token);
        const user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role as UserRole,
          partnerId: payload.partnerId ?? undefined,
        };
        if (canAccessLead(form.lead, user)) {
          req.user = user;
          return next();
        }
        return res.status(403).json({ message: "Access denied" });
      } catch {
        // Fall through to client form access hash check
      }
    }

    const headerHash = req.header("x-form-access-hash");
    const queryHash = typeof req.query.accessCodeHash === "string" ? req.query.accessCodeHash : undefined;
    const bodyHash =
      typeof req.body === "object" && req.body !== null && typeof req.body.accessCodeHash === "string"
        ? req.body.accessCodeHash
        : undefined;
    const providedHash = (headerHash || queryHash || bodyHash || "").trim();

    if (!providedHash || !form.accessCodeHash || !safeCompare(form.accessCodeHash, providedHash)) {
      return res.status(401).json({
        code: "INVALID_CODE",
        message: "Brak autoryzacji do formularza – zweryfikuj kod dostępu.",
      });
    }

    if (form.linkExpiresAt && form.linkExpiresAt <= new Date()) {
      return res.status(401).json({
        code: "LINK_EXPIRED",
        message: "Link do formularza wygasł.",
      });
    }

    return next();
  },
);

router.get(
  "/:id",
  formPublicRateLimiter,
  authorizeApplicationFormAccess,
  asyncHandler(async (req, res) => {
    const { id } = formIdSchema.parse(req.params);
    const form = await getApplicationFormById({ applicationFormId: id });
    return res.json(form);
  }),
);

router.post(
  "/verify-access",
  formVerifyRateLimiter,
  asyncHandler(async (req, res) => {
    const body = verifyAccessSchema.parse(req.body ?? {});
    const result = await verifyApplicationFormAccess(body);
    return res.status(200).json(result);
  }),
);

router.post(
  "/:id/heartbeat",
  formPublicRateLimiter,
  authorizeApplicationFormAccess,
  asyncHandler(async (req, res) => {
    const { id } = formIdSchema.parse(req.params);
    const result = await heartbeatApplicationForm(id);
    return res.status(200).json(result);
  }),
);

router.post(
  "/:id/submit",
  formPublicRateLimiter,
  authorizeApplicationFormAccess,
  asyncHandler(async (req, res) => {
    const { id } = formIdSchema.parse(req.params);
    const { formData } = req.body;
    const result = await submitApplicationForm(id, formData);
    res.status(200).json(result);
  }),
);

router.post(
  "/:id/unlock",
  authenticate,
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

router.patch(
  "/:id",
  formPublicRateLimiter,
  authorizeApplicationFormAccess,
  asyncHandler(async (req, res) => {
    const { id } = formIdSchema.parse(req.params);
    const body = saveProgressSchema.parse(req.body);

    const result = await saveApplicationFormProgress({
      applicationFormId: id,
      ...body,
    });

    return res.json(result);
  }),
);

router.post(
  "/:id/log-unlock-attempt",
  formVerifyRateLimiter,
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