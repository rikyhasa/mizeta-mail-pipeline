-- CreateEnum
CREATE TYPE "EnforcementCheckApplicability" AS ENUM ('NOT_APPLICABLE', 'TO_BE_IDENTIFIED', 'SPEED_CAMERA_FIXED', 'SPEED_CAMERA_MOBILE', 'AVERAGE_SPEED_CONTROL', 'TELELASER', 'OTHER_SPEED_DEVICE');

-- CreateEnum
CREATE TYPE "EnforcementVerificationState" AS ENUM ('NOT_APPLICABLE', 'TO_BE_IDENTIFIED', 'IDENTIFIED', 'DOCUMENTATION_TO_ACQUIRE', 'DOCUMENTATION_INCOMPLETE', 'DATA_CONFLICT', 'TO_BE_VERIFIED', 'DOCUMENTED_VERIFICATION_COMPLETE', 'REQUIRES_LEGAL_REVIEW');

-- CreateEnum
CREATE TYPE "EnforcementDocumentType" AS ENUM ('APPROVAL_OR_HOMOLOGATION_DECREE', 'CALIBRATION_CERTIFICATE', 'FUNCTIONALITY_CERTIFICATE', 'TECHNICAL_MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EnforcementDocumentStatus" AS ENUM ('PRESENT', 'MISSING', 'REQUESTED');

-- CreateEnum
CREATE TYPE "SpeedRegistryFetchMethod" AS ENUM ('SCHEDULED_FETCH', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "EnforcementRegistryMatchState" AS ENUM ('MATCH', 'MISMATCH', 'NOT_FOUND', 'NOT_CONSULTED');

-- CreateEnum
CREATE TYPE "AppealDocumentaryStrength" AS ENUM ('NONE', 'WEAK', 'RELEVANT', 'STRONG');

-- CreateEnum
CREATE TYPE "AppealEconomicConvenience" AS ENUM ('UNFAVORABLE', 'LIMITED', 'FAVORABLE');

-- CreateEnum
CREATE TYPE "AppealIndication" AS ENUM ('CONSIDER_GDP_APPEAL', 'CONSIDER_PREFETTO_APPEAL', 'RELEVANT_BUT_UNECONOMICAL', 'NO_RELEVANT_ELEMENT', 'DEADLINES_EXPIRED', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "AppealDecisionKind" AS ENUM ('NOT_DECIDED', 'GDP_FILED', 'PREFETTO_FILED', 'NO_APPEAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ENFORCEMENT_DEVICE_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'ENFORCEMENT_DOCUMENT_LINKED';
ALTER TYPE "AuditAction" ADD VALUE 'ENFORCEMENT_LEGAL_ESCALATED';
ALTER TYPE "AuditAction" ADD VALUE 'SPEED_REGISTRY_SYNCED';
ALTER TYPE "AuditAction" ADD VALUE 'SPEED_REGISTRY_MANUAL_UPLOAD';
ALTER TYPE "AuditAction" ADD VALUE 'APPEAL_DECISION_RECORDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeadlineKind" ADD VALUE 'APPEAL_DUE_GDP';
ALTER TYPE "DeadlineKind" ADD VALUE 'APPEAL_DUE_PREFETTO';

-- AlterTable
ALTER TABLE "RuleSettings" ADD COLUMN     "appealCostParamsSource" TEXT,
ADD COLUMN     "appealCostParamsVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "appealFavorableMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 2.0,
ADD COLUMN     "appealGdpStampDutyAmount" DECIMAL(8,2) NOT NULL DEFAULT 27,
ADD COLUMN     "appealGdpUnifiedContributionHighValue" DECIMAL(8,2) NOT NULL DEFAULT 98,
ADD COLUMN     "appealGdpUnifiedContributionLowValue" DECIMAL(8,2) NOT NULL DEFAULT 43,
ADD COLUMN     "appealGdpUnifiedContributionThreshold" DECIMAL(10,2) NOT NULL DEFAULT 1100,
ADD COLUMN     "appealInternalHandlingCost" DECIMAL(8,2) NOT NULL DEFAULT 80,
ADD COLUMN     "appealLicensePointValueEquivalent" DECIMAL(8,2) NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "EnforcementDeviceCheck" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "applicability" "EnforcementCheckApplicability" NOT NULL,
    "state" "EnforcementVerificationState" NOT NULL DEFAULT 'TO_BE_IDENTIFIED',
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "needsLegalReview" BOOLEAN NOT NULL DEFAULT false,
    "extractionRunId" TEXT,
    "registrySnapshotId" TEXT,
    "registryMatch" "EnforcementRegistryMatchState",
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementDeviceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnforcementDeviceField" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT,
    "normalizedValue" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceType" "FieldSourceType",
    "sourceMessageId" TEXT,
    "sourceAttachmentId" TEXT,
    "sourcePage" INTEGER,
    "sourceExcerpt" TEXT,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementDeviceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnforcementDocumentCheck" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "documentType" "EnforcementDocumentType" NOT NULL,
    "status" "EnforcementDocumentStatus" NOT NULL DEFAULT 'MISSING',
    "attachmentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementDocumentCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeedRegistrySnapshot" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchMethod" "SpeedRegistryFetchMethod" NOT NULL DEFAULT 'SCHEDULED_FETCH',
    "uploadedById" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "deviceCount" INTEGER NOT NULL,
    "rawStorageKey" TEXT NOT NULL,
    "diffFromPreviousId" TEXT,
    "diffSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeedRegistrySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppealDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "decision" "AppealDecisionKind" NOT NULL DEFAULT 'NOT_DECIDED',
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppealDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnforcementDeviceCheck_caseId_key" ON "EnforcementDeviceCheck"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "EnforcementDeviceField_checkId_fieldKey_key" ON "EnforcementDeviceField"("checkId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "EnforcementDocumentCheck_checkId_documentType_key" ON "EnforcementDocumentCheck"("checkId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "AppealDecision_caseId_key" ON "AppealDecision"("caseId");

-- AddForeignKey
ALTER TABLE "EnforcementDeviceCheck" ADD CONSTRAINT "EnforcementDeviceCheck_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceCheck" ADD CONSTRAINT "EnforcementDeviceCheck_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "ExtractionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceCheck" ADD CONSTRAINT "EnforcementDeviceCheck_registrySnapshotId_fkey" FOREIGN KEY ("registrySnapshotId") REFERENCES "SpeedRegistrySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceCheck" ADD CONSTRAINT "EnforcementDeviceCheck_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceField" ADD CONSTRAINT "EnforcementDeviceField_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "EnforcementDeviceCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceField" ADD CONSTRAINT "EnforcementDeviceField_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "EmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceField" ADD CONSTRAINT "EnforcementDeviceField_sourceAttachmentId_fkey" FOREIGN KEY ("sourceAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDeviceField" ADD CONSTRAINT "EnforcementDeviceField_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDocumentCheck" ADD CONSTRAINT "EnforcementDocumentCheck_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "EnforcementDeviceCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementDocumentCheck" ADD CONSTRAINT "EnforcementDocumentCheck_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeedRegistrySnapshot" ADD CONSTRAINT "SpeedRegistrySnapshot_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeedRegistrySnapshot" ADD CONSTRAINT "SpeedRegistrySnapshot_diffFromPreviousId_fkey" FOREIGN KEY ("diffFromPreviousId") REFERENCES "SpeedRegistrySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealDecision" ADD CONSTRAINT "AppealDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealDecision" ADD CONSTRAINT "AppealDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
