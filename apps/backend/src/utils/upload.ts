import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import multer from "multer";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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
  category?: string;
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

const normalizeCategory = (category?: string) => {
  if (!category) return undefined;
  return category
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
};

export const saveUploadedFile = async ({
  leadId,
  file,
  category,
}: SaveFileArgs): Promise<SaveFileResult> => {
  const filename = generateFileName(file.originalname);
  const normalizedCategory = normalizeCategory(category);
  const keyPrefix = normalizedCategory ? `${normalizedCategory}/` : "";
  if (env.uploadDriver === "s3" && s3Client && env.s3) {
    if (!env.s3.bucket) {
      throw new Error("S3 bucket is not configured");
    }

    const key = `leads/${leadId}/${keyPrefix}${filename}`;
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
  const categoryDir = normalizedCategory ? path.join(leadDir, normalizedCategory) : leadDir;
  ensureDir(categoryDir);
  const diskPath = path.join(categoryDir, filename);
  fs.writeFileSync(diskPath, file.buffer);
  const publicPath = path.posix.join(
    "/uploads",
    normalizedCategory ? path.posix.join(leadId, normalizedCategory) : leadId,
    filename,
  );

  return {
    filePath: publicPath,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storageProvider: "disk",
    storageKey: diskPath,
  };
};

export interface StoredFileLocation {
  storageProvider: string;
  storageKey?: string | null;
}

export const getStoredFileStream = async (
  location: StoredFileLocation,
): Promise<Readable> => {
  if (location.storageProvider === "s3") {
    if (!s3Client || !env.s3?.bucket) {
      throw new Error("S3 storage is not configured");
    }

    if (!location.storageKey) {
      throw new Error("S3 object key is missing");
    }

    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: env.s3.bucket, Key: location.storageKey }),
    );

    if (!result.Body || !(result.Body instanceof Readable)) {
      const body = result.Body as NodeJS.ReadableStream | null | undefined;
      if (!body) {
        throw new Error("S3 object body is empty");
      }
      return Readable.from(body as AsyncIterable<Uint8Array>);
    }

    return result.Body;
  }

  if (location.storageProvider === "disk") {
    if (!location.storageKey) {
      throw new Error("Disk file path is missing");
    }

    return fs.createReadStream(location.storageKey);
  }

  throw new Error(`Unsupported storage provider: ${location.storageProvider}`);
};

export const deleteStoredFile = async (location: StoredFileLocation) => {
  if (location.storageProvider === "s3") {
    if (!s3Client || !env.s3?.bucket) {
      throw new Error("S3 storage is not configured");
    }

    if (!location.storageKey) {
      return;
    }

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: location.storageKey }),
    );
    return;
  }

  if (location.storageProvider === "disk") {
    if (!location.storageKey) {
      return;
    }

    try {
      await fs.promises.unlink(location.storageKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    return;
  }

  throw new Error(`Unsupported storage provider: ${location.storageProvider}`);
};
