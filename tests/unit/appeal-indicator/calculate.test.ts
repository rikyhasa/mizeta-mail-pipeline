import { describe, expect, it } from "vitest";
import { calculateAppealIndicator, type AppealIndicatorInput } from "@/lib/appeal-indicator/calculate";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";

// Baseline: appealGdpUnifiedContributionLowValue 43, threshold 1100, stampDuty 27,
// internalHandlingCost 80 → gdpCost = 150 sotto soglia, 205 sopra. favorableMultiplier 2.0.
const SETTINGS = DEFAULT_RULE_SETTINGS;

const BASE: AppealIndicatorInput = {
  amount: 500,
  points: 0,
  driverProfessionalCqc: null,
  documentaryStrength: "STRONG",
  documentaryStatus: "strong",
  daysRemainingGdp: 20,
  daysRemainingPrefetto: 50,
};

describe("calculateAppealIndicator — esempi guida di docs/SPEC-AUTOVELOX-DRAFT.md §15.5", () => {
  it("multa alta + elementi forti → CONSIDER_GDP_APPEAL (l'importo da solo supera gdpCost × 2)", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: 500 }, SETTINGS);
    expect(result.economicAxis).toBe("FAVORABLE");
    expect(result.indication).toBe("CONSIDER_GDP_APPEAL");
  });

  it("multa bassa + elementi forti → CONSIDER_PREFETTO_APPEAL (via gratuita, importo non giustifica il GdP)", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: 100 }, SETTINGS);
    expect(result.economicAxis).not.toBe("FAVORABLE");
    expect(result.indication).toBe("CONSIDER_PREFETTO_APPEAL");
  });

  it("multa bassa + punti su autista professionale + elementi forti → la componente punti sposta l'indicazione a CONSIDER_GDP_APPEAL", () => {
    const withoutCqc = calculateAppealIndicator({ ...BASE, amount: 100, points: 10, driverProfessionalCqc: false }, SETTINGS);
    expect(withoutCqc.indication).toBe("CONSIDER_PREFETTO_APPEAL");

    const withCqc = calculateAppealIndicator({ ...BASE, amount: 100, points: 10, driverProfessionalCqc: true }, SETTINGS);
    expect(withCqc.valueAtStake).toBe(100 + 10 * 50);
    expect(withCqc.economicAxis).toBe("FAVORABLE");
    expect(withCqc.indication).toBe("CONSIDER_GDP_APPEAL");
  });
});

describe("calculateAppealIndicator — driver_professional_cqc non confermato (null) non blocca il calcolo", () => {
  it("null e false producono lo stesso risultato economico (punti non conteggiati in entrambi i casi)", () => {
    const withNull = calculateAppealIndicator({ ...BASE, amount: 100, points: 10, driverProfessionalCqc: null }, SETTINGS);
    const withFalse = calculateAppealIndicator({ ...BASE, amount: 100, points: 10, driverProfessionalCqc: false }, SETTINGS);
    expect(withNull.valueAtStake).toBe(withFalse.valueAtStake);
    expect(withNull.indication).toBe(withFalse.indication);
    expect(withNull.indication).not.toBe("INSUFFICIENT_DATA");
  });

  it("il breakdown distingue 'non confermato' da 'confermato: no', ma il valore non cambia", () => {
    const result = calculateAppealIndicator({ ...BASE, points: 5, driverProfessionalCqc: null }, SETTINGS);
    expect(result.breakdown.some((line) => line.includes("non confermata"))).toBe(true);
  });
});

describe("calculateAppealIndicator — priorità DATI_INSUFFICIENTI / TERMINI_SCADUTI", () => {
  it("importo mancante → INSUFFICIENT_DATA, anche con termini e documentazione altrimenti favorevoli", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: null }, SETTINGS);
    expect(result.indication).toBe("INSUFFICIENT_DATA");
    expect(result.economicAxis).toBeNull();
    expect(result.valueAtStake).toBeNull();
    expect(result.gdpCost).toBeNull();
  });

  it("notification_date non disponibile (entrambi i termini null) → INSUFFICIENT_DATA", () => {
    const result = calculateAppealIndicator({ ...BASE, daysRemainingGdp: null, daysRemainingPrefetto: null }, SETTINGS);
    expect(result.indication).toBe("INSUFFICIENT_DATA");
  });

  it("entrambi i termini scaduti (ma importo e data noti) → DEADLINES_EXPIRED, non INSUFFICIENT_DATA", () => {
    const result = calculateAppealIndicator({ ...BASE, daysRemainingGdp: -3, daysRemainingPrefetto: -10 }, SETTINGS);
    expect(result.indication).toBe("DEADLINES_EXPIRED");
  });

  it("un solo termine scaduto (l'altro ancora aperto) non è considerato 'scaduto'", () => {
    const result = calculateAppealIndicator({ ...BASE, daysRemainingGdp: -3, daysRemainingPrefetto: 40 }, SETTINGS);
    expect(result.indication).not.toBe("DEADLINES_EXPIRED");
  });
});

