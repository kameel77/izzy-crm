-- CreateEnum
CREATE TYPE "LeadNoteType" AS ENUM ('MANUAL', 'EMAIL_SENT', 'EMAIL_RECEIVED');

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'MERGED';

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "alternateEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "LeadNote" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "type" "LeadNoteType" NOT NULL DEFAULT 'MANUAL';
