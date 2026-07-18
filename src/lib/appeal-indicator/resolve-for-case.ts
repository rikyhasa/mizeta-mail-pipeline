import { calculateAppealIndicator, type AppealIndicatorResult } from "./calculate";
import { calculateAppealDeadlines } from "./deadlines";
import {
  deriveEnforcementDocumentaryStrength,
  deriveGenericDocumentaryStrength,
  type EnforcementDeviceCheckForDocumentaryStrength,
} from "./documentary-strength";
import type { RuleSettingsData } from "@/lib/rules/types";

export interface CaseFieldLookup {
  fieldKey: string;
  value: string | null;
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/** `CaseField.value` è sempre una stringa in DB: "true"/"false" per i campi booleani
 * (`BOOLEAN_FIELD_KEYS`, src/lib/i18n/field-labels.ts) — assente/altro = non confermato. */
function parseTriStateBoolean(raw: string | null): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/**
 * Assembla l'input per `calculateAppealIndicator` a partire dai `CaseField` già caricati di una
 * pratica (nessuna query aggiuntiva) — calcolato a lettura, mai persistito (docs/SPEC.md §10bis).
 * L'asse documentale usa i segnali reali del modulo autovelox (`enforcementCheck`, già caricato
 * dalla stessa query di `EnforcementVerificationCard` in page.tsx — nessuna query aggiuntiva
 * anche qui) quando presente; per le multe non da autovelox (`enforcementCheck` null, es. ZTL o
 * sosta vietata) resta il fallback generico di `deriveGenericDocumentaryStrength`.
 */
export function resolveAppealIndicatorForCase(
  fields: CaseFieldLookup[],
  enforcementCheck: EnforcementDeviceCheckForDocumentaryStrength | null,
  settings: RuleSettingsData,
  now: Date,
): AppealIndicatorResult {
  const fieldsByKey = new Map(fields.map((f) => [f.fieldKey, f.value]));

  const amount = parseNumber(fieldsByKey.get("amount") ?? null);
  const points = parseNumber(fieldsByKey.get("points") ?? null) ?? 0;
  const driverProfessionalCqc = parseTriStateBoolean(fieldsByKey.get("driver_professional_cqc") ?? null);

  const notificationDateRaw = fieldsByKey.get("notification_date") ?? null;
  const notificationDate = notificationDateRaw ? new Date(notificationDateRaw) : null;
  const { daysRemainingGdp, daysRemainingPrefetto } = calculateAppealDeadlines(notificationDate, now);

  const { axis: documentaryStrength, status: documentaryStatus } = enforcementCheck
    ? deriveEnforcementDocumentaryStrength(enforcementCheck)
    : { axis: deriveGenericDocumentaryStrength(), status: null };

  return calculateAppealIndicator(
    {
      amount,
      points,
      driverProfessionalCqc,
      documentaryStrength,
      documentaryStatus,
      daysRemainingGdp,
      daysRemainingPrefetto,
    },
    settings,
  );
}
