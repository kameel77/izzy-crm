import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";

import { analyticsRouter } from "./analytics.routes.js";
import { authRouter } from "./auth.routes.js";
import { consentRouter } from "./consent.routes.js";
import { leadRouter } from "./lead.routes.js";
import { userRouter } from "./user.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use(consentRouter);
router.use("/auth", authRouter);
router.use("/analytics", authenticate, analyticsRouter);
router.use("/leads", authenticate, leadRouter);
router.use("/users", authenticate, userRouter);

export { router };
