import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    has: (name: string) => cookieStore.has(name),
  }),
}));

import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { POST as postDocument } from "@/app/api/cases/[id]/documents/route";
import { GET as getDocument } from "@/app/api/cases/[id]/documents/[documentId]/route";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { closeSharedBrowser } from "@/lib/adapters/documents/puppeteer-document-service";

function request(body: unknown): Request {
  return new Request("http://localhost/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("Generazione documenti (SPEC.md §12)", () => {
  let caseId: string;
  const createdDocumentIds: string[] = [];

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityType: "GeneratedDocument", entityId: { in: createdDocumentIds } } });
    await prisma.generatedDocument.deleteMany({ where: { id: { in: createdDocumentIds } } });
    await prisma.caseField.deleteMany({ where: { caseId } });
    await prisma.case.delete({ where: { id: caseId } });
    await closeSharedBrowser();
    await prisma.$disconnect();
  });

  it(
    "genera una scheda preventivo reale in PDF via Puppeteer, la salva e la rende scaricabile",
    async () => {
      const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
      await createSession(admin.id);

      const createdCase = await prisma.case.create({
        data: { reference: `TEST-DOC-${Date.now()}`, title: "Preventivo di test", category: "QUOTE_REQUEST", status: "NEW", priority: "NORMAL" },
      });
      caseId = createdCase.id;
      await prisma.caseField.create({
        data: { caseId, fieldKey: "customer_name", value: "Cliente Documenti Srl", needsHumanReview: false },
      });

      const response = await postDocument(request({ type: "QUOTE_SHEET", format: "PDF" }), { params: Promise.resolve({ id: caseId }) });
      expect(response.status).toBe(201);
      const { document } = await response.json();
      createdDocumentIds.push(document.id);
      expect(document.storageKey).toBeTruthy();

      const bytes = await attachmentStorage.get(document.storageKey);
      expect(bytes.length).toBeGreaterThan(0);
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");

      const audit = await prisma.auditLog.findFirst({ where: { action: "DOCUMENT_GENERATED", entityId: document.id } });
      expect(audit).toBeTruthy();

      const downloadResponse = await getDocument(new Request("http://localhost/test"), { params: Promise.resolve({ id: caseId, documentId: document.id }) });
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers.get("Content-Type")).toBe("application/pdf");
    },
    30_000,
  );

  it("un tipo non implementato in questa fase risponde 501", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);
    const response = await postDocument(request({ type: "DAILY_BRIEFING" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(501);
  });

  it("un utente READ_ONLY non può generare documenti (case:write richiesto)", async () => {
    const readOnly = await prisma.user.findFirstOrThrow({ where: { role: "READ_ONLY" } });
    await createSession(readOnly.id);
    const response = await postDocument(request({ type: "QUOTE_SHEET" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(403);
  });
});
