import { prisma } from "@/lib/db/prisma";
import { classifyFieldTier } from "@/app/(app)/pratiche/[id]/_components/field-tiers";
import { countMissingRequiredDocuments } from "@/lib/cases/enforcement-documents";
import { isNotificationDateUnconfirmed } from "@/lib/appeal-indicator/resolve-for-case";
import type { EnforcementCheckApplicability } from "@/generated/prisma/enums";

/** Stesso valore già usato in ExtractedFieldCell.tsx (70%), non un nuovo numero inventato. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Categoria del blocker: usata per scegliere un verbo concreto nella CTA "Prossima azione"
 * (docs/UX-AUDIT-2026-07.md, punto 3.3.4 — "Vai" era un'etichetta generica) e per l'ordine di
 * priorità (vedi `BLOCKER_PRIORITY` sotto). */
export type CaseBlockerKind =
  | "missing_fields"
  | "needs_review"
  | "low_confidence"
  | "no_assignee"
  | "anomaly"
  | "security_flags"
  | "pending_relations"
  | "enforcement_identify"
  | "enforcement_missing_fields"
  | "enforcement_missing_docs"
  | "notification_date_unconfirmed";

/**
 * Priorità di visualizzazione (numero più basso = mostrato per primo in "Prossima azione", che
 * usa solo `blockers[0]`): fino a una modifica precedente l'ordine era implicitamente quello di
 * inserimento in `deriveCaseBlockers`, che metteva sempre i blocker autovelox in coda — per una
 * pratica FINE_OR_PENALTY con dati generici ancora da confermare (praticamente ogni pratica
 * appena arrivata), il blocker specifico "Identifica il dispositivo"/"Conferma i dati del
 * dispositivo" non emergeva mai come CTA principale, nonostante fosse il singolo passo più utile.
 * `enforcement_identify` è il caso limite: senza sapere il tipo di dispositivo, il resto del
 * modulo autovelox (registro, documenti) non può procedere, quindi resta sempre il primo.
 * `no_assignee` è retrocesso deliberatamente: sapere COSA manca è più utile di sapere CHI deve
 * occuparsene, ed è quasi sempre vero per una pratica appena arrivata (rischiava di vincere ogni
 * volta per pura frequenza, non per rilevanza).
 *
 * Ogni `CaseBlockerKind` ha un valore univoco (FASE 12, Bug 5): prima alcuni kind condividevano
 * lo stesso numero e il pareggio si risolveva solo perché `Array.prototype.sort` è stabile e
 * l'ordine di inserimento sopra li discriminava implicitamente — corretto ma non dichiarato come
 * contratto, quindi fragile a un futuro riordino dei `push` in `deriveCaseBlockers`. I valori qui
 * sotto riproducono esattamente l'ordine già in vigore, ma come regola esplicita e stabile nel
 * tempo, non più un effetto collaterale della stabilità di `sort`.
 */
const BLOCKER_PRIORITY: Record<CaseBlockerKind, number> = {
  enforcement_identify: 0,
  missing_fields: 1,
  needs_review: 2,
  enforcement_missing_fields: 3,
  notification_date_unconfirmed: 4,
  low_confidence: 5,
  anomaly: 6,
  enforcement_missing_docs: 7,
  security_flags: 8,
  no_assignee: 9,
  pending_relations: 10,
};

export interface CaseBlockerReason {
  text: string;
  href: string;
  kind: CaseBlockerKind;
}

export interface CaseBlockerInput {
  problematicCount: number;
  needsHumanReview: boolean;
  confidence: number | null;
  assignedToId: string | null;
  anomalyReason: string | null;
  securityFlagsCount: number;
  pendingRelationsCount: number;
  /** null quando nessun EnforcementDeviceCheck esiste per questa pratica (modulo non applicabile
   * o mai analizzato) — nessun blocker enforcement in quel caso (docs/SPEC-AUTOVELOX-DRAFT.md §8). */
  enforcement: {
    applicability: EnforcementCheckApplicability;
    needsHumanReview: boolean;
    missingDocumentCount: number;
  } | null;
  /** true quando `notification_date` ha un valore ma nessun operatore l'ha ancora confermato
   * esplicitamente (FASE 11, punto A3) — le scadenze di ricorso restano visibili ma provvisorie
   * finché questo non viene risolto; vedi `isNotificationDateUnconfirmed`. */
  notificationDateUnconfirmed: boolean;
}

/**
 * Stessa lista di blocker mostrata in "Prossima azione"/"Segna completata" (dettaglio
 * pratica) — unica fonte di verità, riusata anche server-side per rifiutare transizioni di
 * stato bloccate (docs/UX-AUDIT-2026-07.md, P0 #3): nessuna nuova logica di business, solo lo
 * stesso calcolo già esistente reso condiviso tra pagina ed endpoint.
 */
