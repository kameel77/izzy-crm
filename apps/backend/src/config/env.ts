import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().default("*"),
  UPLOAD_DRIVER: z.enum(["disk", "s3"]).default("disk"),
  UPLOAD_DIR: z.string().default("storage/uploads"),
  UPLOAD_MAX_BYTES: z
    .string()
    .default("52428800")
    .transform((val) => {
      const parsed = Number(val);
      return Number.isNaN(parsed) ? 52428800 : parsed;
    }),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((val) => (val ? val === "true" || val === "1" : undefined)),
  S3_PUBLIC_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  port: Number(parsed.data.PORT) || 4000,
  uploadDriver: parsed.data.UPLOAD_DRIVER,
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
  uploadMaxBytes: parsed.data.UPLOAD_MAX_BYTES,
  s3: parsed.data.UPLOAD_DRIVER === "s3"
    ? {
        bucket: parsed.data.S3_BUCKET,
        region: parsed.data.S3_REGION,
        endpoint: parsed.data.S3_ENDPOINT,
        accessKeyId: parsed.data.S3_ACCESS_KEY_ID,
        secretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
        forcePathStyle: parsed.data.S3_FORCE_PATH_STYLE ?? false,
        publicUrl: parsed.data.S3_PUBLIC_URL,
      }
    : null,
};
