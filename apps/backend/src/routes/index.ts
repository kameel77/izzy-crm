import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";

import { authRouter } from "./auth.routes.js";
import { leadRouter } from "./lead.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/leads", authenticate, leadRouter);

export { router };
