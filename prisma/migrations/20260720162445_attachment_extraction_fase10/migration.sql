-- CreateEnum
CREATE TYPE "AttachmentExtractionMethod" AS ENUM ('STRUCTURED', 'LOCAL_TEXT', 'VISION');

-- CreateEnum
CREATE TYPE "AttachmentExtractionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'DEFERRED_BUDGET');

-- AlterEnum
ALTER TYPE "FieldSourceType" ADD VALUE 'ATTACHMENT_STRUCTURED';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "extractedPages" JSONB,
ADD COLUMN     "extractionCostUsd" DECIMAL(10,4),
ADD COLUMN     "extractionError" TEXT,
ADD COLUMN     "extractionMethod" "AttachmentExtractionMethod",
ADD COLUMN     "extractionStatus" "AttachmentExtractionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "structuredFields" JSONB;

-- AlterTable
ALTER TABLE "RuleSettings" ADD COLUMN     "visionExtractionDailyBudgetUsd" DECIMAL(10,2) NOT NULL DEFAULT 5.00;

-- CreateIndex
CREATE INDEX "Attachment_contentHash_idx" ON "Attachment"("contentHash");
