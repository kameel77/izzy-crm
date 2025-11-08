-- CreateEnum
CREATE TYPE "ApplicationFormStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PARTNER_DECLARATION', 'MARKETING', 'FINANCIAL_PARTNERS', 'VEHICLE_PARTNERS');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('ONLINE_FORM', 'PHONE_CALL', 'PARTNER_SUBMISSION');

-- CreateTable
CREATE TABLE "ApplicationForm" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "ApplicationFormStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "uniqueLink" TEXT NOT NULL,
    "accessCodeHash" TEXT NOT NULL,
    "linkGeneratedAt" TIMESTAMP(3),
    "linkExpiresAt" TIMESTAMP(3),
    "isClientActive" BOOLEAN NOT NULL DEFAULT false,
    "lastClientActivity" TIMESTAMP(3),
    "lastAutoSave" TIMESTAMP(3),
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "formData" JSONB,
    "submittedAt" TIMESTAMP(3),
    "submittedByClient" BOOLEAN NOT NULL DEFAULT false,
    "unlockHistory" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "formType" TEXT NOT NULL DEFAULT 'financing_application',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "helpText" TEXT,
    "version" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "consentTemplateId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "applicationFormId" TEXT,
    "leadId" TEXT,
    "consentGiven" BOOLEAN NOT NULL,
    "consentMethod" "ConsentMethod" NOT NULL DEFAULT 'ONLINE_FORM',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "recordedByUserId" TEXT,
    "partnerId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "notes" TEXT,
    "version" INTEGER NOT NULL,
    "consentText" TEXT NOT NULL,
    "accessCodeHash" TEXT,
    "helpTextSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationForm_leadId_key" ON "ApplicationForm"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationForm_uniqueLink_key" ON "ApplicationForm"("uniqueLink");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTemplate_consentType_formType_version_key" ON "ConsentTemplate"("consentType", "formType", "version");

-- CreateIndex
CREATE INDEX "ConsentTemplate_formType_isActive_idx" ON "ConsentTemplate"("formType", "isActive");

-- CreateIndex
CREATE INDEX "ConsentRecord_leadId_idx" ON "ConsentRecord"("leadId");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentTemplateId_idx" ON "ConsentRecord"("consentTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_applicationFormId_consentTemplateId_version_key" ON "ConsentRecord"("applicationFormId", "consentTemplateId", "version");

-- AddForeignKey
ALTER TABLE "ApplicationForm" ADD CONSTRAINT "ApplicationForm_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationForm" ADD CONSTRAINT "ApplicationForm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_consentTemplateId_fkey" FOREIGN KEY ("consentTemplateId") REFERENCES "ConsentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_applicationFormId_fkey" FOREIGN KEY ("applicationFormId") REFERENCES "ApplicationForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
