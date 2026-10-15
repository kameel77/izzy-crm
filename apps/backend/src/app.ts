import cors from "cors";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";

import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { router } from "./routes/index.js";
import { getLeadById } from "./services/lead.service.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { verifyToken } from "./utils/jwt.js";
import { canAccessLead } from "./utils/leadAccess.js";

export const createApp = () => {
  const app = express();

  app.set("etag", false);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "frame-ancestors": ["'none'"],
        },
      },
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    }),
  );
  const corsOrigins = env.cors.origins;
  const allowWildcard = corsOrigins.includes("*") && env.NODE_ENV !== "production";
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowWildcard) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.replace(/\/$/, "").toLowerCase();
        if (corsOrigins.includes(normalizedOrigin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use((_, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const uploadRoot = path.resolve(env.uploadDir);
  app.get(
    "/uploads/:leadId/:filename",
    asyncHandler(async (req, res) => {
      const authHeader = req.get("Authorization") ?? "";
      const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
      const queryToken = typeof req.query.token === "string" ? req.query.token.trim() : "";
      const token = bearerToken || queryToken;

      if (!token) {
        return res.status(401).json({ message: "Authentication required" });
      }

      let userPayload;
      try {
        userPayload = verifyToken(token);
      } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      const safeLeadId = path.basename(req.params.leadId || "");
      const safeFilename = path.basename(req.params.filename || "");
      if (
        !safeLeadId ||
        !safeFilename ||
        safeLeadId !== req.params.leadId ||
        safeFilename !== req.params.filename
      ) {
        return res.status(400).json({ message: "Invalid file path" });
      }

      const lead = await getLeadById(safeLeadId);
      if (!lead) {
        return res.status(404).json({ message: "File not found" });
      }

      if (
        !canAccessLead(lead, {
          id: userPayload.sub,
          role: userPayload.role,
          partnerId: userPayload.partnerId,
        })
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      const resolvedFile = path.resolve(uploadRoot, safeLeadId, safeFilename);
      if (!resolvedFile.startsWith(uploadRoot + path.sep) || !fs.existsSync(resolvedFile)) {
        return res.status(404).json({ message: "File not found" });
      }

      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.sendFile(resolvedFile);
    }),
  );

  app.use("/api", router);
  app.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(errorHandler);

  return app;
};
