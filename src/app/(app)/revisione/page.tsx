import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { CASE_CATEGORY_LABELS, CASE_RELATION_KIND_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { formatDate } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";

export default async function ReviewQueuePage() {
  await requireUserOrRedirect();

  const pendingRelations = await prisma.caseRelation.findMany({
    where: { status: "PENDING" },
    include: {
      case: { select: { id: true, reference: true, title: true, category: true } },
      relatedCase: { select: { id: true, reference: true, title: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const coveredCaseIds = pendingRelations.map((r) => r.caseId);
  const lowConfidenceCases = await prisma.case.findMany({
    where: { needsHumanReview: true, id: { notIn: coveredCaseIds } },
    select: { id: true, reference: true, title: true, category: true, priority: true, confidence: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Coda di revisione</h1>
        <p className="text-sm text-slate-500">Possibili duplicati, pratiche correlate e classificazioni a bassa confidenza in attesa di verifica umana.</p>
      </div>

      <section aria-label="Possibili duplicati o pratiche correlate" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Possibili duplicati o pratiche correlate</h2>
        {pendingRelations.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun candidato in attesa di verifica.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingRelations.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-800">
                  <span className="font-medium">{CASE_RELATION_KIND_LABELS[r.kind]}</span> — {r.reason ?? "Segnalato dalla pipeline"}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <CategoryIcon category={r.case.category} />
                      <Link href={`/pratiche/${r.case.id}`} className="underline hover:text-slate-900">
                        {r.case.reference} — {r.case.title}
                      </Link>
                    </span>
                    <span>↔</span>
                    <span className="inline-flex items-center gap-1">
                      <CategoryIcon category={r.relatedCase.category} />
                      <Link href={`/pratiche/${r.relatedCase.id}`} className="underline hover:text-slate-900">
                        {r.relatedCase.reference} — {r.relatedCase.title}
                      </Link>
                    </span>
                    {r.confidence !== null && <span>Confidenza {Math.round(r.confidence * 100)}%</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    method="PATCH"
                    url={`/api/cases/${r.caseId}/relations/${r.id}`}
                    body={{ action: "confirm" }}
                    className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Conferma
                  </ActionButton>
                  <ActionButton
                    method="PATCH"
                    url={`/api/cases/${r.caseId}/relations/${r.id}`}
                    body={{ action: "reject" }}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
                  >
                    Non è un duplicato
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Bassa confidenza" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Bassa confidenza / da verificare</h2>
        {lowConfidenceCases.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna pratica da verificare.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lowConfidenceCases.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-800">
                  <span className="inline-flex items-center gap-1">
                    <CategoryIcon category={c.category} />
                    <Link href={`/pratiche/${c.id}`} className="underline hover:text-slate-900">
                      {c.reference} — {c.title}
                    </Link>
                  </span>
                  <div className="mt-1 text-xs text-slate-500">
                    {CASE_CATEGORY_LABELS[c.category]} · {c.confidence !== null ? `Confidenza ${Math.round(c.confidence * 100)}%` : "Confidenza n/d"} ·{" "}
                    creata il {formatDate(c.createdAt)}
                  </div>
                </div>
                <ActionButton
                  method="PATCH"
                  url={`/api/cases/${c.id}/review`}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
                >
                  Segna come verificata
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
