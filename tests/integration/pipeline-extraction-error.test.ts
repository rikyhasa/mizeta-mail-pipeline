import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Forza un fallimento del solo passaggio di estrazione (classify() riuscito, extractFields()
 * che lancia), per verificare che `processIncomingMessage` scriva `EXTRACTION_ERROR` (non
 * `CLASSIFICATION_ERROR`) e una riga `ExtractionRun` FAILED — vedi src/lib/pipeline/types.ts
 * (`PipelineExtractionError`) e process-incoming-message.ts.
 */
const EXTRACTION_ERROR_MESSAGE = "estrazione fallita di proposito per il test";

vi.mock("@/lib/adapters/llm/llm-provider-factory", () => {
  const provider = {
    providerName: "mock" as const,
    async classify() {
      return {
        data: {
          primary_category: "SUPPLIER_INVOICE",
          secondary_categories: [],
          short_title: "Test estrazione fallita",
          summary: "Test estrazione fallita",
          action_required: true,
          suggested_actions: [],
          priority: "NORMAL",
          priority_reasons: [],
          deadline: null,
          responsible_department: null,
          customer_or_supplier: null,
          related_business_identifiers: [],
          confidence: 0.9,
          needs_human_review: false,
          security_flags: [],
        },
        usage: { inputTokens: 10, outputTokens: 10, costUsd: 0.001 },
        model: "test-fixture",
      };
    },
    async extractFields() {
      throw new Error(EXTRACTION_ERROR_MESSAGE);
    },
    async proposeActions() {
      throw new Error("non deve essere raggiunto: l'estrazione fallisce prima");
    },
    async generateDraft() {
      throw new Error("non deve essere raggiunto");
    },
    async healthCheck() {
      return { ok: true, provider: "mock" };
    },
  };
  return {
    getCachedLLMProvider: () => provider,
    getLLMProvider: () => provider,
    resetCachedLLMProvider: () => {},
  };
});

import { prisma } from "@/lib/db/prisma";
import { processIncomingMessage } from "@/lib/pipeline/process-incoming-message";
import { PipelineExtractionError } from "@/lib/pipeline/types";

describe("processIncomingMessage — errore di estrazione", () => {
  let mailboxId: string;
  let threadId: string;
  let messageId: string;
  let extractionRunId: string | null = null;

  beforeAll(async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: { provider: "MICROSOFT365", displayName: "Test Extraction Error", emailAddress: "test-extraction-error@mizeta.it", status: "CONNECTED", isPec: false, externalAccountId: "test-extraction-error" },
    });
    mailboxId = mailbox.id;
    const thread = await prisma.emailThread.create({ data: { mailboxConnectionId: mailboxId, providerThreadId: "extraction-error-thread", subject: "Test" } });
    threadId = thread.id;
    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId,
        providerMessageId: "EXTRACTION-ERROR-001",
        direction: "INBOUND",
        fromAddress: "fornitore@test-fixture.it",
        toAddresses: ["test-extraction-error@mizeta.it"],
        ccAddresses: [],
        subject: "Fattura di test",
        bodyText: "Corpo di test, non rilevante: extractFields è mockato per lanciare comunque.",
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: false,
      },
    });
    messageId = message.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityType: "EmailMessage", entityId: messageId } });
    if (extractionRunId) await prisma.extractionRun.deleteMany({ where: { id: extractionRunId } });
    await prisma.emailMessage.delete({ where: { id: messageId } });
    await prisma.emailThread.delete({ where: { id: threadId } });
    await prisma.mailboxConnection.delete({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  it("scrive EXTRACTION_ERROR (non CLASSIFICATION_ERROR) e una ExtractionRun FAILED", async () => {
    await expect(processIncomingMessage(messageId)).rejects.toThrow(PipelineExtractionError);

    const audits = await prisma.auditLog.findMany({ where: { entityType: "EmailMessage", entityId: messageId } });
    expect(audits.some((a) => a.action === "EXTRACTION_ERROR")).toBe(true);
    expect(audits.some((a) => a.action === "CLASSIFICATION_ERROR")).toBe(false);

    const extractionRun = await prisma.extractionRun.findFirst({ where: { errorMessage: EXTRACTION_ERROR_MESSAGE }, orderBy: { createdAt: "desc" } });
    expect(extractionRun).toBeTruthy();
    expect(extractionRun?.status).toBe("FAILED");
    extractionRunId = extractionRun?.id ?? null;

    // Nessuna ClassificationRun FAILED: la classificazione stessa è riuscita.
    const classificationRuns = await prisma.classificationRun.findMany({ where: { emailMessageId: messageId } });
    expect(classificationRuns.every((c) => c.status !== "FAILED")).toBe(true);
  });
});
