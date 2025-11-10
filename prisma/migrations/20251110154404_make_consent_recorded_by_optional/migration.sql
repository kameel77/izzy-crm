-- DropForeignKey
ALTER TABLE "public"."ConsentRecord" DROP CONSTRAINT "ConsentRecord_recordedByUserId_fkey";

-- AlterTable
ALTER TABLE "ConsentRecord" ALTER COLUMN "recordedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
