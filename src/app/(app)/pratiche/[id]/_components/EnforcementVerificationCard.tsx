import { ShieldAlert, Check, AlertTriangle } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Disclosure } from "@/components/ui/Disclosure";
import { buttonClassName } from "@/components/ui/Button";
import { ActionButton } from "@/components/ActionButton";
import { InlineSelect } from "@/components/InlineSelect";
import { ExtractedFieldCell } from "./ExtractedFieldCell";
import { EnforcementDocumentLinkForm } from "./EnforcementDocumentLinkForm";
import { tierFields, type TieredField } from "./field-tiers";
import { CTA_LABEL_BY_BLOCKER_KIND } from "./recommended-action";
import { fieldLabel, formatFieldValue, ENFORCEMENT_DEVICE_FIELD_ORDER } from "@/lib/i18n/field-labels";
import {
  ENFORCEMENT_CHECK_APPLICABILITY_LABELS,
  ENFORCEMENT_VERIFICATION_STATE_LABELS,
  ENFORCEMENT_DOCUMENT_TYPE_LABELS,
  ENFORCEMENT_DOCUMENT_STATUS_LABELS,
  ENFORCEMENT_REGISTRY_MATCH_LABELS,
} from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import type { CaseBlockerKind, CaseBlockerReason } from "@/lib/cases/blockers";
import type {
  EnforcementCheckApplicability,
  EnforcementDocumentStatus,
  EnforcementDocumentType,
  EnforcementRegistryMatchState,
  EnforcementVerificationState,
  FieldSourceType,
} from "@/generated/prisma/enums";

const STATE_TONE: Record<EnforcementVerificationState, BadgeTone> = {
  NOT_APPLICABLE: "muted",
  TO_BE_IDENTIFIED: "warning",
  IDENTIFIED: "success",
  DOCUMENTATION_TO_ACQUIRE: "warning",
  DOCUMENTATION_INCOMPLETE: "warning",
  DATA_CONFLICT: "critical",
  TO_BE_VERIFIED: "info",
  DOCUMENTED_VERIFICATION_COMPLETE: "success",
  REQUIRES_LEGAL_REVIEW: "critical",
};

const REGISTRY_MATCH_TONE: Record<EnforcementRegistryMatchState, BadgeTone> = {
  MATCH: "success",
  MISMATCH: "critical",
  NOT_FOUND: "warning",
  NOT_CONSULTED: "muted",
};

const DOCUMENT_TYPES = Object.keys(ENFORCEMENT_DOCUMENT_TYPE_LABELS) as EnforcementDocumentType[];
const APPLICABILITY_OPTIONS = Object.entries(ENFORCEMENT_CHECK_APPLICABILITY_LABELS).map(([value, label]) => ({ value, label }));
/** Campi effettivamente confrontati dal matcher registro MIT (Troncone C, §2.1.A) — solo per
 * questi ha senso l'etichetta "Verificato dal registro MIT" invece del bottone di conferma in
 * blocco generico; `decree_date`/`version`/`authority` non sono mai confrontati oggi. */
const REGISTRY_VERIFIABLE_FIELD_KEYS = new Set(["manufacturer", "model", "serial_number", "decree_number"]);
/** Sezione del Livello 2 da aprire di default in base al blocker corrente (FASE 11, Livello 1
 * "prossima azione" + Livello 2 "mai più di una sezione aperta"): stessa fonte di verità di
 * `blockers`/`recommended-action.ts`, nessuna nuova logica di priorità qui. */
const TIER2_SECTION_ANCHOR: Partial<Record<CaseBlockerKind, string>> = {
  enforcement_identify: "verifica-autovelox-identificazione",
  enforcement_missing_fields: "verifica-autovelox-identificazione",
  enforcement_missing_docs: "verifica-autovelox-documentazione",
};

interface EnforcementFieldData {
  fieldKey: string;
  value: string | null;
  confidence: number | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
  confirmedAt: Date | null;
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
}

interface EnforcementDocumentData {
  documentType: EnforcementDocumentType;
  status: EnforcementDocumentStatus;
  note: string | null;
  attachmentId: string | null;
  attachmentFileName: string | null;
}

