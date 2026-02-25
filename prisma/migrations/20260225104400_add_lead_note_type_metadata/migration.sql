-- CreateEnum
CREATE TYPE "LeadNoteType" AS ENUM ('MANUAL', 'EMAIL_SENT', 'EMAIL_RECEIVED');

-- AlterTable
ALTER TABLE "LeadNote" ADD COLUMN "type" "LeadNoteType" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "LeadNote" ADD COLUMN "metadata" JSONB;
