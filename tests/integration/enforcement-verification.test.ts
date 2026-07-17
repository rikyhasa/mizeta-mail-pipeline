import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
import { PATCH as patchCheck } from "@/app/api/cases/[id]/enforcement/check/route";
import { PATCH as patchField } from "@/app/api/cases/[id]/enforcement/fields/[fieldKey]/route";
import { PATCH as patchDocument } from "@/app/api/cases/[id]/enforcement/documents/[documentType]/route";
import { POST as postRequestDocuments } from "@/app/api/cases/[id]/enforcement/request-documents/route";
import { POST as postTechnicalReview } from "@/app/api/cases/[id]/enforcement/technical-review/route";
import { POST as postLegalEscalate } from "@/app/api/cases/[id]/enforcement/legal-escalate/route";

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Test end-to-end dei 6 endpoint del pannello di verifica autovelox (docs/SPEC-AUTOVELOX-DRAFT.md
 * §8, FASE E Tappa 6), stesso pattern di tests/integration/appeal-decision.test.ts (mock di
 * next/headers per simulare sessioni reali, mai bypassare withPermission/requirePermission).
 * Fixture isolate create/rimosse da questo file.
 */
describe("Endpoint pannello verifica autovelox", () => {
  let adminId: string;
  let operationsId: string;
  let readOnlyId: string;
  let caseWithCheckId: string;
  let checkId: string;
  let caseWithoutCheckId: string;
  let attachmentId: string;
  let foreignAttachmentId: string;
  const createdMessageIds: string[] = [];
  const createdThreadIds: string[] = [];
  let mailboxId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const operations = await prisma.user.findFirstOrThrow({ where: { role: "OPERATIONS" } });
    const readOnly = await prisma.user.findFirstOrThrow({ where: { role: "READ_ONLY" } });
    adminId = admin.id;
    operationsId = operations.id;
    readOnlyId = readOnly.id;

    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "Test Enforcement Verification",
        emailAddress: "test-enforcement-verification@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "test-enforcement-verification",
      },
    });
    mailboxId = mailbox.id;

    const caseWithCheck = await prisma.case.create({
      data: { reference: `TEST-ENF-${Date.now()}`, title: "Multa di test con controllo", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
    });
    caseWithCheckId = caseWithCheck.id;

    const thread = await prisma.emailThread.create({ data: { mailboxConnectionId: mailboxId, providerThreadId: "enf-verif-thread-1", subject: "Test" } });
    createdThreadIds.push(thread.id);
    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId: thread.id,
        caseId: caseWithCheckId,
        providerMessageId: "ENF-VERIF-001",
        direction: "INBOUND",
        fromAddress: "comune@test-fixture.it",
        toAddresses: ["test-enforcement-verification@mizeta.it"],
        ccAddresses: [],
        subject: "Verbale",
        bodyText: "Verbale di test.",
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: true,
      },
    });
    createdMessageIds.push(message.id);
    const attachment = await prisma.attachment.create({
      data: { emailMessageId: message.id, fileName: "decreto.pdf", mimeType: "application/pdf", sizeBytes: 100, storageKey: "test/decreto.pdf" },
    });
    attachmentId = attachment.id;

    const otherCase = await prisma.case.create({
      data: { reference: `TEST-ENF-OTHER-${Date.now()}`, title: "Altra pratica", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
    });
    const otherThread = await prisma.emailThread.create({ data: { mailboxConnectionId: mailboxId, providerThreadId: "enf-verif-thread-2", subject: "Altra" } });
    createdThreadIds.push(otherThread.id);
    const otherMessage = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId: otherThread.id,
        caseId: otherCase.id,
        providerMessageId: "ENF-VERIF-002",
        direction: "INBOUND",
        fromAddress: "comune@test-fixture.it",
        toAddresses: ["test-enforcement-verification@mizeta.it"],
        ccAddresses: [],
        subject: "Altra pratica",
        bodyText: "Altro verbale.",
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: true,
      },
    });
    createdMessageIds.push(otherMessage.id);
    const foreignAttachment = await prisma.attachment.create({
      data: { emailMessageId: otherMessage.id, fileName: "estraneo.pdf", mimeType: "application/pdf", sizeBytes: 100, storageKey: "test/estraneo.pdf" },
    });
    foreignAttachmentId = foreignAttachment.id;

    const check = await prisma.enforcementDeviceCheck.create({
      data: { caseId: caseWithCheckId, applicability: "SPEED_CAMERA_FIXED", state: "TO_BE_IDENTIFIED", needsHumanReview: true },
    });
    checkId = check.id;
    await prisma.enforcementDeviceField.create({
      data: { checkId, fieldKey: "manufacturer", value: "Gatso", needsHumanReview: true },
    });
    await prisma.enforcementDeviceField.create({
      data: { checkId, fieldKey: "model", value: null, needsHumanReview: true },
    });

    const caseWithoutCheck = await prisma.case.create({
      data: { reference: `TEST-ENF-NOCHECK-${Date.now()}`, title: "Multa senza controllo", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
    });
    caseWithoutCheckId = caseWithoutCheck.id;
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { caseId: { in: [caseWithCheckId, caseWithoutCheckId] } } });
    await prisma.emailDraft.deleteMany({ where: { caseId: caseWithCheckId } });
    await prisma.enforcementDocumentCheck.deleteMany({ where: { checkId } });
    await prisma.enforcementDeviceField.deleteMany({ where: { checkId } });
    await prisma.enforcementDeviceCheck.deleteMany({ where: { caseId: { in: [caseWithCheckId, caseWithoutCheckId] } } });
    await prisma.attachment.deleteMany({ where: { id: { in: [attachmentId, foreignAttachmentId] } } });
    await prisma.emailMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    await prisma.case.deleteMany({ where: { reference: { contains: "TEST-ENF-" } } });
    await prisma.mailboxConnection.delete({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  describe("PATCH /enforcement/check", () => {
    it("rejects a READ_ONLY user with 403", async () => {
      await createSession(readOnlyId);
      const res = await patchCheck(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(403);
    });

    it("returns 404 when no check exists for the case", async () => {
      await createSession(adminId);
      const res = await patchCheck(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithoutCheckId }) });
      expect(res.status).toBe(404);
    });

    it("rejects confirming an identification that is still TO_BE_IDENTIFIED", async () => {
      await prisma.enforcementDeviceCheck.update({ where: { caseId: caseWithCheckId }, data: { applicability: "TO_BE_IDENTIFIED" } });
      await createSession(adminId);
      const res = await patchCheck(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(422);
      await prisma.enforcementDeviceCheck.update({ where: { caseId: caseWithCheckId }, data: { applicability: "SPEED_CAMERA_FIXED" } });
    });

    it("confirms the existing applicability, stamping confirmedById/At and writing audit", async () => {
      await createSession(operationsId);
      const res = await patchCheck(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.check.applicability).toBe("SPEED_CAMERA_FIXED");
      expect(body.check.state).toBe("IDENTIFIED");
      expect(body.check.confirmedById).toBe(operationsId);
      expect(body.check.needsHumanReview).toBe(false);

      const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_DEVICE_CONFIRMED", caseId: caseWithCheckId }, orderBy: { createdAt: "desc" } });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(operationsId);
    });

    it("corrects the applicability to a different value", async () => {
      await createSession(adminId);
      const res = await patchCheck(jsonRequest("PATCH", { applicability: "SPEED_CAMERA_MOBILE" }), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.check.applicability).toBe("SPEED_CAMERA_MOBILE");

      const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_DEVICE_CONFIRMED", caseId: caseWithCheckId }, orderBy: { createdAt: "desc" } });
      expect((audit?.metadata as { from: string; to: string } | null)?.from).toBe("SPEED_CAMERA_FIXED");
      expect((audit?.metadata as { from: string; to: string } | null)?.to).toBe("SPEED_CAMERA_MOBILE");

      await prisma.enforcementDeviceCheck.update({ where: { caseId: caseWithCheckId }, data: { applicability: "SPEED_CAMERA_FIXED" } });
    });
  });

  describe("PATCH /enforcement/fields/[fieldKey]", () => {
    it("rejects confirming a field with no value (P0-style guard)", async () => {
      await createSession(adminId);
      const res = await patchField(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithCheckId, fieldKey: "model" }) });
      expect(res.status).toBe(422);
    });

    it("returns 404 for an unknown fieldKey", async () => {
      await createSession(adminId);
      const res = await patchField(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithCheckId, fieldKey: "not_a_real_field" }) });
      expect(res.status).toBe(404);
    });

    it("confirms an existing value and writes FIELD_CONFIRMED", async () => {
      await createSession(adminId);
      const res = await patchField(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseWithCheckId, fieldKey: "manufacturer" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.field.needsHumanReview).toBe(false);
      const audit = await prisma.auditLog.findFirst({ where: { action: "FIELD_CONFIRMED", caseId: caseWithCheckId }, orderBy: { createdAt: "desc" } });
      expect(audit).toBeTruthy();
    });

    it("corrects a value and writes FIELD_UPDATED", async () => {
      await createSession(adminId);
      const res = await patchField(jsonRequest("PATCH", { value: "T-Explorer" }), { params: Promise.resolve({ id: caseWithCheckId, fieldKey: "manufacturer" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.field.value).toBe("T-Explorer");
      const audit = await prisma.auditLog.findFirst({ where: { action: "FIELD_UPDATED", caseId: caseWithCheckId }, orderBy: { createdAt: "desc" } });
      expect(audit).toBeTruthy();
    });
  });

  describe("PATCH /enforcement/documents/[documentType]", () => {
    it("returns 400 for an invalid document type", async () => {
      await createSession(adminId);
      const res = await patchDocument(jsonRequest("PATCH", { attachmentId }), {
        params: Promise.resolve({ id: caseWithCheckId, documentType: "NOT_A_TYPE" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 when the attachment does not belong to this case", async () => {
      await createSession(adminId);
      const res = await patchDocument(jsonRequest("PATCH", { attachmentId: foreignAttachmentId }), {
        params: Promise.resolve({ id: caseWithCheckId, documentType: "APPROVAL_OR_HOMOLOGATION_DECREE" }),
      });
      expect(res.status).toBe(404);
    });

    it("links an attachment, sets status PRESENT, and writes ENFORCEMENT_DOCUMENT_LINKED", async () => {
      await createSession(adminId);
      const res = await patchDocument(jsonRequest("PATCH", { attachmentId }), {
        params: Promise.resolve({ id: caseWithCheckId, documentType: "APPROVAL_OR_HOMOLOGATION_DECREE" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.documentCheck.status).toBe("PRESENT");
      expect(body.documentCheck.attachmentId).toBe(attachmentId);

      const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_DOCUMENT_LINKED", caseId: caseWithCheckId } });
      expect(audit).toBeTruthy();
    });
  });

  describe("POST /enforcement/request-documents", () => {
    it("returns 404 when no check exists for the case", async () => {
      await createSession(adminId);
      const res = await postRequestDocuments(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithoutCheckId }) });
      expect(res.status).toBe(404);
    });

    it("creates a documentation-request draft, marks missing types REQUESTED, and audits", async () => {
      await createSession(operationsId);
      const res = await postRequestDocuments(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.draftId).toBeTruthy();

      const draft = await prisma.emailDraft.findUniqueOrThrow({ where: { id: body.draftId } });
      expect(draft.status).toBe("PENDING_APPROVAL");
      expect(draft.bodyText).toContain("Certificato di taratura");
      // Il decreto è già PRESENT (test precedente): non deve comparire fra i richiesti.
      expect(draft.bodyText).not.toContain("Decreto di approvazione/omologazione");

      const requestedDocs = await prisma.enforcementDocumentCheck.findMany({ where: { checkId, status: "REQUESTED" } });
      expect(requestedDocs.length).toBeGreaterThan(0);

      const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_DOCUMENTATION_REQUESTED", caseId: caseWithCheckId } });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(operationsId);
    });

    it("rejects a READ_ONLY user with 403", async () => {
      await createSession(readOnlyId);
      const res = await postRequestDocuments(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /enforcement/technical-review", () => {
    it("rejects a READ_ONLY user with 403", async () => {
      await createSession(readOnlyId);
      const res = await postTechnicalReview(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(403);
    });

    it("allows OPERATIONS, sets state TO_BE_VERIFIED and writes audit", async () => {
      await createSession(operationsId);
      const res = await postTechnicalReview(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.check.state).toBe("TO_BE_VERIFIED");
      expect(body.check.needsHumanReview).toBe(true);

      const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_TECHNICAL_REVIEW_REQUESTED", caseId: caseWithCheckId } });
      expect(audit).toBeTruthy();
    });
  });

  describe("POST /enforcement/legal-escalate", () => {
    it("rejects OPERATIONS with 403 (ADMIN only, per docs/SPEC-AUTOVELOX-DRAFT.md §9)", async () => {
      await createSession(operationsId);
      const res = await postLegalEscalate(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(403);
    });

    it("allows ADMIN, sets state REQUIRES_LEGAL_REVIEW + needsLegalReview and writes audit", async () => {
      await createSession(adminId);
      const res = await postLegalEscalate(jsonRequest("POST"), { params: Promise.resolve({ id: caseWithCheckId }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.check.state).toBe("REQUIRES_LEGAL_REVIEW");
      expect(body.check.needsLegalReview).toBe(true);

      const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_LEGAL_ESCALATED", caseId: caseWithCheckId } });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(adminId);
    });
  });
});
