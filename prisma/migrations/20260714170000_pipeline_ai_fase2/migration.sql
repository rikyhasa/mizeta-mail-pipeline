-- CreateEnum
CREATE TYPE "CaseRelationKind" AS ENUM ('DUPLICATE_CANDIDATE', 'RELATED');

-- CreateEnum
CREATE TYPE "CaseRelationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CASE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EXTRACTION_ERROR';
ALTER TYPE "AuditAction" ADD VALUE 'POSSIBLE_DUPLICATE_FLAGGED';
ALTER TYPE "AuditAction" ADD VALUE 'SECURITY_FLAG_DETECTED';
ALTER TYPE "AuditAction" ADD VALUE 'RULE_SETTINGS_UPDATED';

-- DropIndex
DROP INDEX "CaseField_caseId_fieldKey_idx";

-- CreateTable
CREATE TABLE "ActionProposalRun" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "llmProvider" TEXT NOT NULL,
    "model" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL(10,4),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionProposalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRelation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "relatedCaseId" TEXT NOT NULL,
    "kind" "CaseRelationKind" NOT NULL,
    "status" "CaseRelationStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION,
    "reason" TEXT,
    "matchLevel" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "classificationConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
    "matchingAutoLinkConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "matchingPossibleDuplicateConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "deadlineCriticalWithinHours" INTEGER NOT NULL DEFAULT 24,
    "fineReducedDeadlineCriticalWithinHours" INTEGER NOT NULL DEFAULT 48,
    "claimAmountHighThreshold" DECIMAL(12,2) NOT NULL DEFAULT 2000,
    "quoteSameDayResponseWithinHours" INTEGER NOT NULL DEFAULT 4,
    "amountMismatchTolerancePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseRelation_status_idx" ON "CaseRelation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRelation_caseId_relatedCaseId_kind_key" ON "CaseRelation"("caseId", "relatedCaseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSettings_key_key" ON "RuleSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CaseField_caseId_fieldKey_key" ON "CaseField"("caseId", "fieldKey");

-- AddForeignKey
ALTER TABLE "ActionProposalRun" ADD CONSTRAINT "ActionProposalRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSettings" ADD CONSTRAINT "RuleSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

