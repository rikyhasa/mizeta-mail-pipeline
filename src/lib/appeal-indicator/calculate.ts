import { formatCurrency } from "@/lib/format";
import type { RuleSettingsData } from "@/lib/rules/types";
import type { AppealDocumentaryStrength, AppealEconomicConvenience, AppealIndication } from "@/generated/prisma/enums";

export interface AppealIndicatorInput {
  /** Importo ordinario del verbale — mai quello ridotto: chi presenta ricorso rinuncia allo
   * sconto per pagamento in misura ridotta, quindi il valore realmente in gioco in un ricorso
   * è sempre l'importo ordinario. null se non ancora estratto/confermato → DATI_INSUFFICIENTI. */
  amount: number | null;
  /** Punti decurtati (`CaseField` "points"). 0 se non applicabile o non presente. */
  points: number;
  /**
   * Mai estratto o dedotto dal modello (CLAUDE.md invariante 6): l'informazione raramente è
   * scritta nel verbale, va inserita o confermata da un operatore (o, in futuro, derivata
   * dall'anagrafica autisti). `null` = non ancora confermato — un valore legittimo, trattato
   * come "non conteggiare i punti nel calcolo", MAI come dato mancante che blocca l'indicazione
   * (quel ruolo è riservato a `amount`/`daysRemaining*`).
   */
  driverProfessionalCqc: boolean | null;
  /** Asse documentale già determinato altrove (modulo autovelox se applicabile, o fallback
   * generico su `missing_documents` per multe non-velox) — questa funzione lo combina con
   * l'asse economico, non lo calcola. */
  documentaryStrength: AppealDocumentaryStrength;
  /** Giorni residui per il termine al Giudice di Pace (30gg da notification_date). `null` se
   * `notification_date` non è disponibile — insieme a `daysRemainingPrefetto` null porta a
   * DATI_INSUFFICIENTI, non a una stima approssimata silenziosa. */
  daysRemainingGdp: number | null;
  /** Giorni residui per il termine al Prefetto (60gg da notification_date). */
  daysRemainingPrefetto: number | null;
}

export interface AppealIndicatorResult {
  documentaryAxis: AppealDocumentaryStrength;
  economicAxis: AppealEconomicConvenience | null;
  indication: AppealIndication;
  /** Importo + eventuale valore equivalente dei punti (solo se autista professionale CQC
   * confermato) — usato solo per il confronto di convenienza, mai per il livello di contributo
   * unificato (quello resta ancorato all'importo reale, §15.3 di docs/SPEC-AUTOVELOX-DRAFT.md,
   * correzione rispetto alla bozza iniziale che usava lo stesso valore per entrambi). */
  valueAtStake: number | null;
  /** Costo del ricorso al Giudice di Pace (contributo unificato + marca da bollo + costo
   * interno di gestione) — il Prefetto resta sempre a costo di deposito zero. */
  gdpCost: number | null;
  /** Scomposizione testuale del "perché" (docs/SPEC-AUTOVELOX-DRAFT.md §15.7) — solo la parte
   * economica/temporale: la parte documentale (es. "dispositivo non censito") è responsabilità
   * del chiamante, che la conosce meglio di questa funzione pura. */
  breakdown: string[];
}

function computeEconomicAxis(
  amount: number,
  points: number,
  driverProfessionalCqc: boolean | null,
  settings: RuleSettingsData,
): { economicAxis: AppealEconomicConvenience; valueAtStake: number; gdpCost: number } {
  const valueAtStake = amount + (driverProfessionalCqc === true ? points * settings.appealLicensePointValueEquivalent : 0);
  const unifiedContribution =
    amount <= settings.appealGdpUnifiedContributionThreshold
      ? settings.appealGdpUnifiedContributionLowValue
      : settings.appealGdpUnifiedContributionHighValue;
  const gdpCost = unifiedContribution + settings.appealGdpStampDutyAmount + settings.appealInternalHandlingCost;

  const economicAxis: AppealEconomicConvenience =
    valueAtStake >= gdpCost * settings.appealFavorableMultiplier ? "FAVORABLE" : valueAtStake > gdpCost ? "LIMITED" : "UNFAVORABLE";

  return { economicAxis, valueAtStake, gdpCost };
}

function buildBreakdown(input: AppealIndicatorInput): string[] {
  const breakdown: string[] = [];

  breakdown.push(input.amount === null ? "Importo non disponibile" : `Importo ${formatCurrency(input.amount)}`);

  if (input.points > 0) {
    if (input.driverProfessionalCqc === true) {
      breakdown.push(`${input.points} punti (autista professionale CQC, valore equivalente incluso)`);
    } else if (input.driverProfessionalCqc === false) {
      breakdown.push(`${input.points} punti (autista non professionale, non conteggiati)`);
    } else {
      breakdown.push(`${input.points} punti (professionalità autista non confermata, non conteggiati)`);
    }
  }

  if (input.daysRemainingGdp !== null) {
    breakdown.push(`${input.daysRemainingGdp} giorni residui per il Giudice di Pace`);
  }
  if (input.daysRemainingPrefetto !== null) {
    breakdown.push(`${input.daysRemainingPrefetto} giorni residui per il Prefetto`);
  }
  if (input.daysRemainingGdp === null && input.daysRemainingPrefetto === null) {
    breakdown.push("Data di notifica non disponibile: termini non calcolabili");
  }

  return breakdown;
}

/**
 * Indicatore ricorso (docs/SPEC.md §10bis, docs/SPEC-AUTOVELOX-DRAFT.md §15): calcolo
 * deterministico puro, nessun LLM in nessun passaggio, mai persistito (si ricalcola a ogni
 * lettura dai dati vivi — stesso principio di `src/lib/cases/blockers.ts`, Fase B/C). Non
 * esprime mai una previsione di esito o una probabilità di accoglimento — solo
 * un'indicazione operativa con la sua scomposizione (CLAUDE.md invariante 9).
 */
export function calculateAppealIndicator(input: AppealIndicatorInput, settings: RuleSettingsData): AppealIndicatorResult {
  const breakdown = buildBreakdown(input);

  if (input.amount === null || (input.daysRemainingGdp === null && input.daysRemainingPrefetto === null)) {
    return {
      documentaryAxis: input.documentaryStrength,
      economicAxis: null,
      indication: "INSUFFICIENT_DATA",
      valueAtStake: null,
      gdpCost: null,
      breakdown,
    };
  }

  const { economicAxis, valueAtStake, gdpCost } = computeEconomicAxis(input.amount, input.points, input.driverProfessionalCqc, settings);

  const gdpOpen = input.daysRemainingGdp !== null && input.daysRemainingGdp > 0;
  const prefettoOpen = input.daysRemainingPrefetto !== null && input.daysRemainingPrefetto > 0;

  let indication: AppealIndication;
  if (!gdpOpen && !prefettoOpen) {
    indication = "DEADLINES_EXPIRED";
  } else if (input.documentaryStrength === "NONE") {
    indication = "NO_RELEVANT_ELEMENT";
  } else if (economicAxis === "FAVORABLE" && gdpOpen) {
    indication = "CONSIDER_GDP_APPEAL";
  } else if ((input.documentaryStrength === "RELEVANT" || input.documentaryStrength === "STRONG") && prefettoOpen) {
    indication = "CONSIDER_PREFETTO_APPEAL";
  } else {
    indication = "RELEVANT_BUT_UNECONOMICAL";
  }

  return {
    documentaryAxis: input.documentaryStrength,
    economicAxis,
    indication,
    valueAtStake,
    gdpCost,
    breakdown,
  };
}
