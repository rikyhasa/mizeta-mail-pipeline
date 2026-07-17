import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { processIncomingMessage } from "@/lib/pipeline/process-incoming-message";

/**
 * Test end-to-end del passaggio di analisi dispositivo autovelox (docs/SPEC-AUTOVELOX-DRAFT.md
 * §4, §6, §7), verificato solo tramite l'orchestratore reale (mai chiamando direttamente il
 * persist layer): stessa metodologia di tests/integration/pipeline-orchestrator.test.ts, fixture
 * isolate create/rimosse da questo file, mai i fixture condivisi del seed.
 */
describe("processIncomingMessage — analisi dispositivo autovelox", () => {
  let mailboxId: string;
  const createdCaseIds: string[] = [];
  const createdMessageIds: string[] = [];
  const createdThreadIds: string[] = [];

  beforeAll(async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "Test Enforcement",
        emailAddress: "test-enforcement@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "test-enforcement",
      },
    });
    mailboxId = mailbox.id;
  });

  afterAll(async () => {
    if (createdCaseIds.length > 0) {
      await prisma.enforcementDeviceField.deleteMany({ where: { check: { caseId: { in: createdCaseIds } } } });
      await prisma.enforcementDeviceCheck.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.auditLog.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.actionProposalRun.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.extractionRun.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.classificationRun.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.caseDeadline.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.caseField.deleteMany({ where: { caseId: { in: createdCaseIds } } });
    }
    if (createdMessageIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { emailMessageId: { in: createdMessageIds } } });
      await prisma.classificationRun.deleteMany({ where: { emailMessageId: { in: createdMessageIds } } });
      await prisma.emailMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    }
    if (createdCaseIds.length > 0) {
      await prisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
    }
    if (createdThreadIds.length > 0) {
      await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    }
    await prisma.mailboxConnection.delete({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  async function createMessage(params: { providerMessageId: string; providerThreadId: string; subject: string; bodyText: string }) {
    const thread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailboxId, providerThreadId: params.providerThreadId, subject: params.subject },
    });
    createdThreadIds.push(thread.id);

    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId: thread.id,
        providerMessageId: params.providerMessageId,
        internetMessageId: `<${params.providerMessageId}@test.local>`,
        direction: "INBOUND",
        fromAddress: "comune@test-fixture.it",
        toAddresses: ["test-enforcement@mizeta.it"],
        ccAddresses: [],
        subject: params.subject,
        bodyText: params.bodyText,
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: false,
      },
    });
    createdMessageIds.push(message.id);
    return message;
  }

  it("crea EnforcementDeviceCheck + EnforcementDeviceField quando il verbale nomina un autovelox", async () => {
    const message = await createMessage({
      providerMessageId: "TEST-FINE-DEVICE-001",
      providerThreadId: "test-thread-fine-device-001",
      subject: "Verbale n. 2026/00123",
      bodyText:
        "Verbale di accertamento violazione del Codice della Strada. Infrazione rilevata tramite autovelox Gatso, " +
        "matricola n. AV-2020-0456, installato sulla SS16. Importo ridotto 150,00 EUR entro 5 giorni.",
    });

    const result = await processIncomingMessage(message.id);
    const updatedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updatedMessage.caseId).toBeTruthy();
    createdCaseIds.push(updatedMessage.caseId!);

    expect(result.classificationCategory).toBe("FINE_OR_PENALTY");
    expect(result.enforcementDeviceAnalysis).not.toBeNull();

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId: updatedMessage.caseId! } });
    expect(check).not.toBeNull();
    expect(check?.applicability).toBe("SPEED_CAMERA_FIXED");
    expect(check?.needsHumanReview).toBe(true);

    const fields = await prisma.enforcementDeviceField.findMany({ where: { checkId: check!.id } });
    expect(fields.find((f) => f.fieldKey === "manufacturer")?.value).toBe("gatso");
    expect(fields.find((f) => f.fieldKey === "serial_number")?.value).toBe("AV-2020-0456");

    const extractionRuns = await prisma.extractionRun.findMany({ where: { caseId: updatedMessage.caseId! } });
    expect(extractionRuns.length).toBeGreaterThanOrEqual(2);
  });

  it("non crea alcun EnforcementDeviceCheck quando il verbale non riguarda la velocità (NOT_APPLICABLE)", async () => {
    const message = await createMessage({
      providerMessageId: "TEST-FINE-DEVICE-002",
      providerThreadId: "test-thread-fine-device-002",
      subject: "Verbale n. 2026/00456",
      bodyText: "Verbale di accertamento per sosta vietata in violazione del Codice della Strada. Importo ridotto 42,00 EUR entro 5 giorni.",
    });

    const result = await processIncomingMessage(message.id);
    const updatedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updatedMessage.caseId).toBeTruthy();
    createdCaseIds.push(updatedMessage.caseId!);

    expect(result.classificationCategory).toBe("FINE_OR_PENALTY");
    expect(result.enforcementDeviceAnalysis?.data.applicability.value).toBe("NOT_APPLICABLE");

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId: updatedMessage.caseId! } });
    expect(check).toBeNull();
  });

  it("non esegue l'analisi dispositivo per categorie diverse da FINE_OR_PENALTY", async () => {
    const message = await createMessage({
      providerMessageId: "TEST-FINE-DEVICE-003",
      providerThreadId: "test-thread-fine-device-003",
      subject: "Fattura FAT-2099-9001",
      bodyText: "In allegato la fattura FAT-2099-9001. Imponibile 100,00 EUR, IVA 22,00 EUR, totale 122,00 EUR. Scadenza 01/09/2026.",
    });

    const result = await processIncomingMessage(message.id);
    const updatedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updatedMessage.caseId).toBeTruthy();
    createdCaseIds.push(updatedMessage.caseId!);

    expect(result.classificationCategory).not.toBe("FINE_OR_PENALTY");
    expect(result.enforcementDeviceAnalysis).toBeNull();

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId: updatedMessage.caseId! } });
    expect(check).toBeNull();
  });
});
