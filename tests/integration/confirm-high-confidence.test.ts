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
import { POST as postConfirmFields } from "@/app/api/cases/[id]/fields/confirm-high-confidence/route";
import { POST as postConfirmEnforcementFields } from "@/app/api/cases/[id]/enforcement/fields/confirm-high-confidence/route";

function emptyRequest() {
  return new Request("http://localhost/test", { method: "POST" });
}

/**
 * Test end-to-end del bulk-confirm (Troncone C, §2.1.B/§2.2/§2.3): la popolazione eleggibile è
 * esattamente il tier "middle" (valore presente, needsHumanReview già false, non ancora
 * confermato) — mai i campi "problematic" (bassa confidenza/vuoti) né quelli già "confirmed".
 * Stesso pattern di tests/integration/case-detail-actions.test.ts e
 * tests/integration/enforcement-verification.test.ts (mock di next/headers per sessioni reali).
 */
describe("Bulk-confirm dati ad alta confidenza", () => {
  let adminId: string;
  let operationsId: string;
  let readOnlyId: string;
  const createdCaseIds: string[] = [];

  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const operations = await prisma.user.findFirstOrThrow({ where: { role: "OPERATIONS" } });
    const readOnly = await prisma.user.findFirstOrThrow({ where: { role: "READ_ONLY" } });
    adminId = admin.id;
    operationsId = operations.id;
    readOnlyId = readOnly.id;
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    if (createdCaseIds.length > 0) {
      await prisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
    }
    await prisma.$disconnect();
  });

  describe("CaseField generico (POST /api/cases/[id]/fields/confirm-high-confidence)", () => {
    it("conferma solo i campi 'middle' (valore presente, needsHumanReview false, non confermato)", async () => {
      const testCase = await prisma.case.create({
        data: { reference: `TEST-BULK-CF-${Date.now()}`, title: "Test bulk-confirm campi", category: "QUOTE_REQUEST", status: "NEW", priority: "NORMAL" },
      });
      createdCaseIds.push(testCase.id);

      await prisma.caseField.createMany({
        data: [
          { caseId: testCase.id, fieldKey: "middle_field_1", value: "Valore A", needsHumanReview: false },
          { caseId: testCase.id, fieldKey: "middle_field_2", value: "Valore B", needsHumanReview: false },
          { caseId: testCase.id, fieldKey: "problematic_field", value: "Valore C", needsHumanReview: true },
          { caseId: testCase.id, fieldKey: "empty_field", value: null, needsHumanReview: true },
          { caseId: testCase.id, fieldKey: "already_confirmed", value: "Valore D", needsHumanReview: false, confirmedById: adminId, confirmedAt: new Date() },
        ],
      });

      await createSession(adminId);
      const response = await postConfirmFields(emptyRequest(), { params: Promise.resolve({ id: testCase.id }) });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.confirmedCount).toBe(2);
      expect(new Set(body.fieldKeys)).toEqual(new Set(["middle_field_1", "middle_field_2"]));

      const fields = await prisma.caseField.findMany({ where: { caseId: testCase.id } });
      const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
      expect(byKey.get("middle_field_1")!.confirmedById).toBe(adminId);
      expect(byKey.get("middle_field_2")!.confirmedById).toBe(adminId);
      expect(byKey.get("problematic_field")!.confirmedById).toBeNull();
      expect(byKey.get("empty_field")!.confirmedById).toBeNull();

      const auditCount = await prisma.auditLog.count({ where: { action: "FIELD_CONFIRMED", caseId: testCase.id, actorId: adminId } });
      expect(auditCount).toBe(2);
    });

    it("nessun campo eleggibile: confirmedCount 0, nessun audit scritto", async () => {
      const testCase = await prisma.case.create({
        data: { reference: `TEST-BULK-CF-EMPTY-${Date.now()}`, title: "Test bulk-confirm vuoto", category: "QUOTE_REQUEST", status: "NEW", priority: "NORMAL" },
      });
      createdCaseIds.push(testCase.id);
      await prisma.caseField.create({ data: { caseId: testCase.id, fieldKey: "only_problematic", value: null, needsHumanReview: true } });

      await createSession(adminId);
      const response = await postConfirmFields(emptyRequest(), { params: Promise.resolve({ id: testCase.id }) });
      const body = await response.json();
      expect(body.confirmedCount).toBe(0);
    });

    it("rifiuta un utente READ_ONLY con 403", async () => {
      const testCase = await prisma.case.create({
        data: { reference: `TEST-BULK-CF-RO-${Date.now()}`, title: "Test permessi", category: "QUOTE_REQUEST", status: "NEW", priority: "NORMAL" },
      });
      createdCaseIds.push(testCase.id);

      await createSession(readOnlyId);
      const response = await postConfirmFields(emptyRequest(), { params: Promise.resolve({ id: testCase.id }) });
      expect(response.status).toBe(403);
    });
  });

  describe("EnforcementDeviceField (POST /api/cases/[id]/enforcement/fields/confirm-high-confidence)", () => {
    it("conferma solo i campi dispositivo 'middle', permesso enforcement:confirm", async () => {
      const testCase = await prisma.case.create({
        data: { reference: `TEST-BULK-ENF-${Date.now()}`, title: "Test bulk-confirm dispositivo", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
      });
      createdCaseIds.push(testCase.id);

      const check = await prisma.enforcementDeviceCheck.create({
        data: { caseId: testCase.id, applicability: "SPEED_CAMERA_FIXED", state: "IDENTIFIED", needsHumanReview: false },
      });
      await prisma.enforcementDeviceField.createMany({
        data: [
          { checkId: check.id, fieldKey: "manufacturer", value: "Gatso", needsHumanReview: false },
          { checkId: check.id, fieldKey: "serial_number", value: "AV-1", needsHumanReview: true },
        ],
      });

      await createSession(operationsId);
      const response = await postConfirmEnforcementFields(emptyRequest(), { params: Promise.resolve({ id: testCase.id }) });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.confirmedCount).toBe(1);
      expect(body.fieldKeys).toEqual(["manufacturer"]);

      const fields = await prisma.enforcementDeviceField.findMany({ where: { checkId: check.id } });
      const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
      expect(byKey.get("manufacturer")!.confirmedById).toBe(operationsId);
      expect(byKey.get("serial_number")!.confirmedById).toBeNull();
    });

    it("404 quando la pratica non ha alcun EnforcementDeviceCheck", async () => {
      const testCase = await prisma.case.create({
        data: { reference: `TEST-BULK-ENF-404-${Date.now()}`, title: "Test senza check", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
      });
      createdCaseIds.push(testCase.id);

      await createSession(adminId);
      const response = await postConfirmEnforcementFields(emptyRequest(), { params: Promise.resolve({ id: testCase.id }) });
      expect(response.status).toBe(404);
    });

    it("rifiuta un utente READ_ONLY con 403", async () => {
      const testCase = await prisma.case.create({
        data: { reference: `TEST-BULK-ENF-RO-${Date.now()}`, title: "Test permessi dispositivo", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
      });
      createdCaseIds.push(testCase.id);

      await createSession(readOnlyId);
      const response = await postConfirmEnforcementFields(emptyRequest(), { params: Promise.resolve({ id: testCase.id }) });
      expect(response.status).toBe(403);
    });
  });
});
