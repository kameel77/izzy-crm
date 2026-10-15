import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { handleIncomingEmailWebhook } from "../controllers/email.controller.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";

const router = Router();

const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "webhook:email",
});

router.post(
    "/email/incoming",
    webhookLimiter,
    asyncHandler(handleIncomingEmailWebhook)
);

export { router as webhookRouter };
