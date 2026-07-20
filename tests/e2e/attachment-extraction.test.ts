import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { extractMessageAttachments } from "@/lib/attachments/extract-message-attachments";
import { loadCaseMessages, processIncomingMessage } from "@/lib/pipeline/process-incoming-message";
import { buildMinimalPdf } from "../helpers/build-minimal-pdf";

const FATTURA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>AutoService Ricambi S.r.l.</Denominazione></Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-07-14</Data>
        <Numero>FAT-2026-E2E-001</Numero>
        <ImportoTotaleDocumento>1464.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DatiRiepilogo><ImponibileImporto>1200.00</ImponibileImporto><Imposta>264.00</Imposta></DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <DettaglioPagamento><DataScadenzaPagamento>2026-07-28</DataScadenzaPagamento><IBAN>IT60X0542811101000000123456</IBAN></DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

/**
 * FASE 10 (docs/FASE-10-LETTURA-ALLEGATI.md) end-to-end: allegati REALI (PDF/XML, non fixture
 * mock testuali) dall'ingestione simulata fino ai `CaseField` persistiti, verificando
 * `source_page` per un PDF multi-pagina e il merge dei campi strutturati per una fattura
 * elettronica XML — mai esercitato dalle fixture mock/seed, che sono già testo pronto.
 */
