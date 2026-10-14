import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../config/env.js";
import { createHttpError } from "./httpError.js";

const rootUploadDir = env.uploadDir;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".odt",
  ".ods",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

let s3Client: S3Client | null = null;
if (env.uploadDriver === "s3" && env.s3) {
  if (!env.s3.bucket || !env.s3.region || !env.s3.accessKeyId || !env.s3.secretAccessKey) {
    throw new Error("S3 configuration is incomplete. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.");
  }
  s3Client = new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint,
    forcePathStyle: env.s3.forcePathStyle,
    credentials: {
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey,
    },
  });
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxBytes },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
      callback(
        createHttpError({
          status: 400,
          code: "UNSUPPORTED_FILE_TYPE",
          message: "Unsupported file type",
        }),
      );
      return;
    }

    callback(null, true);
  },
});

interface SaveFileArgs {
  leadId: string;
  file: Express.Multer.File;
}

export interface SaveFileResult {
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageProvider: string;
  storageKey?: string;
}

const generateFileName = (originalName: string) => {
  const rawExt = path.extname(originalName).toLowerCase();
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".bin";
  const base = randomBytes(6).toString("hex");
  return `${Date.now()}-${base}${ext}`;
};

export const saveUploadedFile = async ({ leadId, file }: SaveFileArgs): Promise<SaveFileResult> => {
  const safeLeadId = path.basename(leadId);
  if (!safeLeadId || safeLeadId === "." || safeLeadId === "..") {
    throw createHttpError({ status: 400, message: "Invalid leadId" });
  }

  const filename = generateFileName(file.originalname);
  if (env.uploadDriver === "s3" && s3Client && env.s3) {
    const key = `leads/${safeLeadId}/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const publicUrl = env.s3.publicUrl
      ? `${env.s3.publicUrl.replace(/\/$/, "")}/${key}`
      : env.s3.endpoint
        ? `${env.s3.endpoint.replace(/\/$/, "")}/${env.s3.bucket}/${key}`
        : key;

    return {
      filePath: publicUrl,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: "s3",
      storageKey: key,
    };
  }

  // disk fallback
  ensureDir(rootUploadDir);
  const leadDir = path.join(rootUploadDir, safeLeadId);
  ensureDir(leadDir);
  const diskPath = path.join(leadDir, filename);
  fs.writeFileSync(diskPath, file.buffer);
  const publicPath = path.posix.join("/uploads", safeLeadId, filename);

  return {
    filePath: publicPath,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storageProvider: "disk",
    storageKey: diskPath,
  };
};
