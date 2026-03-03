-- CreateEnum
CREATE TYPE "InsuranceOnboardingStatus" AS ENUM ('CREATED', 'ONBOARDING_SENT', 'LINK_OPENED', 'SLOT_SELECTED', 'CONSENTS_CAPTURED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "CommStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'PHONE_CONTACT';

-- CreateTable
CREATE TABLE "InsuranceOnboardingSession" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "InsuranceOnboardingStatus" NOT NULL DEFAULT 'CREATED',
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "sentByUserId" TEXT,
    "smsSentAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "slotSelectedAt" TIMESTAMP(3),
    "consentsCapAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceOnboardingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSchedule" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "preferredSlot" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
    "source" TEXT NOT NULL DEFAULT 'lp_onboarding',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "templateKey" TEXT,
    "status" "CommStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "sentTo" TEXT,
    "payload" JSONB,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceOnboardingSession_leadId_key" ON "InsuranceOnboardingSession"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceOnboardingSession_token_key" ON "InsuranceOnboardingSession"("token");

-- CreateIndex
CREATE INDEX "InsuranceOnboardingSession_token_idx" ON "InsuranceOnboardingSession"("token");

-- CreateIndex
CREATE INDEX "InsuranceOnboardingSession_leadId_idx" ON "InsuranceOnboardingSession"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSchedule_sessionId_key" ON "ContactSchedule"("sessionId");

-- CreateIndex
CREATE INDEX "ContactSchedule_leadId_idx" ON "ContactSchedule"("leadId");

-- CreateIndex
CREATE INDEX "CommunicationLog_sessionId_idx" ON "CommunicationLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_key" ON "MessageTemplate"("key");

-- AddForeignKey
ALTER TABLE "InsuranceOnboardingSession" ADD CONSTRAINT "InsuranceOnboardingSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceOnboardingSession" ADD CONSTRAINT "InsuranceOnboardingSession_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSchedule" ADD CONSTRAINT "ContactSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InsuranceOnboardingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSchedule" ADD CONSTRAINT "ContactSchedule_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InsuranceOnboardingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