export interface EnforcementCheckData {
  applicability: EnforcementCheckApplicability;
  state: EnforcementVerificationState;
  needsHumanReview: boolean;
  needsLegalReview: boolean;
  registryMatch: EnforcementRegistryMatchState | null;
  registrySnapshot: { fetchedAt: Date; sourceUrl: string } | null;
  confirmedByName: string | null;
  fields: EnforcementFieldData[];
  documentChecks: EnforcementDocumentData[];
}

interface EnforcementOutcome {
  label: string;
  tone: BadgeTone;
  /** Motivi in linguaggio operativo (mai un giudizio di merito) — vuoto quando l'esito è
   * "nessuna incoerenza rilevata". */
  reasons: string[];
}

/**
 * Esito complessivo del pannello (H1/ipotesi esterna sull'esito troppo nascosto): pura
 * derivazione presentazionale dagli stessi dati già mostrati più sotto (badge di stato,
 * campi, documenti) — nessuna nuova logica di business, nessun giudizio sulla validità della
 * sanzione (CLAUDE.md invariante 9), solo una sintesi di ciò che il resto del pannello già dice.
 */
function deriveEnforcementOutcome(
  check: Pick<EnforcementCheckData, "applicability" | "registryMatch">,
  missingDocumentCount: number,
  problematicFieldCount: number,
): EnforcementOutcome {
  if (check.applicability === "TO_BE_IDENTIFIED") {
    return { label: "Verifica non conclusa", tone: "warning", reasons: ["Dispositivo di rilevamento non identificato"] };
  }

  const reasons: string[] = [];
  if (problematicFieldCount > 0) reasons.push(`${problematicFieldCount} dato/i tecnico/i da confermare`);
  if (missingDocumentCount > 0) reasons.push(`${missingDocumentCount} documento/i tecnico/i mancante/i`);
  if (check.registryMatch === "MISMATCH") reasons.push("Dati dichiarati in conflitto con il registro MIT");
  else if (check.registryMatch === "NOT_FOUND") reasons.push("Dispositivo non risulta nel registro MIT alla data di consultazione");
  else if (check.registryMatch === null) reasons.push("Registro MIT non ancora consultato");

  if (check.registryMatch === "MISMATCH") return { label: "Dati in conflitto", tone: "critical", reasons };
  if (problematicFieldCount > 0 || missingDocumentCount > 0) return { label: "Documentazione incompleta", tone: "warning", reasons };
  if (check.registryMatch === "NOT_FOUND") return { label: "Verifica completata — dispositivo non nel registro MIT", tone: "warning", reasons };
  if (check.registryMatch === null) return { label: "Verifica completata — registro non ancora consultato", tone: "muted", reasons };
  return { label: "Verifica completata, nessuna incoerenza rilevata", tone: "success", reasons: [] };
}

/**
 * Pannello "Verifica autovelox" (docs/SPEC-AUTOVELOX-DRAFT.md §8): compare dopo la sintesi
 * operativa e prima dei dati estratti generici, solo per FINE_OR_PENALTY. Quando non applicabile
 * (o nessun controllo mai creato dalla pipeline, Tappa 4), una singola riga compatta — nessuna
 * card vuota (principio FASE 8B). Disclaimer obbligatorio e sempre visibile (CLAUDE.md
 * invariante 9): mai una valutazione di validità della sanzione, solo stati documentali e
 * confronti (es. con il registro MIT, sempre MATCH/MISMATCH/NOT_FOUND, mai una conclusione).
 */
