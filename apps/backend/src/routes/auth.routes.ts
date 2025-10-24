import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticateUser } from "../services/auth.service.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authenticateUser(email, password);

    return res.json(result);
  }),
);

export { router as authRouter };
