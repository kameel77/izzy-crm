import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { handleIncomingEmailWebhook } from "../controllers/email.controller.js";

const router = Router();

router.post(
    "/email/incoming",
    asyncHandler(handleIncomingEmailWebhook)
);

export { router as webhookRouter };
