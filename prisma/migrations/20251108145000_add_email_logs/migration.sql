-- CreateEnum
CREATE TYPE "EmailLogType" AS ENUM ('LINK_SENT', 'REMINDER_24H', 'REMINDER_5DAYS', 'UNLOCKED', 'READY_FOR_REVIEW');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED', 'OPENED');

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "applicationFormId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "EmailLogType" NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentTo" TEXT,
    "payload" JSONB,
    "noteCreated" BOOLEAN NOT NULL DEFAULT false,
    "noteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_applicationFormId_type_idx" ON "EmailLog"("applicationFormId", "type");

-- CreateIndex
CREATE INDEX "EmailLog_leadId_idx" ON "EmailLog"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_applicationFormId_type_key" ON "EmailLog"("applicationFormId", "type");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_applicationFormId_fkey" FOREIGN KEY ("applicationFormId") REFERENCES "ApplicationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
