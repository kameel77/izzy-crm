import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticateUser, requestPasswordReset } from "../services/auth.service.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authenticateUser(email, password);

    return res.json(result);
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { email } = resetPasswordSchema.parse(req.body);

    await requestPasswordReset(email);

    return res.status(204).send();
  }),
);

export { router as authRouter };
