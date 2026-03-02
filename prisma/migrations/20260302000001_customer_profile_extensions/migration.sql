-- Add missing columns to LeadNote that were skipped by the resolved migration
ALTER TABLE "LeadNote" ADD COLUMN IF NOT EXISTS "type" "LeadNoteType" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "LeadNote" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Add missing columns to CustomerProfile that never had a migration generated
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "nationalIdHash" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "alternateEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "employmentInfo" JSONB;
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "address" JSONB;
