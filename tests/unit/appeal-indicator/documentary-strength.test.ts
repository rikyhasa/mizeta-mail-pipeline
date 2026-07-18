import { describe, expect, it } from "vitest";
import {
  deriveEnforcementDocumentaryStrength,
  deriveGenericDocumentaryStrength,
  type EnforcementDeviceCheckForDocumentaryStrength,
} from "@/lib/appeal-indicator/documentary-strength";

function check(overrides: Partial<EnforcementDeviceCheckForDocumentaryStrength>): EnforcementDeviceCheckForDocumentaryStrength {
  return { applicability: "SPEED_CAMERA_FIXED", registryMatch: "MATCH", documentChecks: [], ...overrides };
}

describe("deriveGenericDocumentaryStrength", () => {
  it("restituisce sempre NONE (fallback per multe non da autovelox)", () => {
    expect(deriveGenericDocumentaryStrength()).toBe("NONE");
  });
});

describe("deriveEnforcementDocumentaryStrength", () => {
  it("dispositivo da identificare: NONE / device_to_be_identified, indipendentemente da registro/documenti", () => {
    const result = deriveEnforcementDocumentaryStrength(
      check({ applicability: "TO_BE_IDENTIFIED", registryMatch: "MATCH", documentChecks: [{ status: "PRESENT" }] }),
    );
    expect(result).toEqual({ axis: "NONE", status: "device_to_be_identified" });
  });

  it("registryMatch NOT_FOUND ha precedenza su tutto il resto: STRONG", () => {
    const result = deriveEnforcementDocumentaryStrength(
      check({ registryMatch: "NOT_FOUND", documentChecks: [{ status: "PRESENT" }, { status: "PRESENT" }] }),
    );
    expect(result).toEqual({ axis: "STRONG", status: "strong" });
  });

  it("registryMatch MISMATCH: RELEVANT / conflict", () => {
    const result = deriveEnforcementDocumentaryStrength(check({ registryMatch: "MISMATCH" }));
    expect(result).toEqual({ axis: "RELEVANT", status: "conflict" });
  });

  it("registryMatch null (mai consultato): NONE / registry_not_consulted, mai 'verified'", () => {
    const result = deriveEnforcementDocumentaryStrength(check({ registryMatch: null, documentChecks: [] }));
    expect(result).toEqual({ axis: "NONE", status: "registry_not_consulted" });
  });

  it("registryMatch MATCH con documenti mancanti: RELEVANT / relevant", () => {
    const result = deriveEnforcementDocumentaryStrength(
      check({ registryMatch: "MATCH", documentChecks: [{ status: "PRESENT" }, { status: "MISSING" }] }),
    );
    expect(result).toEqual({ axis: "RELEVANT", status: "relevant" });
  });

  it("registryMatch MATCH, nessun documentCheck ancora creato: conta come tutti mancanti (RELEVANT)", () => {
    const result = deriveEnforcementDocumentaryStrength(check({ registryMatch: "MATCH", documentChecks: [] }));
    expect(result).toEqual({ axis: "RELEVANT", status: "relevant" });
  });

  it("registryMatch MATCH con tutti e 5 i documenti presenti: NONE / verified", () => {
    const result = deriveEnforcementDocumentaryStrength(
      check({
        registryMatch: "MATCH",
        documentChecks: [
          { status: "PRESENT" },
          { status: "PRESENT" },
          { status: "PRESENT" },
          { status: "PRESENT" },
          { status: "PRESENT" },
        ],
      }),
    );
    expect(result).toEqual({ axis: "NONE", status: "verified" });
  });
});
