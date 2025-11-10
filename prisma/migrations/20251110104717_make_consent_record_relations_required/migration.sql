/*
  Warnings:

  - Made the column `leadId` on table `ConsentRecord` required. This step will fail if there are existing NULL values in that column.
  - Made the column `recordedByUserId` on table `ConsentRecord` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."ConsentRecord" DROP CONSTRAINT "ConsentRecord_leadId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ConsentRecord" DROP CONSTRAINT "ConsentRecord_recordedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmailLog" DROP CONSTRAINT "EmailLog_applicationFormId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmailLog" DROP CONSTRAINT "EmailLog_leadId_fkey";

-- AlterTable
ALTER TABLE "ApplicationForm" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConsentRecord" ALTER COLUMN "leadId" SET NOT NULL,
ALTER COLUMN "recordedByUserId" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConsentTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_applicationFormId_fkey" FOREIGN KEY ("applicationFormId") REFERENCES "ApplicationForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
