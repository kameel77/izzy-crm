import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../config/env.js";

const rootUploadDir = env.uploadDir;

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
  const ext = path.extname(originalName);
  const base = randomBytes(6).toString("hex");
  return `${Date.now()}-${base}${ext}`;
};

export const saveUploadedFile = async ({ leadId, file }: SaveFileArgs): Promise<SaveFileResult> => {
  const filename = generateFileName(file.originalname);
  if (env.uploadDriver === "s3" && s3Client && env.s3) {
    const key = `leads/${leadId}/${filename}`;
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
  const leadDir = path.join(rootUploadDir, leadId);
  ensureDir(leadDir);
  const diskPath = path.join(leadDir, filename);
  fs.writeFileSync(diskPath, file.buffer);
  const publicPath = path.posix.join("/uploads", leadId, filename);

  return {
    filePath: publicPath,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storageProvider: "disk",
    storageKey: diskPath,
  };
};
