import { describe, expect, it } from "vitest";
import { resolveAppealIndicatorForCase, type CaseFieldLookup } from "@/lib/appeal-indicator/resolve-for-case";
import type { EnforcementDeviceCheckForDocumentaryStrength } from "@/lib/appeal-indicator/documentary-strength";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";

const NOW = new Date("2026-07-17T00:00:00.000Z");

function fields(overrides: Record<string, string | null>): CaseFieldLookup[] {
  return Object.entries(overrides).map(([fieldKey, value]) => ({ fieldKey, value }));
}

const RICH_FIELDS = fields({ amount: "5000", notification_date: "2026-07-01T00:00:00.000Z" });

describe("resolveAppealIndicatorForCase", () => {
  it("INSUFFICIENT_DATA quando amount e notification_date mancano entrambi (nessun CaseField)", () => {
    const result = resolveAppealIndicatorForCase(fields({}), null, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("legge amount, points e notification_date dai CaseField e calcola i giorni residui", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "500", points: "2", notification_date: "2026-07-01T00:00:00.000Z" }),
      null,
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.indication).not.toBe("INSUFFICIENT_DATA");
    expect(result.valueAtStake).toBe(500);
  });

  it("driver_professional_cqc assente (nessun CaseField) è trattato come non confermato, non come dato bloccante", () => {
    const withoutField = resolveAppealIndicatorForCase(
      fields({ amount: "100", points: "10", notification_date: "2026-07-01T00:00:00.000Z" }),
      null,
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    const withFalse = resolveAppealIndicatorForCase(
      fields({ amount: "100", points: "10", notification_date: "2026-07-01T00:00:00.000Z", driver_professional_cqc: "false" }),
      null,
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(withoutField.valueAtStake).toBe(withFalse.valueAtStake);
    expect(withoutField.indication).not.toBe("INSUFFICIENT_DATA");
  });

  it("driver_professional_cqc = 'true' conteggia il valore equivalente dei punti", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "100", points: "10", notification_date: "2026-07-01T00:00:00.000Z", driver_professional_cqc: "true" }),
      null,
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.valueAtStake).toBe(100 + 10 * DEFAULT_RULE_SETTINGS.appealLicensePointValueEquivalent);
  });

  it("un amount non numerico è trattato come mancante, non come zero", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "non un numero", notification_date: "2026-07-01T00:00:00.000Z" }),
      null,
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("l'asse documentale usa il fallback generico (NONE) per multe non da autovelox (enforcementCheck null)", () => {
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, null, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryAxis).toBe("NONE");
    expect(result.documentaryStatus).toBeNull();
  });

  it("dispositivo ancora da identificare: asse NONE ma indicazione INSUFFICIENT_DATA, mai NO_RELEVANT_ELEMENT", () => {
    const check: EnforcementDeviceCheckForDocumentaryStrength = {
      applicability: "TO_BE_IDENTIFIED",
      registryMatch: null,
      documentChecks: [],
    };
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, check, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryAxis).toBe("NONE");
    expect(result.documentaryStatus).toBe("device_to_be_identified");
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("dispositivo identificato ma registro mai consultato: asse NONE, indicazione ancora INSUFFICIENT_DATA", () => {
    const check: EnforcementDeviceCheckForDocumentaryStrength = {
      applicability: "SPEED_CAMERA_FIXED",
      registryMatch: null,
      documentChecks: [],
    };
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, check, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryStatus).toBe("registry_not_consulted");
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("registro NOT_FOUND produce l'asse STRONG e considera il ricorso al Prefetto se conveniente", () => {
    const check: EnforcementDeviceCheckForDocumentaryStrength = {
      applicability: "SPEED_CAMERA_FIXED",
      registryMatch: "NOT_FOUND",
      documentChecks: [],
    };
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, check, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryAxis).toBe("STRONG");
    expect(result.documentaryStatus).toBe("strong");
    expect(result.indication).not.toBe("NO_RELEVANT_ELEMENT");
    expect(result.indication).not.toBe("INSUFFICIENT_DATA");
  });

  it("registro MISMATCH produce l'asse RELEVANT e lo stato ausiliario 'conflict'", () => {
    const check: EnforcementDeviceCheckForDocumentaryStrength = {
      applicability: "SPEED_CAMERA_FIXED",
      registryMatch: "MISMATCH",
      documentChecks: [],
    };
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, check, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryAxis).toBe("RELEVANT");
    expect(result.documentaryStatus).toBe("conflict");
  });

  it("registro MATCH con documenti mancanti produce l'asse RELEVANT, mai 'Assenti'", () => {
    const check: EnforcementDeviceCheckForDocumentaryStrength = {
      applicability: "SPEED_CAMERA_FIXED",
      registryMatch: "MATCH",
      documentChecks: [{ status: "MISSING" }],
    };
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, check, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryAxis).toBe("RELEVANT");
    expect(result.documentaryStatus).toBe("relevant");
  });

  it("registro MATCH con documentazione tecnica completa produce l'asse NONE con stato 'verified', indicazione NO_RELEVANT_ELEMENT", () => {
    const check: EnforcementDeviceCheckForDocumentaryStrength = {
      applicability: "SPEED_CAMERA_FIXED",
      registryMatch: "MATCH",
      documentChecks: [
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "PRESENT" },
      ],
    };
    const result = resolveAppealIndicatorForCase(RICH_FIELDS, check, DEFAULT_RULE_SETTINGS, NOW);
    expect(result.documentaryAxis).toBe("NONE");
    expect(result.documentaryStatus).toBe("verified");
    expect(result.indication).toBe("NO_RELEVANT_ELEMENT");
  });
});