describe("calculateAppealIndicator — asse documentale", () => {
  it("nessun elemento documentale rilevante → NO_RELEVANT_ELEMENT, anche con economia favorevole", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: 5000, documentaryStrength: "NONE" }, SETTINGS);
    expect(result.indication).toBe("NO_RELEVANT_ELEMENT");
  });

  it("elementi deboli + economia non favorevole → RELEVANT_BUT_UNECONOMICAL", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: 50, documentaryStrength: "WEAK" }, SETTINGS);
    expect(result.economicAxis).not.toBe("FAVORABLE");
    expect(result.indication).toBe("RELEVANT_BUT_UNECONOMICAL");
  });

  it("elementi rilevanti/forti ma via Prefetto già scaduta ed economia non favorevole → RELEVANT_BUT_UNECONOMICAL", () => {
    const result = calculateAppealIndicator(
      { ...BASE, amount: 50, documentaryStrength: "STRONG", daysRemainingGdp: 5, daysRemainingPrefetto: -1 },
      SETTINGS,
    );
    expect(result.indication).toBe("RELEVANT_BUT_UNECONOMICAL");
  });
});

describe("calculateAppealIndicator — documentaryStatus 'pending' non deve mai leggersi come NO_RELEVANT_ELEMENT", () => {
  it.each(["not_yet_evaluated", "device_to_be_identified", "registry_not_consulted"] as const)(
    "documentaryStatus '%s' con asse NONE → INSUFFICIENT_DATA, anche con economia favorevole e termini aperti",
    (status) => {
      const result = calculateAppealIndicator({ ...BASE, amount: 500, documentaryStrength: "NONE", documentaryStatus: status }, SETTINGS);
      expect(result.indication).toBe("INSUFFICIENT_DATA");
    },
  );

  it("documentaryStatus 'verified' con asse NONE → NO_RELEVANT_ELEMENT (verifica conclusa, non in sospeso)", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: 500, documentaryStrength: "NONE", documentaryStatus: "verified" }, SETTINGS);
    expect(result.indication).toBe("NO_RELEVANT_ELEMENT");
  });

  it("documentaryStatus null (fallback generico non-velox) con asse NONE → NO_RELEVANT_ELEMENT, comportamento invariato", () => {
    const result = calculateAppealIndicator({ ...BASE, amount: 500, documentaryStrength: "NONE", documentaryStatus: null }, SETTINGS);
    expect(result.indication).toBe("NO_RELEVANT_ELEMENT");
  });

  it("termini scaduti vince comunque su documentaryStatus pending (DEADLINES_EXPIRED ha priorità)", () => {
    const result = calculateAppealIndicator(
      { ...BASE, documentaryStatus: "device_to_be_identified", daysRemainingGdp: -3, daysRemainingPrefetto: -10 },
      SETTINGS,
    );
    expect(result.indication).toBe("DEADLINES_EXPIRED");
  });
});

describe("calculateAppealIndicator — parametri RuleSettings riflessi nel calcolo", () => {
  it("un moltiplicatore di convenienza più alto può spostare l'indicazione da GdP a Prefetto", () => {
    const strictSettings = { ...SETTINGS, appealFavorableMultiplier: 10 };
    const result = calculateAppealIndicator({ ...BASE, amount: 500 }, strictSettings);
    expect(result.economicAxis).not.toBe("FAVORABLE");
    expect(result.indication).toBe("CONSIDER_PREFETTO_APPEAL");
  });

  it("il livello di contributo unificato usa la soglia configurata sull'importo reale, non su valueAtStake", () => {
    // amount appena sopra soglia (1100): userebbe il contributo alto anche se i punti-equivalenti
    // (non conteggiati per importo, solo per il confronto) porterebbero valueAtStake ben oltre.
    const aboveThreshold = calculateAppealIndicator({ ...BASE, amount: 1200, points: 10, driverProfessionalCqc: true }, SETTINGS);
    const highTierGdpCost = SETTINGS.appealGdpUnifiedContributionHighValue + SETTINGS.appealGdpStampDutyAmount + SETTINGS.appealInternalHandlingCost;
    expect(aboveThreshold.gdpCost).toBe(highTierGdpCost);
  });
});

describe("calculateAppealIndicator — nessuna dipendenza da tempo/casualità", () => {
  it("è deterministica: stesso input e stessi settings producono sempre lo stesso risultato", () => {
    const first = calculateAppealIndicator(BASE, SETTINGS);
    const second = calculateAppealIndicator(BASE, SETTINGS);
    expect(first).toEqual(second);
  });
});
