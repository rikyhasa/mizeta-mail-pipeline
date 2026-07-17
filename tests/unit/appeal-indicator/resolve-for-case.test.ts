import { describe, expect, it } from "vitest";
import { resolveAppealIndicatorForCase, type CaseFieldLookup } from "@/lib/appeal-indicator/resolve-for-case";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";

const NOW = new Date("2026-07-17T00:00:00.000Z");

function fields(overrides: Record<string, string | null>): CaseFieldLookup[] {
  return Object.entries(overrides).map(([fieldKey, value]) => ({ fieldKey, value }));
}

describe("resolveAppealIndicatorForCase", () => {
  it("INSUFFICIENT_DATA quando amount e notification_date mancano entrambi (nessun CaseField)", () => {
    const result = resolveAppealIndicatorForCase(fields({}), DEFAULT_RULE_SETTINGS, NOW);
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("legge amount, points e notification_date dai CaseField e calcola i giorni residui", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "500", points: "2", notification_date: "2026-07-01T00:00:00.000Z" }),
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.indication).not.toBe("INSUFFICIENT_DATA");
    expect(result.valueAtStake).toBe(500);
  });

  it("driver_professional_cqc assente (nessun CaseField) è trattato come non confermato, non come dato bloccante", () => {
    const withoutField = resolveAppealIndicatorForCase(
      fields({ amount: "100", points: "10", notification_date: "2026-07-01T00:00:00.000Z" }),
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    const withFalse = resolveAppealIndicatorForCase(
      fields({ amount: "100", points: "10", notification_date: "2026-07-01T00:00:00.000Z", driver_professional_cqc: "false" }),
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(withoutField.valueAtStake).toBe(withFalse.valueAtStake);
    expect(withoutField.indication).not.toBe("INSUFFICIENT_DATA");
  });

  it("driver_professional_cqc = 'true' conteggia il valore equivalente dei punti", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "100", points: "10", notification_date: "2026-07-01T00:00:00.000Z", driver_professional_cqc: "true" }),
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.valueAtStake).toBe(100 + 10 * DEFAULT_RULE_SETTINGS.appealLicensePointValueEquivalent);
  });

  it("un amount non numerico è trattato come mancante, non come zero", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "non un numero", notification_date: "2026-07-01T00:00:00.000Z" }),
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("l'asse documentale usa il fallback generico (NONE) finché il modulo autovelox non esiste (Tappa 4/6)", () => {
    const result = resolveAppealIndicatorForCase(
      fields({ amount: "5000", notification_date: "2026-07-01T00:00:00.000Z" }),
      DEFAULT_RULE_SETTINGS,
      NOW,
    );
    expect(result.documentaryAxis).toBe("NONE");
  });
});
