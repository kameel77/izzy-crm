import { Router } from "express";
import { z } from "zod";

import { createRateLimiter } from "../middlewares/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  authenticateUser,
  confirmPasswordReset,
  requestPasswordReset,
} from "../services/auth.service.js";

const router = Router();

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: "auth-login",
  message: "Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.",
});

const resetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "auth-reset",
  message: "Zbyt wiele żądań resetu hasła. Spróbuj ponownie później.",
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

const confirmResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

router.post(
  "/login",
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authenticateUser(email, password);

    return res.json(result);
  }),
);

router.post(
  "/reset-password",
  resetRateLimiter,
  asyncHandler(async (req, res) => {
    const { email } = resetPasswordSchema.parse(req.body);

    await requestPasswordReset(email);

    return res.status(204).send();
  }),
);

router.post(
  "/reset-password/confirm",
  resetRateLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = confirmResetPasswordSchema.parse(req.body);

    await confirmPasswordReset(token, password);

    return res.status(204).send();
  }),
);

export { router as authRouter };
