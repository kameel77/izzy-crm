import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";

import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { router } from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.set("etag", false);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    }),
  );
  const corsOrigins = env.cors.origins;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes("*")) {
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
  app.use("/uploads", express.static(path.resolve(env.uploadDir)));

  app.use("/api", router);
  app.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(errorHandler);

  return app;
};