export function EnforcementVerificationCard({
  caseId,
  check,
  attachments,
  permissions,
  blockers,
}: {
  caseId: string;
  check: EnforcementCheckData | null;
  attachments: { id: string; fileName: string }[];
  permissions: { canConfirm: boolean; canRequestDocuments: boolean; canLegalEscalate: boolean };
  /** Lista completa dei blocker della pratica (stessa fonte della sidebar, src/lib/cases/blockers.ts)
   * — il pannello ne usa solo quelli "enforcement_*" per mostrare la stessa azione consigliata
   * della sidebar (H9: mai due priorità diverse fra pannello e "Prossima azione"). */
  blockers: CaseBlockerReason[];
}) {
  if (!check || check.applicability === "NOT_APPLICABLE") {
    return (
      <WorkPanel id="verifica-autovelox" title="Verifica autovelox">
        <p className="text-sm text-[var(--color-ink-muted)]">Controllo velocità non applicabile a questa tipologia di verbale.</p>
      </WorkPanel>
    );
  }

  const tieredFields = tierFields(check.fields, ENFORCEMENT_DEVICE_FIELD_ORDER);
  const missingDocumentCount = DOCUMENT_TYPES.length - check.documentChecks.filter((d) => d.status === "PRESENT").length;
  const problematicFieldCount = tieredFields.filter((f) => f.tier === "problematic").length;
  const highConfidenceFieldCount = tieredFields.filter((f) => f.tier === "middle").length;
  const outcome = deriveEnforcementOutcome(check, missingDocumentCount, problematicFieldCount);
  const primaryEnforcementBlocker = blockers.find((b) => b.kind.startsWith("enforcement_"));

  // Livello 2, "mai più di una sezione aperta di default" (FASE 11): derivata dallo stesso
  // blocker già usato per la CTA sopra, non una seconda priorità calcolata qui. `anomalies` non
  // ha un CaseBlockerKind dedicato — si apre quando l'esito è critico (MISMATCH), unico caso in
  // cui i motivi meritano attenzione immediata senza un blocker enforcement_* specifico.
  const openTier2Section: "identify" | "documents" | "anomalies" | null =
    primaryEnforcementBlocker?.kind === "enforcement_identify" || primaryEnforcementBlocker?.kind === "enforcement_missing_fields"
      ? "identify"
      : primaryEnforcementBlocker?.kind === "enforcement_missing_docs"
        ? "documents"
        : outcome.tone === "critical"
          ? "anomalies"
          : null;

  // Campi confermati compressi di default (FASE 11, Livello 2): restano pienamente accessibili
  // (stesso ExtractedFieldCell, stessi controlli) dentro una Disclosure annidata chiusa — solo
  // non contano più tra i controlli visibili di default della sezione, che è già la vera fonte
  // di rumore quando quasi tutti i campi sono ok e solo uno o due restano da confermare.
  const actionableFields = tieredFields.filter((f) => f.tier !== "confirmed");
  const confirmedFields = tieredFields.filter((f) => f.tier === "confirmed");
  // `const`, non `check.registryMatch` inline: un parametro destrutturato non resta ristretto
  // (non-null) dentro una funzione annidata come `renderFieldGrid` per il controllo di flusso di
  // TypeScript, anche se qui non viene mai riassegnato.
  const registryMatch = check.registryMatch;

  function renderFieldGrid(list: TieredField[]) {
    return (
      <div className="detail-field-grid">
        {list.map(({ key, field, tier }, index) => (
          <ExtractedFieldCell
            key={key}
            caseId={caseId}
            fieldKey={key}
            label={fieldLabel(key)}
            formattedValue={field.value ? formatFieldValue(key, field.value) : null}
            field={field}
            tier={tier}
            spanFull={list.length % 2 !== 0 && index === list.length - 1}
            endpointBase={`/api/cases/${caseId}/enforcement/fields`}
            registryVerified={registryMatch === "MATCH" && REGISTRY_VERIFIABLE_FIELD_KEYS.has(key)}
          />
        ))}
      </div>
    );
  }

  const hasManualActions =
    (permissions.canRequestDocuments && missingDocumentCount > 0) ||
    (permissions.canConfirm && check.state !== "TO_BE_VERIFIED") ||
    (permissions.canLegalEscalate && check.state !== "REQUIRES_LEGAL_REVIEW");

  const fieldValueByKey = new Map(check.fields.map((f) => [f.fieldKey, f.value]));
  const essentialFieldValue = (key: string) => {
    const raw = fieldValueByKey.get(key) ?? null;
    return raw ? formatFieldValue(key, raw) : null;
  };
  const manufacturerModel = [essentialFieldValue("manufacturer"), essentialFieldValue("model")].filter(Boolean).join(" ") || "—";
  const essentialItems = [
    { label: "Tipo dispositivo", value: ENFORCEMENT_CHECK_APPLICABILITY_LABELS[check.applicability] },
    { label: "Produttore e modello", value: manufacturerModel },
    { label: "Matricola", value: essentialFieldValue("serial_number") ?? "—" },
    {
      label: "Registro MIT",
      value: check.registrySnapshot ? `Consultato il ${formatDateTime(check.registrySnapshot.fetchedAt)}` : "Non ancora consultato",
    },
  ];

  return (
    <WorkPanel id="verifica-autovelox" title="Verifica autovelox">
      <div className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-ink-muted)]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Questo pannello verifica la presenza e la coerenza della documentazione tecnica disponibile. Non esprime alcuna
          valutazione sulla validità della sanzione né sull&apos;esito di un eventuale ricorso.
        </span>
      </div>

      {/* Livello 1 — colpo d'occhio: esito, dati essenziali di sola lettura, un'unica azione
       * reale. Nessun controllo per campo qui (FASE 11): sono la leva principale per restare
       * sotto il target di ≤20 controlli visibili di default su una pratica problematica. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={outcome.tone}>{outcome.label}</Badge>
        <Badge tone={REGISTRY_MATCH_TONE[check.registryMatch ?? "NOT_CONSULTED"]}>
          {ENFORCEMENT_REGISTRY_MATCH_LABELS[check.registryMatch ?? "NOT_CONSULTED"]}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {essentialItems.map((item) => (
          <div key={item.label}>
            <dt className="detail-label">{item.label}</dt>
            <dd className="detail-value truncate font-normal">{item.value}</dd>
          </div>
        ))}
      </dl>

      {primaryEnforcementBlocker && (
        <a
          href={`#${TIER2_SECTION_ANCHOR[primaryEnforcementBlocker.kind] ?? "verifica-autovelox"}`}
          className={`mt-3 inline-flex ${buttonClassName({ variant: "primary", size: "sm" })}`}
        >
          {CTA_LABEL_BY_BLOCKER_KIND[primaryEnforcementBlocker.kind]}
        </a>
      )}

      {/* Livello 2 — espandibile, mai più di una sezione aperta di default. */}
      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
        <Disclosure
          id="verifica-autovelox-identificazione"
          defaultOpen={openTier2Section === "identify"}
          summary={
            problematicFieldCount > 0
              ? `Identificazione dispositivo — ${problematicFieldCount} dato/i da confermare`
              : `Identificazione dispositivo — ${tieredFields.length} dato/i confermati`
          }
        >
          {permissions.canConfirm && (
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="max-w-xs">
                <InlineSelect
                  url={`/api/cases/${caseId}/enforcement/check`}
                  fieldName="applicability"
                  value={check.applicability}
                  label="Tipo di dispositivo"
                  options={APPLICABILITY_OPTIONS}
                />
              </div>
              {check.applicability !== "TO_BE_IDENTIFIED" && (
                <ActionButton method="PATCH" url={`/api/cases/${caseId}/enforcement/check`} body={{}} variant="tertiary" size="sm">
                  Conferma identificazione
                </ActionButton>
              )}
            </div>
          )}
          {permissions.canConfirm && highConfidenceFieldCount > 0 && (
            <div className="mb-3">
              <ActionButton method="POST" url={`/api/cases/${caseId}/enforcement/fields/confirm-high-confidence`} variant="secondary" size="sm">
                Conferma tutti i dati ad alta confidenza ({highConfidenceFieldCount})
              </ActionButton>
            </div>
          )}
          {actionableFields.length > 0 && renderFieldGrid(actionableFields)}
          {confirmedFields.length === 0 && actionableFields.length === 0 && (
            <p className="text-sm text-[var(--color-ink-muted)]">Nessun dato tecnico disponibile.</p>
          )}
          {confirmedFields.length > 0 && (
            <Disclosure className="mt-3" defaultOpen={false} summary={`Campi confermati (${confirmedFields.length})`}>
              {renderFieldGrid(confirmedFields)}
            </Disclosure>
          )}
        </Disclosure>

        <Disclosure
          id="verifica-autovelox-documentazione"
          defaultOpen={openTier2Section === "documents"}
          summary={
            missingDocumentCount > 0
              ? `Documentazione tecnica — ${missingDocumentCount} mancante/i`
              : `Documentazione tecnica — completa (${DOCUMENT_TYPES.length})`
          }
        >
          <ul className="flex flex-col gap-2">
            {DOCUMENT_TYPES.map((type) => {
              const doc = check.documentChecks.find((d) => d.documentType === type) ?? null;
              const status = doc?.status ?? "MISSING";
              return (
                <li key={type} className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[var(--color-ink)]">{ENFORCEMENT_DOCUMENT_TYPE_LABELS[type]}</span>
                    <Badge tone={status === "PRESENT" ? "success" : status === "REQUESTED" ? "info" : "warning"} icon={status === "PRESENT" ? Check : AlertTriangle}>
                      {ENFORCEMENT_DOCUMENT_STATUS_LABELS[status]}
                    </Badge>
                  </div>
                  {doc?.attachmentFileName && doc.attachmentId && (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/attachments/${doc.attachmentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-[var(--color-brand-dark)] hover:underline"
                      >
                        {doc.attachmentFileName}
                      </a>
                      {permissions.canConfirm && status === "PRESENT" && (
                        <ActionButton
                          method="DELETE"
                          url={`/api/cases/${caseId}/enforcement/documents/${type}`}
                          variant="tertiary"
                          size="sm"
                          confirmMessage={`Scollegare "${doc.attachmentFileName}" da ${ENFORCEMENT_DOCUMENT_TYPE_LABELS[type]}?`}
                        >
                          Scollega
                        </ActionButton>
                      )}
                    </div>
                  )}
                  {permissions.canConfirm && status !== "PRESENT" && (
                    <EnforcementDocumentLinkForm caseId={caseId} documentType={type} attachments={attachments} />
                  )}
                </li>
              );
            })}
          </ul>
        </Disclosure>

        {(outcome.reasons.length > 0 || check.confirmedByName || check.registrySnapshot) && (
          <Disclosure defaultOpen={openTier2Section === "anomalies"} summary="Anomalie e motivazioni">
            <div className="flex flex-wrap items-center gap-2">
              <span className="detail-label">Stato verifica</span>
              <Badge tone={STATE_TONE[check.state]}>{ENFORCEMENT_VERIFICATION_STATE_LABELS[check.state]}</Badge>
            </div>
            {outcome.reasons.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-[var(--color-ink)]">
                {outcome.reasons.map((reason) => (
                  <li key={reason}>· {reason}</li>
                ))}
              </ul>
            )}
            {check.confirmedByName && (
              <p className="mt-2 text-xs text-[var(--color-ink-muted)]">Identificazione confermata da {check.confirmedByName}</p>
            )}
            {check.registrySnapshot && (
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Registro consultato il {formatDateTime(check.registrySnapshot.fetchedAt)}
              </p>
            )}
          </Disclosure>
        )}

        {hasManualActions && (
          <Disclosure defaultOpen={false} summary="Azioni manuali">
            <div className="flex flex-wrap gap-2">
              {permissions.canRequestDocuments && missingDocumentCount > 0 && (
                <ActionButton method="POST" url={`/api/cases/${caseId}/enforcement/request-documents`} variant="secondary" size="sm">
                  Richiedi documentazione
                </ActionButton>
              )}
              {permissions.canConfirm && check.state !== "TO_BE_VERIFIED" && (
                <ActionButton method="POST" url={`/api/cases/${caseId}/enforcement/technical-review`} variant="secondary" size="sm">
                  Segna per verifica tecnica
                </ActionButton>
              )}
              {permissions.canLegalEscalate && check.state !== "REQUIRES_LEGAL_REVIEW" && (
                <ActionButton
                  method="POST"
                  url={`/api/cases/${caseId}/enforcement/legal-escalate`}
                  variant="secondary"
                  size="sm"
                  confirmMessage="Segnalare questo dispositivo per verifica legale?"
                >
                  Segna per verifica legale
                </ActionButton>
              )}
            </div>
          </Disclosure>
        )}
      </div>
    </WorkPanel>
  );
}
