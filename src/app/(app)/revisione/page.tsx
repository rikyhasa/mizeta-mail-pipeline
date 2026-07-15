import Link from "next/link";
import type { ComponentType } from "react";
import { HelpCircle, AlertTriangle, ShieldAlert, Clock, Search, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { CASE_CATEGORY_LABELS, CASE_RELATION_KIND_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { fieldLabel } from "@/lib/i18n/field-labels";
import { formatDate } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, PriorityBadge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";

interface ReviewReason {
  tone: BadgeTone;
  icon: ComponentType<{ className?: string }>;
  text: string;
}

/**
 * Motivo concreto della verifica, derivato solo da dati già persistiti (confidenza,
 * campi che l'estrazione stessa ha segnalato come incerti, anomaly_reason, segnali di
 * sicurezza, scadenze critiche) — mai inventato e mai un conteggio su campi non richiesti
 * per questa categoria (usiamo il flag needsHumanReview già assegnato campo per campo,
 * non un controllo generico "valore nullo").
 */
function computeReasons(
  c: {
    confidence: number | null;
    fields: { fieldKey: string; value: string | null; needsHumanReview: boolean }[];
    deadlines: { dueAt: Date }[];
    messages: { securityFlags: unknown }[];
  },
  confidenceThreshold: number,
): ReviewReason[] {
  const reasons: ReviewReason[] = [];

  if (c.confidence !== null && c.confidence < confidenceThreshold) {
    reasons.push({
      tone: "warning",
      icon: HelpCircle,
      text: `Classificazione incerta (confidenza ${Math.round(c.confidence * 100)}%)`,
    });
  }

  const flaggedFields = c.fields.filter((f) => f.needsHumanReview);
  const missingFlagged = flaggedFields.filter((f) => !f.value);
  const uncertainWithValue = flaggedFields.filter((f) => f.value);

  if (missingFlagged.length === 1) {
    reasons.push({ tone: "critical", icon: AlertTriangle, text: `Manca ${fieldLabel(missingFlagged[0].fieldKey).toLowerCase()}` });
  } else if (missingFlagged.length > 1) {
    reasons.push({
      tone: "critical",
      icon: AlertTriangle,
      text: `Mancano ${missingFlagged.length} dati (es. ${fieldLabel(missingFlagged[0].fieldKey).toLowerCase()})`,
    });
  }

  if (uncertainWithValue.length === 1) {
    reasons.push({ tone: "warning", icon: HelpCircle, text: `Dato da verificare: ${fieldLabel(uncertainWithValue[0].fieldKey).toLowerCase()}` });
  } else if (uncertainWithValue.length > 1) {
    reasons.push({ tone: "warning", icon: HelpCircle, text: `${uncertainWithValue.length} dati da verificare` });
  }

  const anomalyReason = c.fields.find((f) => f.fieldKey === "anomaly_reason")?.value;
  if (anomalyReason) {
    reasons.push({ tone: "critical", icon: AlertTriangle, text: anomalyReason });
  }

  const hasSecurityFlag = c.messages.some((m) => Array.isArray(m.securityFlags) && m.securityFlags.length > 0);
  if (hasSecurityFlag) {
    reasons.push({ tone: "critical", icon: ShieldAlert, text: "Segnale di sicurezza rilevato nel contenuto email" });
  }

  if (c.deadlines[0]) {
    reasons.push({ tone: "critical", icon: Clock, text: `Scadenza critica: ${formatDate(c.deadlines[0].dueAt)}` });
  }

  if (reasons.length === 0) {
    reasons.push({ tone: "neutral", icon: Search, text: "Verifica manuale richiesta dalla pipeline" });
  }

  return reasons;
}

export default async function ReviewQueuePage() {
  await requireUserOrRedirect();
  const settings = await getRuleSettings();

  const pendingRelations = await prisma.caseRelation.findMany({
    where: { status: "PENDING" },
    include: {
      case: { select: { id: true, reference: true, title: true, category: true } },
      relatedCase: { select: { id: true, reference: true, title: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const coveredCaseIds = pendingRelations.map((r) => r.caseId);
  const casesToVerify = await prisma.case.findMany({
    where: { needsHumanReview: true, id: { notIn: coveredCaseIds } },
    select: {
      id: true,
      reference: true,
      title: true,
      category: true,
      priority: true,
      confidence: true,
      createdAt: true,
      fields: { select: { fieldKey: true, value: true, needsHumanReview: true } },
      deadlines: { where: { isCritical: true, resolvedAt: null }, select: { dueAt: true }, take: 1 },
      messages: { select: { securityFlags: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">Coda di revisione</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Possibili duplicati, pratiche correlate e pratiche che richiedono un controllo umano.
        </p>
      </div>

      <Card padding="compact">
        <CardHeader title="Possibili duplicati o pratiche correlate" />
        {pendingRelations.length === 0 ? (
          <EmptyState title="Nessun candidato in attesa di verifica" />
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingRelations.map((r) => (
              <li key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">
                  {CASE_RELATION_KIND_LABELS[r.kind]} — {r.reason ?? "Segnalato dalla pipeline"}
                  {r.confidence !== null && (
                    <span className="ml-2 font-normal text-[var(--color-ink-muted)]">
                      Confidenza {Math.round(r.confidence * 100)}%
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                      <CategoryIcon category={r.case.category} />
                      {CASE_CATEGORY_LABELS[r.case.category]}
                    </span>
                    <Link
                      href={`/pratiche/${r.case.id}`}
                      className="mt-1 block font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-dark)] hover:underline"
                    >
                      {r.case.reference} — {r.case.title}
                    </Link>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                      <CategoryIcon category={r.relatedCase.category} />
                      {CASE_CATEGORY_LABELS[r.relatedCase.category]}
                    </span>
                    <Link
                      href={`/pratiche/${r.relatedCase.id}`}
                      className="mt-1 block font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-dark)] hover:underline"
                    >
                      {r.relatedCase.reference} — {r.relatedCase.title}
                    </Link>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <ActionButton method="PATCH" url={`/api/cases/${r.caseId}/relations/${r.id}`} body={{ action: "confirm" }} variant="primary" size="sm">
                    Unisci le pratiche
                  </ActionButton>
                  <ActionButton method="PATCH" url={`/api/cases/${r.caseId}/relations/${r.id}`} body={{ action: "reject" }} variant="secondary" size="sm">
                    Mantieni separate
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="compact">
        <CardHeader title="Pratiche da verificare" description="Ogni pratica indica il motivo concreto per cui richiede attenzione." />
        {casesToVerify.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Non ci sono elementi da verificare" description="Tutto sotto controllo." />
        ) : (
          <ul className="flex flex-col gap-3">
            {casesToVerify.map((c) => {
              const reasons = computeReasons(c, settings.classificationConfidenceThreshold);
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                        <CategoryIcon category={c.category} />
                        {CASE_CATEGORY_LABELS[c.category]}
                      </span>
                      <PriorityBadge priority={c.priority} />
                      <span className="text-xs text-[var(--color-ink-muted)]">creata il {formatDate(c.createdAt)}</span>
                    </div>
                    <Link
                      href={`/pratiche/${c.id}`}
                      className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-dark)] hover:underline"
                    >
                      {c.reference} — {c.title}
                    </Link>
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.map((reason, index) => (
                        <Badge key={index} tone={reason.tone} icon={reason.icon}>
                          {reason.text}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/pratiche/${c.id}`} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                      Apri pratica
                    </Link>
                    <ActionButton method="PATCH" url={`/api/cases/${c.id}/review`} variant="tertiary" size="sm">
                      Segna come verificata
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
