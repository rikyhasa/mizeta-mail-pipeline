-- DropForeignKey
ALTER TABLE "ExtractionRun" DROP CONSTRAINT "ExtractionRun_caseId_fkey";

-- AlterTable
ALTER TABLE "ExtractionRun" ALTER COLUMN "caseId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
