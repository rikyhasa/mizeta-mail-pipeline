import type { AppealDocumentaryStrength, EnforcementCheckApplicability, EnforcementDocumentStatus, EnforcementRegistryMatchState } from "@/generated/prisma/enums";
import { ENFORCEMENT_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";

const ENFORCEMENT_DOCUMENT_TYPE_COUNT = Object.keys(ENFORCEMENT_DOCUMENT_TYPE_LABELS).length;

/**
 * Asse documentale, fallback generico per multe senza modulo di verifica autovelox — usato solo
 * quando la pratica non ha alcun `EnforcementDeviceCheck` (multa non da autovelox, es. ZTL o
 * sosta vietata: `EnforcementVerificationCard` collassa correttamente a "non applicabile" in
 * quel caso). docs/SPEC-AUTOVELOX-DRAFT.md §15.3 proponeva di riusare il campo estratto
 * `missing_documents`. Verificato che `missing_documents` non viene mai persistito come
 * `CaseField` (`src/lib/pipeline/persist-extraction.ts:52`, "salta array semplici (missing_data,
 * missing_documents)") — non esiste quindi oggi alcun segnale reale da cui derivare
 * DEBOLI/RILEVANTI/FORTI per multe non-velox. Restituire sempre `NONE` in questo caso è la
 * scelta onesta (nessun elemento documentale accertato), non un difetto: meglio "nessun segnale"
 * che un segnale inventato.
 */
export function deriveGenericDocumentaryStrength(): AppealDocumentaryStrength {
  return "NONE";
}

/**
 * Stato ausiliario, non persistito (nessuna estensione dell'enum Prisma
 * `AppealDocumentaryStrength`): distingue "non ancora valutato" da "verificato, nessun elemento"
 * — entrambi mappano oggi sull'asse persistito `NONE`, ma vanno raccontati in modo diverso nel
 * breakdown e usati diversamente per decidere l'indicazione finale (vedi
 * `documentaryDataAvailable` in `calculate.ts`). `weak` non è mai prodotto da
 * `deriveEnforcementDocumentaryStrength` oggi: nessun segnale disponibile lo giustifica ancora
 * (nessuna gradazione fra "corrisponde" e "non trovato" nel registro) — resta nel tipo per non
 * dover ri-toccare ogni chiamante quando un segnale del genere esisterà.
 */
export type AppealDocumentaryStatus =
  | "not_yet_evaluated"
  | "device_to_be_identified"
  | "registry_not_consulted"
  | "verified"
  | "weak"
  | "relevant"
  | "strong"
  | "conflict"
  | "not_applicable";

export interface EnforcementDocumentaryResult {
  axis: AppealDocumentaryStrength;
  status: AppealDocumentaryStatus;
}

/**
 * Etichette per gli stati "non ancora valutato" (FASE 11, punto A4): oggi tutti collassano
 * sull'asse persistito `NONE`, ma l'utente non deve mai leggere "Assenti" — che implica
 * un'assenza verificata — quando la verifica autovelox non è nemmeno conclusa. Solo
 * `verified` (asse `NONE`) resta "Assenti" tramite `APPEAL_DOCUMENTARY_STRENGTH_LABELS`
 * (src/lib/i18n/labels.ts), colocata qui invece che lì per evitare un ciclo di import fra un
 * modulo i18n di basso livello e questa logica di dominio. Gli stati `weak`/`relevant`/`strong`/
 * `conflict`/`not_applicable` non compaiono qui: hanno già un'etichetta reale via l'asse.
 */
export const APPEAL_DOCUMENTARY_STATUS_PENDING_LABELS: Partial<Record<AppealDocumentaryStatus, string>> = {
  not_yet_evaluated: "Non ancora valutati",
  device_to_be_identified: "Dispositivo da identificare",
  registry_not_consulted: "Registro non consultato",
};

export interface EnforcementDeviceCheckForDocumentaryStrength {
  applicability: EnforcementCheckApplicability;
  registryMatch: EnforcementRegistryMatchState | null;
  documentChecks: { status: EnforcementDocumentStatus }[];
}

/**
 * Asse documentale derivato dai segnali reali del modulo autovelox
 * (docs/SPEC-AUTOVELOX-DRAFT.md §15.3, CLAUDE.md invariante 9 — mai un giudizio di merito, solo
 * stati documentali e confronti). Precedenza dei segnali, dal più al meno decisivo:
 *
 * 1. Dispositivo ancora da identificare → nulla su cui basare l'asse.
 * 2. `registryMatch: NOT_FOUND` (dispositivo non censito nel registro alla data dello snapshot
 *    consultato) → il segnale più forte previsto dalla specifica.
 * 3. `registryMatch: MISMATCH` (dati dichiarati in disaccordo col registro) → conflitto da
 *    risolvere, mai un giudizio automatico su quale fonte sia corretta.
 * 4. `registryMatch: null` → il registro non è mai stato consultato per questo dispositivo
 *    (nessuno snapshot esisteva, o mancano gli identificativi per cercare — vedi
 *    `match-device-registry.ts`): stato onestamente diverso da "verificato, nessun elemento".
 * 5. `registryMatch: MATCH` → il dispositivo corrisponde al registro; l'asse dipende allora dalla
 *    completezza documentale (stesso conteggio di `blockers.ts`/`EnforcementVerificationCard`).
 *
 * Non dipende da `EnforcementDeviceCheck.state`: `DOCUMENTED_VERIFICATION_COMPLETE` non ha oggi
 * alcun percorso di scrittura nel codice (nessun endpoint lo imposta), quindi ancorare "verified"
 * a quello stato lo renderebbe permanentemente irraggiungibile — la completezza documentale
 * osservata è un segnale più affidabile e sempre disponibile.
 */
export function deriveEnforcementDocumentaryStrength(check: EnforcementDeviceCheckForDocumentaryStrength): EnforcementDocumentaryResult {
  if (check.applicability === "TO_BE_IDENTIFIED") {
    return { axis: "NONE", status: "device_to_be_identified" };
  }

  if (check.registryMatch === "NOT_FOUND") {
    return { axis: "STRONG", status: "strong" };
  }

  if (check.registryMatch === "MISMATCH") {
    return { axis: "RELEVANT", status: "conflict" };
  }

  if (check.registryMatch === null) {
    return { axis: "NONE", status: "registry_not_consulted" };
  }

  const presentCount = check.documentChecks.filter((d) => d.status === "PRESENT").length;
  const missingCount = ENFORCEMENT_DOCUMENT_TYPE_COUNT - presentCount;

  return missingCount > 0 ? { axis: "RELEVANT", status: "relevant" } : { axis: "NONE", status: "verified" };
}
