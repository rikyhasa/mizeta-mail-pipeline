import { ShieldAlert, Check, AlertTriangle } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ActionButton";
import { InlineSelect } from "@/components/InlineSelect";
import { ExtractedFieldCell } from "./ExtractedFieldCell";
import { EnforcementDocumentLinkForm } from "./EnforcementDocumentLinkForm";
import { tierFields } from "./field-tiers";
import { fieldLabel, formatFieldValue, ENFORCEMENT_DEVICE_FIELD_ORDER } from "@/lib/i18n/field-labels";
import {
  ENFORCEMENT_CHECK_APPLICABILITY_LABELS,
  ENFORCEMENT_VERIFICATION_STATE_LABELS,
  ENFORCEMENT_DOCUMENT_TYPE_LABELS,
  ENFORCEMENT_DOCUMENT_STATUS_LABELS,
  ENFORCEMENT_REGISTRY_MATCH_LABELS,
} from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
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

interface EnforcementFieldData {
  fieldKey: string;
  value: string | null;
  confidence: number | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
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
}: {
  caseId: string;
  check: EnforcementCheckData | null;
  attachments: { id: string; fileName: string }[];
  permissions: { canConfirm: boolean; canRequestDocuments: boolean; canLegalEscalate: boolean };
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

  return (
    <WorkPanel id="verifica-autovelox" title="Verifica autovelox">
      <div className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-ink-muted)]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Questo pannello verifica la presenza e la coerenza della documentazione tecnica disponibile. Non esprime alcuna
          valutazione sulla validità della sanzione né sull&apos;esito di un eventuale ricorso.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div>
          <span className="detail-label">Stato verifica</span>
          <div className="mt-1">
            <Badge tone={STATE_TONE[check.state]}>{ENFORCEMENT_VERIFICATION_STATE_LABELS[check.state]}</Badge>
          </div>
          {check.confirmedByName && <span className="mt-1 block text-xs text-[var(--color-ink-muted)]">Confermato da {check.confirmedByName}</span>}
        </div>
        <div>
          <span className="detail-label">Confronto registro MIT</span>
          <div className="mt-1">
            <Badge tone={REGISTRY_MATCH_TONE[check.registryMatch ?? "NOT_CONSULTED"]}>
              {ENFORCEMENT_REGISTRY_MATCH_LABELS[check.registryMatch ?? "NOT_CONSULTED"]}
            </Badge>
          </div>
          {check.registrySnapshot && (
            <span className="mt-1 block text-xs text-[var(--color-ink-muted)]">
              Registro consultato il {formatDateTime(check.registrySnapshot.fetchedAt)}
            </span>
          )}
        </div>
      </div>

      {permissions.canConfirm && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="max-w-xs">
            <InlineSelect
              url={`/api/cases/${caseId}/enforcement/check`}
              fieldName="applicability"
              value={check.applicability}
              label="Tipo di dispositivo"
              options={APPLICABILITY_OPTIONS}
            />
          </div>
          <ActionButton method="PATCH" url={`/api/cases/${caseId}/enforcement/check`} body={{}} variant="tertiary" size="sm">
            Conferma identificazione
          </ActionButton>
        </div>
      )}

      {tieredFields.length > 0 && (
        <div className="detail-field-grid mt-4">
          {tieredFields.map(({ key, field, tier }, index) => (
            <ExtractedFieldCell
              key={key}
              caseId={caseId}
              fieldKey={key}
              label={fieldLabel(key)}
              formattedValue={field.value ? formatFieldValue(key, field.value) : null}
              field={field}
              tier={tier}
              spanFull={tieredFields.length % 2 !== 0 && index === tieredFields.length - 1}
              endpointBase={`/api/cases/${caseId}/enforcement/fields`}
            />
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <span className="detail-label">Documentazione tecnica</span>
        <ul className="mt-2 flex flex-col gap-2">
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
                  <a
                    href={`/api/attachments/${doc.attachmentId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[var(--color-brand-dark)] hover:underline"
                  >
                    {doc.attachmentFileName}
                  </a>
                )}
                {permissions.canConfirm && status !== "PRESENT" && (
                  <EnforcementDocumentLinkForm caseId={caseId} documentType={type} attachments={attachments} />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
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
    </WorkPanel>
  );
}
