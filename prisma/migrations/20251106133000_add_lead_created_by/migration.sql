ALTER TABLE "Lead"
  ADD COLUMN "createdByUserId" TEXT;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lead_createdByUserId_idx" ON "Lead"("createdByUserId");
