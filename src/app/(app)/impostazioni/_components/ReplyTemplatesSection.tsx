import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { ActionButton } from "@/components/ActionButton";
import { NewReplyTemplateForm } from "./NewReplyTemplateForm";
import type { CaseCategory } from "@/generated/prisma/enums";

interface ReplyTemplateRow {
  id: string;
  category: CaseCategory | null;
  name: string;
  subject: string;
  isActive: boolean;
}

export function ReplyTemplatesSection({ templates }: { templates: ReplyTemplateRow[] }) {
  return (
    <section aria-label="Modelli di risposta" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Modelli di risposta</h2>
      <p className="mb-3 text-xs text-slate-500">
        Scheletro opzionale usato dalla generazione bozze (§11); se assente per una categoria si usa uno scheletro di default.
      </p>
      <div className="mb-4 flex flex-col divide-y divide-slate-100">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <div className="font-medium text-slate-900">
                {t.name} {!t.isActive && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Disattivo</span>}
              </div>
              <div className="text-xs text-slate-500">
                {t.category ? CASE_CATEGORY_LABELS[t.category] : "Generico"} · {t.subject}
              </div>
            </div>
            <ActionButton method="PATCH" url={`/api/settings/reply-templates/${t.id}`} body={{ isActive: !t.isActive }}>
              {t.isActive ? "Disattiva" : "Attiva"}
            </ActionButton>
          </div>
        ))}
        {templates.length === 0 && <p className="py-2 text-sm text-slate-500">Nessun modello configurato: si usano gli scheletri di default.</p>}
      </div>
      <NewReplyTemplateForm />
    </section>
  );
}
