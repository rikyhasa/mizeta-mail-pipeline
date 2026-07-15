import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Info, FileSearch, Mail, ListChecks, Files, History, AlertTriangle, Check, Paperclip } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import {
  AUDIT_ACTION_LABELS,
  CASE_CATEGORY_LABELS,
  CASE_RELATION_KIND_LABELS,
  CASE_RELATION_STATUS_LABELS,
  CASE_STATUS_LABELS,
  DEADLINE_KIND_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { CATEGORY_FIELD_ORDER, fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CaseCategory, CaseStatus, GeneratedDocumentType } from "@/generated/prisma/enums";
import { ActionButton } from "@/components/ActionButton";
import { InlineSelect } from "@/components/InlineSelect";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { FieldEditForm } from "./_components/FieldEditForm";
import { FieldSourceInfo } from "./_components/FieldSourceInfo";
import { CommentForm } from "./_components/CommentForm";
import { TaskForm } from "./_components/TaskForm";
import { DraftCard } from "./_components/DraftCard";
import { RelationForm } from "./_components/RelationForm";

/** Documenti implementati in questa fase (SPEC.md §12), uno per categoria prioritaria. Le
 * altre categorie non mostrano alcun selettore: nulla è ancora implementato per loro. */
const DOCUMENT_TYPE_BY_CATEGORY: Partial<Record<CaseCategory, { type: GeneratedDocumentType; label: string }>> = {
  QUOTE_REQUEST: { type: "QUOTE_SHEET", label: "Genera scheda preventivo" },
  CLAIM_OR_DAMAGE: { type: "CLAIM_DOSSIER", label: "Genera dossier reclamo" },
  FINE_OR_PENALTY: { type: "FINE_SHEET", label: "Genera scheda multa" },
};

async function loadCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      customer: true,
      supplier: true,
      assignedTo: { select: { id: true, name: true } },
      fields: { include: { sourceMessage: { select: { subject: true } }, confirmedBy: { select: { name: true } } } },
      deadlines: { orderBy: { dueAt: "asc" } },
      tasks: { include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      messages: { include: { attachments: true }, orderBy: { receivedAt: "asc" } },
      emailDrafts: { orderBy: { createdAt: "desc" } },
      generatedDocuments: { orderBy: { createdAt: "desc" } },
      auditLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      relationsAsSource: { include: { relatedCase: { select: { reference: true, title: true, category: true } } } },
      relationsAsTarget: { include: { case: { select: { reference: true, title: true, category: true } } } },
    },
  });
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserOrRedirect();
  const { id } = await params;

  const caseRecord = await loadCase(id);
  if (!caseRecord) notFound();

  await prisma.auditLog.create({
    data: { action: "CASE_VIEWED", entityType: "Case", entityId: caseRecord.id, caseId: caseRecord.id, actorId: user.id },
  });

  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const fieldOrder = isExtractableCategory(caseRecord.category) ? CATEGORY_FIELD_ORDER[caseRecord.category] : [];
  const fieldsByKey = new Map(caseRecord.fields.map((f) => [f.fieldKey, f]));
  const orderedFieldKeys = [...fieldOrder, ...caseRecord.fields.map((f) => f.fieldKey).filter((k) => !fieldOrder.includes(k))];

  const securityFlags = [...new Set(caseRecord.messages.flatMap((m) => (Array.isArray(m.securityFlags) ? (m.securityFlags as string[]) : [])))];
  const pendingRelations = caseRecord.relationsAsSource.filter((r) => r.status === "PENDING");
  const otherRelations = [
    ...caseRecord.relationsAsSource.filter((r) => r.status !== "PENDING"),
    ...caseRecord.relationsAsTarget,
  ];

  const statusOptions = (Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }));
  const assigneeOptions = [{ value: "", label: "Non assegnato" }, ...users.map((u) => ({ value: u.id, label: u.name }))];
  const nextDeadline = caseRecord.deadlines.find((d) => !d.resolvedAt) ?? null;
  const isOpenCase = caseRecord.status !== "COMPLETED" && caseRecord.status !== "ARCHIVED";

  const panoramicaContent: ReactNode = (
    <div className="flex flex-col gap-6">
      <Card padding="compact">
        <CardHeader title="Scadenze" />
        {caseRecord.deadlines.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Nessuna scadenza rilevata.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {caseRecord.deadlines.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--color-ink-muted)]">{DEADLINE_KIND_LABELS[d.kind]}:</span>
                <span className="font-medium text-[var(--color-ink)]">{formatDate(d.dueAt)}</span>
                {d.isCritical && <Badge tone="critical">Critica</Badge>}
                {d.resolvedAt && <span className="text-xs text-[var(--color-ink-muted)]">(risolta il {formatDate(d.resolvedAt)})</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="compact">
        <CardHeader title="Anomalie" />
        {securityFlags.length === 0 && pendingRelations.length === 0 && !fieldsByKey.get("anomaly_reason")?.value ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Nessuna anomalia rilevata.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-[var(--color-ink)]">
            {fieldsByKey.get("anomaly_reason")?.value && (
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                Fattura: {fieldsByKey.get("anomaly_reason")!.value}
              </li>
            )}
            {securityFlags.map((flag) => (
              <li key={flag} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                Segnale di sicurezza rilevato nel contenuto email: <span className="font-mono text-xs">{flag}</span>
              </li>
            ))}
            {pendingRelations.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                {CASE_RELATION_KIND_LABELS[r.kind]} con {r.relatedCase.reference} — {r.relatedCase.title} (confidenza{" "}
                {r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : "n/d"})
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  const datiEstrattiContent: ReactNode = (
    <Card padding="compact">
      {!isExtractableCategory(caseRecord.category) ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Questa categoria riceve solo classificazione e sintesi, senza estrazione campi dedicata.
        </p>
      ) : orderedFieldKeys.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessun campo ancora estratto.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--color-border)]">
          {orderedFieldKeys.map((key) => {
            const field = fieldsByKey.get(key);
            if (!field) return null;
            const pct = field.confidence !== null ? Math.round(field.confidence * 100) : null;
            const showLowConfidence = !field.needsHumanReview && pct !== null && pct < 70;
            return (
              <div key={key} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="sm:w-1/3">
                  <span className="text-sm font-medium text-[var(--color-ink)]">{fieldLabel(key)}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {field.value ? (
                      <span className="text-sm text-[var(--color-ink)]">{formatFieldValue(key, field.value)}</span>
                    ) : (
                      <Badge tone="warning" icon={AlertTriangle}>Dato mancante</Badge>
                    )}
                    {field.needsHumanReview && (
                      <Badge tone="warning">Da verificare{pct !== null ? ` · confidenza ${pct}%` : ""}</Badge>
                    )}
                    {showLowConfidence && <span className="text-xs text-[var(--color-ink-muted)]">Confidenza {pct}%</span>}
                    {field.confirmedBy && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-forest)]">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Confermato da {field.confirmedBy.name}
                      </span>
                    )}
                    <FieldSourceInfo
                      sourceType={field.sourceType}
                      sourceMessageId={field.sourceMessageId}
                      sourceAttachmentId={field.sourceAttachmentId}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!field.confirmedBy && (
                      <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/fields/${key}`} body={{}} size="sm">
                        Conferma
                      </ActionButton>
                    )}
                    <FieldEditForm caseId={caseRecord.id} fieldKey={key} initialValue={field.value ?? ""} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  const emailContent: ReactNode = (
    <div className="flex flex-col gap-6">
      <Card padding="compact">
        <CardHeader title="Allegati" />
        {caseRecord.messages.every((m) => m.attachments.length === 0) ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Nessun allegato.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {caseRecord.messages.flatMap((m) =>
              m.attachments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Paperclip className="h-4 w-4 text-[var(--color-ink-muted)]" aria-hidden="true" />
                  {a.isReadable ? (
                    <a
                      href={`/api/attachments/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--color-brand-dark)] hover:underline"
                    >
                      {a.fileName}
                    </a>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">{a.fileName}</span>
                  )}
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    ({a.mimeType}, {(a.sizeBytes / 1024).toFixed(0)} KB)
                  </span>
                  {!a.isReadable && <Badge tone="warning">Illeggibile</Badge>}
                </li>
              )),
            )}
          </ul>
        )}
      </Card>

      <Card padding="compact">
        <CardHeader title="Cronologia email" />
        <ul className="flex flex-col gap-4">
          {caseRecord.messages.map((m) => (
            <li key={m.id} id={`msg-${m.id}`} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
                <span>
                  {m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress} — {formatDateTime(m.receivedAt)}
                </span>
                {m.isPec && <Badge tone="info">PEC</Badge>}
              </div>
              <div className="mt-1 text-sm font-medium text-[var(--color-ink)]">{m.subject}</div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--color-ink)]">{m.bodyText}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );

  const attivitaContent: ReactNode = (
    <div className="flex flex-col gap-6">
      <Card padding="compact">
        <CardHeader title="Attività" />
        {caseRecord.tasks.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessuna attività.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2 text-sm">
            {caseRecord.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--color-ink)]">{t.title}</span>
                <span className="text-xs text-[var(--color-ink-muted)]">{t.assignedTo?.name ?? "Non assegnata"}</span>
                {t.dueAt && <span className="text-xs text-[var(--color-ink-muted)]">entro {formatDate(t.dueAt)}</span>}
                <Badge tone="neutral">{TASK_STATUS_LABELS[t.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
        <TaskForm caseId={caseRecord.id} users={users} />
      </Card>

      <Card padding="compact">
        <CardHeader title="Commenti interni" />
        {caseRecord.comments.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessun commento.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2 text-sm">
            {caseRecord.comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-[var(--color-border)] p-2">
                <div className="text-xs text-[var(--color-ink-muted)]">
                  {c.author.name} — {formatDateTime(c.createdAt)}
                </div>
                <div className="text-[var(--color-ink)]">{c.body}</div>
              </li>
            ))}
          </ul>
        )}
        <CommentForm caseId={caseRecord.id} />
      </Card>
    </div>
  );

  const documentiContent: ReactNode = (
    <div className="flex flex-col gap-6">
      <Card padding="compact">
        <CardHeader
          title="Bozze di risposta"
          description="Le bozze non vengono mai inviate: richiedono sempre approvazione umana esplicita."
        />
        {caseRecord.emailDrafts.length === 0 && <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessuna bozza generata.</p>}
        <div className="flex flex-col gap-3">
          {caseRecord.emailDrafts.map((d) => (
            <DraftCard key={d.id} caseId={caseRecord.id} draft={d} />
          ))}
        </div>
      </Card>

      <Card padding="compact">
        <CardHeader title="Documenti generati" />
        {caseRecord.generatedDocuments.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessun documento generato.</p>
        ) : (
          <ul className="mb-3 text-sm text-[var(--color-ink)]">
            {caseRecord.generatedDocuments.map((doc) => (
              <li key={doc.id}>
                {doc.storageKey ? (
                  <a
                    href={`/api/cases/${caseRecord.id}/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--color-brand-dark)] hover:underline"
                  >
                    {doc.type} ({doc.format})
                  </a>
                ) : (
                  <>
                    {doc.type} ({doc.format})
                  </>
                )}{" "}
                — {formatDateTime(doc.createdAt)}
              </li>
            ))}
          </ul>
        )}
        {DOCUMENT_TYPE_BY_CATEGORY[caseRecord.category] ? (
          <ActionButton
            method="POST"
            url={`/api/cases/${caseRecord.id}/documents`}
            body={{ type: DOCUMENT_TYPE_BY_CATEGORY[caseRecord.category]!.type, format: "PDF" }}
          >
            {DOCUMENT_TYPE_BY_CATEGORY[caseRecord.category]!.label}
          </ActionButton>
        ) : (
          <p className="text-xs text-[var(--color-ink-muted)]">Nessun modello documento disponibile per questa categoria.</p>
        )}
      </Card>

      <Card padding="compact">
        <CardHeader title="Collega o separa pratica" />
        {pendingRelations.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">Candidati da verificare</h3>
            {pendingRelations.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <span className="text-[var(--color-ink)]">
                  {CASE_RELATION_KIND_LABELS[r.kind]}: {r.relatedCase.reference} — {r.relatedCase.title}
                </span>
                <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/relations/${r.id}`} body={{ action: "confirm" }} size="sm">
                  Unisci le pratiche
                </ActionButton>
                <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/relations/${r.id}`} body={{ action: "reject" }} size="sm">
                  Mantieni separate
                </ActionButton>
              </div>
            ))}
          </div>
        )}
        {otherRelations.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
            {otherRelations.map((r) => {
              const other = "relatedCase" in r ? r.relatedCase : r.case;
              return (
                <li key={r.id}>
                  {CASE_RELATION_KIND_LABELS[r.kind]} — {other.reference} ({CASE_RELATION_STATUS_LABELS[r.status]})
                </li>
              );
            })}
          </ul>
        )}
        <RelationForm caseId={caseRecord.id} />
      </Card>
    </div>
  );

  const registroContent: ReactNode = (
    <Card padding="compact">
      <ul className="flex flex-col gap-1.5 text-xs text-[var(--color-ink-muted)]">
        {caseRecord.auditLogs.map((log) => (
          <li key={log.id}>
            {formatDateTime(log.createdAt)} — {AUDIT_ACTION_LABELS[log.action]} {log.actor ? `(${log.actor.name})` : "(sistema)"}
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <span className="font-mono">{caseRecord.reference}</span>
              <span className="inline-flex items-center gap-1.5">
                <CategoryIcon category={caseRecord.category} />
                {CASE_CATEGORY_LABELS[caseRecord.category]}
              </span>
              {caseRecord.isPec && <Badge tone="info">PEC</Badge>}
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-ink)]">{caseRecord.title}</h1>
            {caseRecord.summary && <p className="max-w-2xl text-sm text-[var(--color-ink-muted)]">{caseRecord.summary}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <StatusBadge status={caseRecord.status} />
              <PriorityBadge priority={caseRecord.priority} />
              {nextDeadline && (
                <span className="text-sm text-[var(--color-ink-muted)]">
                  Scadenza: <span className="font-medium text-[var(--color-ink)]">{formatDate(nextDeadline.dueAt)}</span>
                </span>
              )}
              {caseRecord.confidence !== null && (
                <span className="text-sm text-[var(--color-ink-muted)]">
                  Confidenza classificazione: {Math.round(caseRecord.confidence * 100)}%
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-[var(--color-surface-muted)] p-4 lg:w-72 lg:shrink-0">
            <InlineSelect
              url={`/api/cases/${caseRecord.id}/assign`}
              fieldName="assignedToId"
              value={caseRecord.assignedToId ?? ""}
              options={assigneeOptions}
              label="Responsabile"
            />
            <InlineSelect
              url={`/api/cases/${caseRecord.id}/status`}
              fieldName="status"
              value={caseRecord.status}
              options={statusOptions}
              label="Stato"
            />
            <div className="flex flex-col gap-2 pt-1">
              <ActionButton method="POST" url={`/api/cases/${caseRecord.id}/drafts`} variant="secondary" size="md">
                Crea risposta
              </ActionButton>
              {isOpenCase && (
                <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/status`} body={{ status: "COMPLETED" }} variant="primary" size="md">
                  Completa pratica
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { value: "panoramica", label: "Panoramica", icon: <Info className="h-4 w-4" />, content: panoramicaContent },
          { value: "dati", label: "Dati estratti", icon: <FileSearch className="h-4 w-4" />, content: datiEstrattiContent },
          { value: "email", label: "Email e allegati", icon: <Mail className="h-4 w-4" />, content: emailContent },
          { value: "attivita", label: "Attività e note", icon: <ListChecks className="h-4 w-4" />, content: attivitaContent },
          { value: "documenti", label: "Bozze e documenti", icon: <Files className="h-4 w-4" />, content: documentiContent },
          { value: "registro", label: "Registro attività", icon: <History className="h-4 w-4" />, content: registroContent },
        ]}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
