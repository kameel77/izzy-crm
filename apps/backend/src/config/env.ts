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
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    }),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => (val ? val === "true" || val === "1" : undefined)),
  LEAD_EMAIL_FROM: z.string().optional(),
  LEAD_EMAIL_HOST: z.string().optional(),
  LEAD_EMAIL_PORT: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    }),
  LEAD_EMAIL_USER: z.string().optional(),
  LEAD_EMAIL_PASSWORD: z.string().optional(),
  LEAD_EMAIL_SECURE: z
    .string()
    .optional()
    .transform((val) => (val ? val === "true" || val === "1" : undefined)),
  LEAD_IMAP_HOST: z.string().optional(),
  LEAD_IMAP_PORT: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    }),
  LEAD_IMAP_SECURE: z
    .string()
    .optional()
    .transform((val) => (val ? val === "true" || val === "1" : undefined)),
  LEAD_INBOX_PARTNER_ID: z.string().optional(),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  CRM_WEBHOOK_URL: z.string().url().optional(),
  CRM_WEBHOOK_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const corsOrigins = parsed.data.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim().replace(/\/$/, "").toLowerCase())
  .filter(Boolean);
const normalizedCorsOrigins = corsOrigins.length > 0 ? corsOrigins : ["*"];

export const env = {
  ...parsed.data,
  port: Number(parsed.data.PORT) || 4000,
  cors: {
    origins: normalizedCorsOrigins,
  },
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
  email:
    parsed.data.SMTP_HOST && parsed.data.EMAIL_FROM
      ? {
          from: parsed.data.EMAIL_FROM,
          host: parsed.data.SMTP_HOST,
          port: parsed.data.SMTP_PORT ?? 587,
          user: parsed.data.SMTP_USER,
          password: parsed.data.SMTP_PASSWORD,
          secure: parsed.data.SMTP_SECURE ?? false,
        }
      : null,
  leadEmail:
    parsed.data.LEAD_EMAIL_HOST && parsed.data.LEAD_EMAIL_USER && parsed.data.LEAD_EMAIL_PASSWORD
      ? {
          from: parsed.data.LEAD_EMAIL_FROM ?? parsed.data.EMAIL_FROM ?? undefined,
          host: parsed.data.LEAD_EMAIL_HOST,
          port: parsed.data.LEAD_EMAIL_PORT ?? 587,
          user: parsed.data.LEAD_EMAIL_USER,
          password: parsed.data.LEAD_EMAIL_PASSWORD,
          secure: parsed.data.LEAD_EMAIL_SECURE ?? false,
          imapHost: parsed.data.LEAD_IMAP_HOST ?? parsed.data.LEAD_EMAIL_HOST,
          imapPort: parsed.data.LEAD_IMAP_PORT ?? 993,
          imapSecure: parsed.data.LEAD_IMAP_SECURE ?? true,
        }
      : null,
  leadInboxPartnerId: parsed.data.LEAD_INBOX_PARTNER_ID,
  app: {
    baseUrl: parsed.data.APP_BASE_URL,
  },
  integrations: {
    crmWebhook: parsed.data.CRM_WEBHOOK_URL
      ? {
          url: parsed.data.CRM_WEBHOOK_URL,
          token: parsed.data.CRM_WEBHOOK_TOKEN,
        }
      : null,
  },
};