export function deriveCaseBlockers(input: CaseBlockerInput): CaseBlockerReason[] {
  const blockers: CaseBlockerReason[] = [];
  if (input.problematicCount > 0) {
    blockers.push({ text: `${input.problematicCount} dato/i mancante/i o da verificare`, href: "#dati-estratti", kind: "missing_fields" });
  }
  if (input.needsHumanReview) {
    blockers.push({ text: "La pratica richiede revisione umana", href: "#dati-estratti", kind: "needs_review" });
  }
  if (input.confidence !== null && input.confidence < LOW_CONFIDENCE_THRESHOLD) {
    blockers.push({
      text: `Confidenza classificazione bassa (${Math.round(input.confidence * 100)}%)`,
      href: "#sintesi",
      kind: "low_confidence",
    });
  }
  if (!input.assignedToId) {
    blockers.push({ text: "Nessun responsabile assegnato", href: "#sintesi", kind: "no_assignee" });
  }
  if (input.anomalyReason) {
    blockers.push({ text: `Anomalia fattura: ${input.anomalyReason}`, href: "#dati-estratti", kind: "anomaly" });
  }
  if (input.securityFlagsCount > 0) {
    blockers.push({
      text: `${input.securityFlagsCount} segnale/i di sicurezza rilevato/i nelle email`,
      href: "#email",
      kind: "security_flags",
    });
  }
  if (input.pendingRelationsCount > 0) {
    blockers.push({
      text: `${input.pendingRelationsCount} collegamento/i pratica da verificare`,
      href: "#relazioni",
      kind: "pending_relations",
    });
  }
  if (input.enforcement) {
    if (input.enforcement.applicability === "TO_BE_IDENTIFIED") {
      blockers.push({ text: "Dispositivo di rilevamento da identificare", href: "#verifica-autovelox", kind: "enforcement_identify" });
    } else {
      if (input.enforcement.needsHumanReview) {
        blockers.push({ text: "Dati del dispositivo da confermare", href: "#verifica-autovelox", kind: "enforcement_missing_fields" });
      }
      if (input.enforcement.missingDocumentCount > 0) {
        blockers.push({
          text: `${input.enforcement.missingDocumentCount} documento/i tecnico/i mancante/i`,
          href: "#verifica-autovelox",
          kind: "enforcement_missing_docs",
        });
      }
    }
  }
  if (input.notificationDateUnconfirmed) {
    blockers.push({ text: "Data di notifica da confermare", href: "#dati-estratti", kind: "notification_date_unconfirmed" });
  }
  // Nessun pareggio possibile: ogni kind ha una priorità univoca (vedi commento su
  // BLOCKER_PRIORITY), quindi l'ordine risultante non dipende dalla stabilità di `sort` né
  // dall'ordine dei `push` sopra.
  return blockers.sort((a, b) => BLOCKER_PRIORITY[a.kind] - BLOCKER_PRIORITY[b.kind]);
}

/**
 * Ricarica solo i dati necessari per calcolare i blocker di una pratica dato il suo id —
 * usato dagli endpoint che devono rivalidare lato server senza il caseRecord già caricato
 * dalla pagina (PATCH /api/cases/[id]/status, P0 #3: il bottone disabilitato lato client non
 * è mai l'unica barriera).
 */
export async function getCaseBlockers(caseId: string): Promise<CaseBlockerReason[]> {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      needsHumanReview: true,
      confidence: true,
      assignedToId: true,
      fields: { select: { fieldKey: true, value: true, needsHumanReview: true, confirmedAt: true, confirmedBy: { select: { name: true } } } },
      messages: { select: { securityFlags: true } },
      relationsAsSource: { where: { status: "PENDING" }, select: { id: true } },
      enforcementDeviceCheck: {
        select: {
          applicability: true,
          needsHumanReview: true,
          documentChecks: { select: { documentType: true, status: true } },
        },
      },
    },
  });
  if (!caseRecord) return [];

  const problematicCount = caseRecord.fields.filter((f) => classifyFieldTier(f) === "problematic").length;
  const anomalyReason = caseRecord.fields.find((f) => f.fieldKey === "anomaly_reason")?.value ?? null;
  const securityFlagsCount = new Set(
    caseRecord.messages.flatMap((m) => (Array.isArray(m.securityFlags) ? (m.securityFlags as string[]) : [])),
  ).size;

  return deriveCaseBlockers({
    problematicCount,
    needsHumanReview: caseRecord.needsHumanReview,
    confidence: caseRecord.confidence,
    assignedToId: caseRecord.assignedToId,
    anomalyReason,
    securityFlagsCount,
    pendingRelationsCount: caseRecord.relationsAsSource.length,
    enforcement: caseRecord.enforcementDeviceCheck
      ? {
          applicability: caseRecord.enforcementDeviceCheck.applicability,
          needsHumanReview: caseRecord.enforcementDeviceCheck.needsHumanReview,
          missingDocumentCount: countMissingRequiredDocuments(caseRecord.enforcementDeviceCheck.documentChecks),
        }
      : null,
    notificationDateUnconfirmed: isNotificationDateUnconfirmed(caseRecord.fields),
  });
}
