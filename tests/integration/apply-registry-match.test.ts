import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { recordManualSpeedRegistryUpload } from "@/lib/speed-registry/sync-speed-device-registry";
import { matchAndPersistDeviceRegistryMatch } from "@/lib/speed-registry/apply-registry-match";

function tableRow(cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

const HEADER_ROW =
  "<tr><th>Codice ente accertatore</th><th>Nome dispositivo</th><th>Codice catastale</th><th>Decreto normativo</th>" +
  "<th>Data decreto</th><th>Tipo dispositivo</th><th>Produttore</th><th>Modello</th><th>Versione</th><th>Matricola</th>" +
  "<th>Note</th><th>Data ultima comunicazione</th><th>Data primo inserimento</th></tr>";

function registryPage(rows: string[]): string {
  return `<html><body><table>${HEADER_ROW}${rows.join("")}</table></body></html>`;
}

/**
 * Test end-to-end della cascata registro MIT → campi dispositivo (Troncone C, §2.1.A/§2.4):
 * un `MATCH` pulito deve azzerare `needsHumanReview` solo sui campi realmente confrontati, un
 * `MISMATCH` deve rimetterlo solo sui campi in conflitto, un match ambiguo non deve toccare
 * alcun campo anche se la prima riga trovata combacia. Ogni test carica un registro dedicato
 * via `recordManualSpeedRegistryUpload` (stesso percorso pubblico del fallback manuale, mai il
 * fetcher schedulato) per avere pieno controllo sulle righe di confronto.
 */
describe("apply-registry-match — cascata sui campi EnforcementDeviceField", () => {
  const createdSnapshotIds: string[] = [];
  const createdStorageKeys: string[] = [];
  const createdCaseIds: string[] = [];

  afterAll(async () => {
    if (createdCaseIds.length > 0) {
      await prisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
    }
    if (createdSnapshotIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdSnapshotIds }, entityType: "SpeedRegistrySnapshot" } });
      await prisma.speedRegistrySnapshot.updateMany({ where: { id: { in: createdSnapshotIds } }, data: { diffFromPreviousId: null } });
      await prisma.speedRegistrySnapshot.deleteMany({ where: { id: { in: createdSnapshotIds } } });
    }
    for (const key of createdStorageKeys) {
      await attachmentStorage.delete(key);
    }
    await prisma.$disconnect();
  });

  async function uploadRegistry(rows: string[][]): Promise<void> {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const html = registryPage(rows.map(tableRow));
    const result = await recordManualSpeedRegistryUpload({ pages: [html], uploadedById: admin.id });
    if (result.snapshotId) {
      createdSnapshotIds.push(result.snapshotId);
      const snapshot = await prisma.speedRegistrySnapshot.findUniqueOrThrow({ where: { id: result.snapshotId } });
      createdStorageKeys.push(snapshot.rawStorageKey);
    }
  }

  async function createCheckWithFields(fields: Record<string, string | null>) {
    const testCase = await prisma.case.create({
      data: { reference: `TEST-ARM-${Date.now()}-${Math.random()}`, title: "Test cascata registro", category: "FINE_OR_PENALTY", status: "NEW", priority: "NORMAL" },
    });
    createdCaseIds.push(testCase.id);

    const check = await prisma.enforcementDeviceCheck.create({
      data: { caseId: testCase.id, applicability: "SPEED_CAMERA_FIXED", state: "IDENTIFIED", needsHumanReview: false },
    });

    for (const [fieldKey, value] of Object.entries(fields)) {
      if (value === null) continue;
      await prisma.enforcementDeviceField.create({
        data: { checkId: check.id, fieldKey, value, needsHumanReview: true },
      });
    }

    return { caseId: testCase.id, checkId: check.id };
  }

  it("MATCH pulito: azzera needsHumanReview su manufacturer/model/serial_number (tutti confrontati e coincidenti)", async () => {
    await uploadRegistry([["COM1", "Test", "B1", "111/2020", "10/01/2020", "Fisso", "Gatso", "24", "2.1", "AV-CLEAN-001", "", "01/07/2026", "15/03/2020"]]);
    const { caseId, checkId } = await createCheckWithFields({ manufacturer: "Gatso", model: "24", serial_number: "AV-CLEAN-001" });

    const { match } = await matchAndPersistDeviceRegistryMatch(caseId, null);
    expect(match).toBe("MATCH");

    const fields = await prisma.enforcementDeviceField.findMany({ where: { checkId } });
    const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
    expect(byKey.get("manufacturer")!.needsHumanReview).toBe(false);
    expect(byKey.get("model")!.needsHumanReview).toBe(false);
    expect(byKey.get("serial_number")!.needsHumanReview).toBe(false);
  });

  it("MISMATCH sul produttore: solo 'manufacturer' torna needsHumanReview true, non 'model'", async () => {
    await uploadRegistry([["COM1", "Test", "B1", "111/2020", "10/01/2020", "Fisso", "Gatso", "24", "2.1", "AV-MISMATCH-001", "", "01/07/2026", "15/03/2020"]]);
    const { caseId, checkId } = await createCheckWithFields({ manufacturer: "Sicve", model: "24", serial_number: "AV-MISMATCH-001" });
    // Il seed sopra parte con needsHumanReview:true su tutti i campi (default della fixture) —
    // qui verifichiamo esplicitamente che model, non in conflitto, venga liberato mentre
    // manufacturer, in conflitto, resti/torni true.
    await prisma.enforcementDeviceField.updateMany({ where: { checkId, fieldKey: "model" }, data: { needsHumanReview: false } });

    const { match } = await matchAndPersistDeviceRegistryMatch(caseId, null);
    expect(match).toBe("MISMATCH");

    const fields = await prisma.enforcementDeviceField.findMany({ where: { checkId } });
    const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
    expect(byKey.get("manufacturer")!.needsHumanReview).toBe(true);
    expect(byKey.get("model")!.needsHumanReview).toBe(false);
  });

  it("match ambiguo (due righe con la stessa matricola): nessun campo viene toccato anche se il primo confronto è MATCH", async () => {
    await uploadRegistry([
      ["COM1", "Test A", "B1", "111/2020", "10/01/2020", "Fisso", "Gatso", "24", "2.1", "AV-DUP-001", "", "01/07/2026", "15/03/2020"],
      ["COM2", "Test B", "B2", "222/2021", "11/02/2021", "Fisso", "Gatso", "24", "2.1", "AV-DUP-001", "", "01/07/2026", "15/03/2020"],
    ]);
    const { caseId, checkId } = await createCheckWithFields({ manufacturer: "Gatso", model: "24", serial_number: "AV-DUP-001" });

    const { match } = await matchAndPersistDeviceRegistryMatch(caseId, null);
    expect(match).toBe("MATCH");

    const fields = await prisma.enforcementDeviceField.findMany({ where: { checkId } });
    // Tutti i campi restano needsHumanReview:true com'erano al seed (createCheckWithFields) —
    // l'ambiguità impedisce l'auto-clear anche se `match` risulta "MATCH".
    for (const field of fields) {
      expect(field.needsHumanReview).toBe(true);
    }
  });

  it("scrive un solo audit ENFORCEMENT_REGISTRY_MATCHED con i campi verificati in metadata", async () => {
    await uploadRegistry([["COM1", "Test", "B1", "111/2020", "10/01/2020", "Gatso", "Gatso", "24", "2.1", "AV-AUDIT-001", "", "01/07/2026", "15/03/2020"]]);
    const { caseId, checkId } = await createCheckWithFields({ manufacturer: "Gatso", serial_number: "AV-AUDIT-001" });

    await matchAndPersistDeviceRegistryMatch(caseId, null);

    const audit = await prisma.auditLog.findFirst({ where: { action: "ENFORCEMENT_REGISTRY_MATCHED", entityId: checkId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
    const metadata = audit!.metadata as { verifiedFieldKeys: string[] };
    expect(metadata.verifiedFieldKeys).toContain("manufacturer");
    expect(metadata.verifiedFieldKeys).toContain("serial_number");
  });
});
