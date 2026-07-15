-- CreateEnum
CREATE TYPE "EmailDraftStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'DISCARDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DRAFT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'DRAFT_DISCARDED';

-- AlterTable
ALTER TABLE "RuleSettings" ADD COLUMN     "attachmentRetentionDays" INTEGER,
ADD COLUMN     "auditLogRetentionDays" INTEGER,
ADD COLUMN     "defaultDepartmentByCategory" JSONB,
ADD COLUMN     "emailRetentionDays" INTEGER,
ADD COLUMN     "enabledCategories" "CaseCategory"[],
ADD COLUMN     "excludedSenderPatterns" TEXT[];

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "placeholders" TEXT[],
    "status" "EmailDraftStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "generatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyTemplate" (
    "id" TEXT NOT NULL,
    "category" "CaseCategory",
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDraft_caseId_idx" ON "EmailDraft"("caseId");

-- CreateIndex
CREATE INDEX "ReplyTemplate_category_idx" ON "ReplyTemplate"("category");

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
