import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { UserRole } from "@prisma/client";
import {
    startOnboarding,
    getOnboardingStatus,
    verifyOnboardingToken,
    saveContactSlot,
    captureConsents,
} from "../services/insurance-onboarding.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// ── CRM (authenticated) routes ────────────────────────────────────────────────

/** POST /api/leads/:id/insurance-onboarding/start  – trigger send from CRM */
router.post(
    "/leads/:id/insurance-onboarding/start",
    authenticate,
    authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
    asyncHandler(async (req, res) => {
        const { id: leadId } = z.object({ id: z.string().cuid() }).parse(req.params);
        const result = await startOnboarding({ leadId, actorUserId: req.user!.id });
        res.status(200).json(result);
    }),
);

/** GET /api/leads/:id/insurance-onboarding  – get session status for CRM */
router.get(
    "/leads/:id/insurance-onboarding",
    authenticate,
    authorize(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN),
    asyncHandler(async (req, res) => {
        const { id: leadId } = z.object({ id: z.string().cuid() }).parse(req.params);
        const status = await getOnboardingStatus(leadId);
        res.json({ data: status });
    }),
);

// ── Public LP routes (no auth) ────────────────────────────────────────────────

/** GET /api/insurance-onboarding/verify?token=...  – LP verifies token on load */
router.get(
    "/insurance-onboarding/verify",
    asyncHandler(async (req, res) => {
        const { token } = z.object({ token: z.string().min(32) }).parse(req.query);
        const result = await verifyOnboardingToken(token);
        res.json(result);
    }),
);

/** POST /api/insurance-onboarding/contact-slot  – save selected calendar slot */
router.post(
    "/insurance-onboarding/contact-slot",
    asyncHandler(async (req, res) => {
        const body = z.object({
            token: z.string().min(32),
            preferredDate: z.coerce.date(),
            preferredSlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
            timezone: z.string().optional(),
        }).parse(req.body);

        const result = await saveContactSlot({
            token: body.token,
            preferredDate: body.preferredDate,
            preferredSlot: body.preferredSlot,
            timezone: body.timezone,
        });
        res.status(200).json(result);
    }),
);

/** POST /api/insurance-onboarding/consents  – save consent records */
router.post(
    "/insurance-onboarding/consents",
    asyncHandler(async (req, res) => {
        const body = z.object({
            token: z.string().min(32),
            userAgent: z.string().max(512).optional(),
            consents: z.array(
                z.object({
                    consentTemplateId: z.string().cuid(),
                    version: z.number().int().positive(),
                    consentGiven: z.boolean(),
                    consentText: z.string().min(1).optional(),
                    acceptedAt: z.coerce.date().optional(),
                }),
            ).min(1),
        }).parse(req.body);

        const result = await captureConsents({
            token: body.token,
            consents: body.consents,
            ipAddress: req.ip,
            userAgent: body.userAgent,
        });

        res.status(201).json(result);
    }),
);

// ── Admin routes: Message Templates ──────────────────────────────────────────

import { prisma } from "../lib/prisma.js";

router.get(
    "/admin/message-templates",
    authenticate,
    authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
    asyncHandler(async (_req, res) => {
        const templates = await prisma.messageTemplate.findMany({ orderBy: { key: "asc" } });
        res.json({ data: templates });
    }),
);

router.put(
    "/admin/message-templates/:id",
    authenticate,
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
        const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
        const body = z.object({
            subject: z.string().optional(),
            body: z.string().min(1),
            isActive: z.boolean().optional(),
        }).parse(req.body);

        const tpl = await prisma.messageTemplate.update({
            where: { id },
            data: {
                ...body,
                version: { increment: 1 },
                updatedBy: req.user!.id,
            },
        });
        res.json(tpl);
    }),
);

export { router as insuranceOnboardingRouter };
