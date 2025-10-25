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
  UPLOAD_DIR: z.string().default("storage/uploads"),
  UPLOAD_MAX_BYTES: z
    .string()
    .default("52428800")
    .transform((val) => {
      const parsed = Number(val);
      return Number.isNaN(parsed) ? 52428800 : parsed;
    }),
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
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
  uploadMaxBytes: parsed.data.UPLOAD_MAX_BYTES,
};