describe("E2E — estrazione reale degli allegati (FASE 10)", () => {
  let mailboxId: string;
  const threadIds: string[] = [];
  const messageIds: string[] = [];
  const caseIds: string[] = [];

  beforeAll(async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "E2E Estrazione Allegati",
        emailAddress: "e2e-attachments@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "e2e-attachments",
      },
    });
    mailboxId = mailbox.id;
  });

  afterAll(async () => {
    if (caseIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.actionProposalRun.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.extractionRun.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.classificationRun.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.caseDeadline.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.caseField.deleteMany({ where: { caseId: { in: caseIds } } });
    }
    if (messageIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { emailMessageId: { in: messageIds } } });
      await prisma.classificationRun.deleteMany({ where: { emailMessageId: { in: messageIds } } });
      await prisma.emailMessage.deleteMany({ where: { id: { in: messageIds } } });
    }
    if (caseIds.length > 0) await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
    if (threadIds.length > 0) await prisma.emailThread.deleteMany({ where: { id: { in: threadIds } } });
    await prisma.mailboxConnection.delete({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  async function createMessageWithAttachment(params: {
    providerMessageId: string;
    subject: string;
    bodyText: string;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }) {
    const thread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailboxId, providerThreadId: `thread-${params.providerMessageId}`, subject: params.subject },
    });
    threadIds.push(thread.id);

    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId: thread.id,
        providerMessageId: params.providerMessageId,
        direction: "INBOUND",
        fromAddress: "fornitore@e2e-fixture.it",
        toAddresses: ["e2e-attachments@mizeta.it"],
        ccAddresses: [],
        subject: params.subject,
        bodyText: params.bodyText,
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: true,
      },
    });
    messageIds.push(message.id);

    const storageKey = `e2e-attachments/${message.id}/${params.fileName}`;
    await attachmentStorage.put(storageKey, params.content);
    await prisma.attachment.create({
      data: { emailMessageId: message.id, fileName: params.fileName, mimeType: params.mimeType, sizeBytes: params.content.length, storageKey },
    });

    return message;
  }

  it("PDF multi-pagina reale: il testo estratto preserva i marcatori di pagina che il provider reale usa per popolare source_page", async () => {
    const pdf = buildMinimalPdf([
      "Pagina uno: informazioni generali sul reclamo, nessun dato economico qui.",
      "Pagina due: importo richiesto 450.00 EUR per il danno alla merce in transito.",
    ]);
    const message = await createMessageWithAttachment({
      providerMessageId: "E2E-ATT-PDF-001",
      subject: "Reclamo con documento allegato",
      bodyText: "In allegato il dettaglio del reclamo su due pagine.",
      fileName: "dettaglio-reclamo.pdf",
      mimeType: "application/pdf",
      content: pdf,
    });

    await extractMessageAttachments(message.id);
    const attachment = await prisma.attachment.findFirstOrThrow({ where: { emailMessageId: message.id } });
    expect(attachment.extractionMethod).toBe("LOCAL_TEXT");
    expect(attachment.pageCount).toBe(2);
    const pages = attachment.extractedPages as { page: number; text: string }[];
    expect(pages).toHaveLength(2);
    expect(pages[1].text).toContain("450.00 EUR");

    await processIncomingMessage(message.id);
    const processedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    const caseId = processedMessage.caseId!;
    caseIds.push(caseId);
    expect(processedMessage.caseId).toBeTruthy();

    // Verifica quello che il modello vedrebbe davvero: il testo ricostruito dal DB include i
    // marcatori di pagina espliciti, con l'importo nella sezione della pagina 2 — il motore
    // euristico mock non popola source_page (nessuna comprensione reale del testo), ma
    // buildExtractionSystemPrompt istruisce il provider Anthropic a farlo da questi marcatori.
    const [caseMessage] = await loadCaseMessages(caseId);
    const rebuiltAttachment = caseMessage.attachments.find((a) => a.attachmentId === attachment.id);
    expect(rebuiltAttachment?.isReadable).toBe(true);
    expect(rebuiltAttachment?.text).toContain("--- pagina 2 ---");
    const secondPageIndex = rebuiltAttachment!.text!.indexOf("--- pagina 2 ---");
    expect(rebuiltAttachment!.text!.slice(secondPageIndex)).toContain("450.00 EUR");
  });

  it("fattura elettronica XML: i campi vengono sovrascritti con confidenza 1.0 da un parser deterministico, non dedotti dall'LLM", async () => {
    const message = await createMessageWithAttachment({
      providerMessageId: "E2E-ATT-XML-001",
      subject: "Fattura FAT-2026-E2E-001",
      bodyText: "In allegato la fattura elettronica.",
      fileName: "FAT-2026-E2E-001.xml",
      mimeType: "application/xml",
      content: Buffer.from(FATTURA_XML, "utf-8"),
    });

    await extractMessageAttachments(message.id);
    const attachment = await prisma.attachment.findFirstOrThrow({ where: { emailMessageId: message.id } });
    expect(attachment.extractionMethod).toBe("STRUCTURED");
    expect(attachment.structuredFields).toMatchObject({ invoice_number: "FAT-2026-E2E-001", amount_total: 1464 });

    await processIncomingMessage(message.id);
    const processedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    caseIds.push(processedMessage.caseId!);
    expect(processedMessage.caseId).toBeTruthy();

    const finalCase = await prisma.case.findUniqueOrThrow({ where: { id: processedMessage.caseId! } });
    expect(finalCase.category).toBe("SUPPLIER_INVOICE");

    const invoiceNumberField = await prisma.caseField.findFirstOrThrow({
      where: { caseId: processedMessage.caseId!, fieldKey: "invoice_number" },
    });
    expect(invoiceNumberField.value).toBe("FAT-2026-E2E-001");
    expect(invoiceNumberField.sourceType).toBe("ATTACHMENT_STRUCTURED");
    expect(invoiceNumberField.confidence).toBe(1);
    expect(invoiceNumberField.needsHumanReview).toBe(false);

    const amountTotalField = await prisma.caseField.findFirstOrThrow({
      where: { caseId: processedMessage.caseId!, fieldKey: "amount_total" },
    });
    expect(amountTotalField.value).toBe("1464");
    expect(amountTotalField.sourceType).toBe("ATTACHMENT_STRUCTURED");

    const ibanField = await prisma.caseField.findFirstOrThrow({ where: { caseId: processedMessage.caseId!, fieldKey: "iban" } });
    expect(ibanField.value).toBe("IT60X0542811101000000123456");
    expect(ibanField.sourceType).toBe("ATTACHMENT_STRUCTURED");
  });
});
