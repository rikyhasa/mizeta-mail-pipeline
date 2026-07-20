import { describe, expect, it } from "vitest";
import { matchDeviceAgainstRegistry, type DeviceIdentityForMatch } from "@/lib/speed-registry/match-device-registry";
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

function identity(overrides: Partial<DeviceIdentityForMatch>): DeviceIdentityForMatch {
  return { manufacturer: null, model: null, serialNumber: null, decreeNumber: null, version: null, ...overrides };
}

describe("matchDeviceAgainstRegistry", () => {
  it("nessun identificativo forte (matricola/decreto): nessun esito, mai un NOT_FOUND inventato", () => {
    const result = matchDeviceAgainstRegistry(identity({ manufacturer: "Gatso" }), [device({})]);
    expect(result.match).toBeNull();
    expect(result.matchedRow).toBeNull();
  });

  it("matricola trovata, produttore/modello coerenti: MATCH", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "Gatso", model: "24" })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-2021-3312", manufacturer: "Gatso", model: "24" }), registry);
    expect(result.match).toBe("MATCH");
  });

  it("matricola non presente nel registro: NOT_FOUND", () => {
    const registry = [device({ serialNumber: "AV-0000-0000" })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-9999-9999" }), registry);
    expect(result.match).toBe("NOT_FOUND");
  });

  it("matricola trovata ma produttore diverso: MISMATCH", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "Gatso" })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-2021-3312", manufacturer: "Sicve" }), registry);
    expect(result.match).toBe("MISMATCH");
  });

  it("confronto normalizzato: maiuscole/spazi non generano un MISMATCH falso", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "  GATSO  " })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "av-2021-3312", manufacturer: "gatso" }), registry);
    expect(result.match).toBe("MATCH");
  });

  it("produttore/modello mancanti da un lato non generano un MISMATCH artificiale", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "Gatso", model: "24" })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-2021-3312" }), registry);
    expect(result.match).toBe("MATCH");
  });

  it("nessuna matricola ma numero decreto presente: cerca per decreto come fallback", () => {
    const registry = [device({ serialNumber: "AV-1", decreeNumber: "40218/2019" })];
    const result = matchDeviceAgainstRegistry(identity({ decreeNumber: "40218/2019" }), registry);
    expect(result.match).toBe("MATCH");
  });

  it("A2 — fallback per decreto con matricola incompatibile: MISMATCH, mai un MATCH falso", () => {
    const registry = [device({ serialNumber: "B", decreeNumber: "D" })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "A", decreeNumber: "D" }), registry);
    expect(result.match).toBe("MISMATCH");
    expect(result.conflictingFields).toEqual(["serialNumber"]);
  });

  it("MISMATCH su produttore: conflictingFields riporta solo 'manufacturer', non 'model'", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "Gatso", model: "24" })];
    const result = matchDeviceAgainstRegistry(
      identity({ serialNumber: "AV-2021-3312", manufacturer: "Sicve", model: "24" }),
      registry,
    );
    expect(result.match).toBe("MISMATCH");
    expect(result.conflictingFields).toEqual(["manufacturer"]);
  });

  it("MISMATCH su entrambi produttore e modello: conflictingFields li riporta entrambi", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "Gatso", model: "24" })];
    const result = matchDeviceAgainstRegistry(
      identity({ serialNumber: "AV-2021-3312", manufacturer: "Sicve", model: "99" }),
      registry,
    );
    expect(result.conflictingFields).toEqual(["manufacturer", "model"]);
  });

  it("MATCH pulito: conflictingFields vuoto, ambiguous false", () => {
    const registry = [device({ serialNumber: "AV-2021-3312", manufacturer: "Gatso", model: "24" })];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-2021-3312" }), registry);
    expect(result.conflictingFields).toEqual([]);
    expect(result.ambiguous).toBe(false);
  });

  it("più righe di registro con la stessa matricola: ambiguous true, anche se il primo confronto risulterebbe MATCH", () => {
    const registry = [
      device({ serialNumber: "AV-DUP", manufacturer: "Gatso", cadastralCode: "B1" }),
      device({ serialNumber: "AV-DUP", manufacturer: "Gatso", cadastralCode: "B2" }),
    ];
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-DUP", manufacturer: "Gatso" }), registry);
    expect(result.match).toBe("MATCH");
    expect(result.ambiguous).toBe(true);
  });

  it("più righe con lo stesso numero decreto (fallback): ambiguous true", () => {
    const registry = [
      device({ serialNumber: "AV-1", decreeNumber: "40218/2019", cadastralCode: "B1" }),
      device({ serialNumber: "AV-2", decreeNumber: "40218/2019", cadastralCode: "B2" }),
    ];
    const result = matchDeviceAgainstRegistry(identity({ decreeNumber: "40218/2019" }), registry);
    expect(result.ambiguous).toBe(true);
  });

  it("NOT_FOUND: conflictingFields vuoto, ambiguous false", () => {
    const result = matchDeviceAgainstRegistry(identity({ serialNumber: "AV-9999-9999" }), [device({ serialNumber: "AV-0000-0000" })]);
    expect(result.conflictingFields).toEqual([]);
    expect(result.ambiguous).toBe(false);
  });
});
