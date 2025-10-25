import fs from "fs";
import path from "path";
import multer from "multer";

import { env } from "../config/env.js";

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const rootUploadDir = env.uploadDir;
ensureDir(rootUploadDir);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const leadId = (req.params as { id?: string }).id;
    const targetDir = leadId ? path.join(rootUploadDir, leadId) : rootUploadDir;
    ensureDir(targetDir);
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.uploadMaxBytes },
});

export const getPublicPath = (leadId: string, filename: string) =>
  path.posix.join("/uploads", leadId, filename);

export const getDiskPath = (leadId: string, filename: string) =>
  path.join(rootUploadDir, leadId, filename);
