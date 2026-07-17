import { describe, expect, it } from "vitest";
import { diffDeviceLists } from "@/lib/speed-registry/diff-devices";
import type { SpeedRegistryDeviceRow } from "@/lib/speed-registry/types";

function device(overrides: Partial<SpeedRegistryDeviceRow>): SpeedRegistryDeviceRow {
  return {
    accertatoreCode: "COM1",
    deviceName: "Dispositivo",
    cadastralCode: "B1",
    decreeNumber: "1/2020",
    decreeDate: "01/01/2020",
    deviceType: "Fisso",
    manufacturer: "Gatso",
    model: "24",
    version: "1.0",
    serialNumber: "AV-1",
    notes: null,
    lastCommunicationDate: "01/01/2026",
    firstRegisteredDate: "01/01/2020",
    ...overrides,
  };
}

describe("diffDeviceLists", () => {
  it("nessuna differenza fra due liste identiche", () => {
    const list = [device({ serialNumber: "AV-1" }), device({ serialNumber: "AV-2" })];
    const diff = diffDeviceLists(list, list);
    expect(diff).toMatchObject({ addedCount: 0, removedCount: 0, changedCount: 0 });
  });

  it("rileva un dispositivo aggiunto", () => {
    const previous = [device({ serialNumber: "AV-1" })];
    const current = [device({ serialNumber: "AV-1" }), device({ serialNumber: "AV-2" })];
    const diff = diffDeviceLists(previous, current);
    expect(diff.addedCount).toBe(1);
    expect(diff.removedCount).toBe(0);
  });

  it("rileva un dispositivo rimosso", () => {
    const previous = [device({ serialNumber: "AV-1" }), device({ serialNumber: "AV-2" })];
    const current = [device({ serialNumber: "AV-1" })];
    const diff = diffDeviceLists(previous, current);
    expect(diff.removedCount).toBe(1);
    expect(diff.addedCount).toBe(0);
  });

  it("rileva un dispositivo modificato (stessa identità, campi diversi)", () => {
    const previous = [device({ serialNumber: "AV-1", manufacturer: "Gatso" })];
    const current = [device({ serialNumber: "AV-1", manufacturer: "T-Explorer" })];
    const diff = diffDeviceLists(previous, current);
    expect(diff.changedCount).toBe(1);
    expect(diff.addedCount).toBe(0);
    expect(diff.removedCount).toBe(0);
  });

  it("capa le liste di chiavi oltre la soglia, segnalando il troncamento", () => {
    const current = Array.from({ length: 250 }, (_, i) => device({ serialNumber: `AV-${i}`, cadastralCode: `B${i}` }));
    const diff = diffDeviceLists([], current);
    expect(diff.addedCount).toBe(250);
    expect(diff.added).toHaveLength(200);
    expect(diff.truncated).toBe(true);
  });
});
