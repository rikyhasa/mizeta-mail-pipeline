import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import {
  AUDIT_ACTION_LABELS,
  CASE_CATEGORY_LABELS,
  CASE_PRIORITY_LABELS,
  CASE_RELATION_KIND_LABELS,
  CASE_RELATION_STATUS_LABELS,
  CASE_STATUS_LABELS,
  DEADLINE_KIND_LABELS,
  FIELD_SOURCE_TYPE_LABELS,
} from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { CATEGORY_FIELD_ORDER, fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CaseCategory, CaseStatus, GeneratedDocumentType } from "@/generated/prisma/enums";
import { ActionButton } from "@/components/ActionButton";
import { InlineSelect } from "@/components/InlineSelect";
import { FieldEditForm } from "./_components/FieldEditForm";
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

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  NORMAL: "bg-slate-100 text-slate-700",
  LOW: "bg-slate-50 text-slate-500",
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">{caseRecord.reference}</span>
          <span className="inline-flex items-center gap-1">
            <CategoryIcon category={caseRecord.category} />
            {CASE_CATEGORY_LABELS[caseRecord.category]}
          </span>
          {caseRecord.isPec && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">PEC</span>}
          {caseRecord.needsHumanReview && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Da verificare</span>
          )}
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{caseRecord.title}</h1>
        {caseRecord.summary && <p className="max-w-3xl text-sm text-slate-600">{caseRecord.summary}</p>}
      </div>

      <section aria-label="Stato e responsabile" className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <InlineSelect url={`/api/cases/${caseRecord.id}/status`} fieldName="status" value={caseRecord.status} options={statusOptions} label="Stato" />
        <InlineSelect
          url={`/api/cases/${caseRecord.id}/assign`}
          fieldName="assignedToId"
          value={caseRecord.assignedToId ?? ""}
          options={assigneeOptions}
          label="Responsabile"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Priorità</span>
          <span className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[caseRecord.priority]}`}>
            {CASE_PRIORITY_LABELS[caseRecord.priority]}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Confidenza classificazione</span>
          <span className="text-sm text-slate-700">{caseRecord.confidence !== null ? `${Math.round(caseRecord.confidence * 100)}%` : "—"}</span>
        </div>
        {caseRecord.status !== "COMPLETED" && caseRecord.status !== "ARCHIVED" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Azione rapida</span>
            <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/status`} body={{ status: "COMPLETED" }}>
              Segna completata
            </ActionButton>
          </div>
        )}
      </section>

      <section aria-label="Scadenze" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Scadenze</h2>
        {caseRecord.deadlines.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna scadenza rilevata.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {caseRecord.deadlines.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700">{DEADLINE_KIND_LABELS[d.kind]}:</span>
                <span className="font-medium text-slate-900">{formatDate(d.dueAt)}</span>
                {d.isCritical && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">Critica</span>}
                {d.resolvedAt && <span className="text-xs text-slate-400">(risolta il {formatDate(d.resolvedAt)})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Campi estratti" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Dati estratti</h2>
        {!isExtractableCategory(caseRecord.category) ? (
          <p className="text-sm text-slate-500">Questa categoria riceve solo classificazione e sintesi, senza estrazione campi dedicata.</p>
        ) : orderedFieldKeys.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun campo ancora estratto.</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {orderedFieldKeys.map((key) => {
              const field = fieldsByKey.get(key);
              if (!field) return null;
              return (
                <div key={key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="sm:w-1/3">
                    <span className="text-sm font-medium text-slate-700">{fieldLabel(key)}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 text-sm text-slate-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{field.value ? formatFieldValue(key, field.value) : "—"}</span>
                      {field.confidence !== null && <span className="text-xs text-slate-400">Confidenza {Math.round(field.confidence * 100)}%</span>}
                      {field.needsHumanReview && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Da verificare</span>}
                      {field.confirmedBy && <span className="text-xs text-emerald-700">Confermato da {field.confirmedBy.name}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {field.sourceType && <span>Fonte: {FIELD_SOURCE_TYPE_LABELS[field.sourceType]}</span>}
                      {field.sourceMessageId && <a href={`#msg-${field.sourceMessageId}`} className="underline hover:text-slate-900">
                        Vedi email di origine
                      </a>}
                      {field.sourceAttachmentId && (
                        <a href={`/api/attachments/${field.sourceAttachmentId}`} target="_blank" rel="noreferrer" className="underline hover:text-slate-900">
                          Apri allegato di origine
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/fields/${key}`} body={{}}>
                        Conferma
                      </ActionButton>
                      <FieldEditForm caseId={caseRecord.id} fieldKey={key} initialValue={field.value ?? ""} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Allegati" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Allegati</h2>
        {caseRecord.messages.every((m) => m.attachments.length === 0) ? (
          <p className="text-sm text-slate-500">Nessun allegato.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {caseRecord.messages.flatMap((m) =>
              m.attachments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  {a.isReadable ? (
                    <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-slate-900 underline hover:text-slate-700">
                      {a.fileName}
                    </a>
                  ) : (
                    <span className="text-slate-500">{a.fileName}</span>
                  )}
                  <span className="text-xs text-slate-400">({a.mimeType}, {(a.sizeBytes / 1024).toFixed(0)} KB)</span>
                  {!a.isReadable && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Illeggibile</span>}
                </li>
              )),
            )}
          </ul>
        )}
      </section>

      <section aria-label="Cronologia email" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Cronologia email</h2>
        <ul className="flex flex-col gap-4">
          {caseRecord.messages.map((m) => (
            <li key={m.id} id={`msg-${m.id}`} className="rounded border border-slate-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress} — {formatDateTime(m.receivedAt)}
                </span>
                {m.isPec && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">PEC</span>}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">{m.subject}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.bodyText}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Anomalie" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Anomalie</h2>
        {securityFlags.length === 0 && pendingRelations.length === 0 && !fieldsByKey.get("anomaly_reason")?.value ? (
          <p className="text-sm text-slate-500">Nessuna anomalia rilevata.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-slate-700">
            {fieldsByKey.get("anomaly_reason")?.value && <li>Fattura: {fieldsByKey.get("anomaly_reason")!.value}</li>}
            {securityFlags.map((flag) => (
              <li key={flag}>Segnale di sicurezza rilevato nel contenuto email: <span className="font-mono text-xs">{flag}</span></li>
            ))}
            {pendingRelations.map((r) => (
              <li key={r.id}>
                {CASE_RELATION_KIND_LABELS[r.kind]} con {r.relatedCase.reference} — {r.relatedCase.title} (confidenza{" "}
                {r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : "n/d"})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Attività" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Attività</h2>
        {caseRecord.tasks.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">Nessuna attività.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-1.5 text-sm">
            {caseRecord.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span className="text-slate-900">{t.title}</span>
                <span className="text-xs text-slate-500">{t.assignedTo?.name ?? "Non assegnata"}</span>
                {t.dueAt && <span className="text-xs text-slate-500">entro {formatDate(t.dueAt)}</span>}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
        <TaskForm caseId={caseRecord.id} users={users} />
      </section>

      <section aria-label="Commenti" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Commenti interni</h2>
        {caseRecord.comments.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">Nessun commento.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2 text-sm">
            {caseRecord.comments.map((c) => (
              <li key={c.id} className="rounded border border-slate-100 p-2">
                <div className="text-xs text-slate-500">
                  {c.author.name} — {formatDateTime(c.createdAt)}
                </div>
                <div className="text-slate-800">{c.body}</div>
              </li>
            ))}
          </ul>
        )}
        <CommentForm caseId={caseRecord.id} />
      </section>

      <section aria-label="Bozze di risposta" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Bozze di risposta</h2>
        <p className="mb-3 text-xs text-slate-500">Le bozze non vengono mai inviate: richiedono sempre approvazione umana esplicita.</p>
        {caseRecord.emailDrafts.length === 0 && <p className="mb-3 text-sm text-slate-500">Nessuna bozza generata.</p>}
        <div className="mb-3 flex flex-col gap-3">
          {caseRecord.emailDrafts.map((d) => (
            <DraftCard key={d.id} caseId={caseRecord.id} draft={d} />
          ))}
        </div>
        <ActionButton
          method="POST"
          url={`/api/cases/${caseRecord.id}/drafts`}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
        >
          Crea bozza
        </ActionButton>
      </section>

      <section aria-label="Documenti generati" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Documenti generati</h2>
        {caseRecord.generatedDocuments.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">Nessun documento generato.</p>
        ) : (
          <ul className="mb-3 text-sm text-slate-700">
            {caseRecord.generatedDocuments.map((doc) => (
              <li key={doc.id}>
                {doc.storageKey ? (
                  <a
                    href={`/api/cases/${caseRecord.id}/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 underline hover:text-indigo-900"
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
          <p className="text-xs text-slate-400">Nessun modello documento disponibile per questa categoria.</p>
        )}
      </section>

      <section aria-label="Pratiche collegate" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Collega o separa pratica</h2>
        {pendingRelations.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Candidati da verificare</h3>
            {pendingRelations.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm">
                <span>
                  {CASE_RELATION_KIND_LABELS[r.kind]}: {r.relatedCase.reference} — {r.relatedCase.title}
                </span>
                <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/relations/${r.id}`} body={{ action: "confirm" }}>
                  Conferma
                </ActionButton>
                <ActionButton method="PATCH" url={`/api/cases/${caseRecord.id}/relations/${r.id}`} body={{ action: "reject" }}>
                  Rifiuta
                </ActionButton>
              </div>
            ))}
          </div>
        )}
        {otherRelations.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
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
      </section>

      <section aria-label="Audit log" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Registro attività (audit log)</h2>
        <ul className="flex flex-col gap-1 text-xs text-slate-500">
          {caseRecord.auditLogs.map((log) => (
            <li key={log.id}>
              {formatDateTime(log.createdAt)} — {AUDIT_ACTION_LABELS[log.action]} {log.actor ? `(${log.actor.name})` : "(sistema)"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
