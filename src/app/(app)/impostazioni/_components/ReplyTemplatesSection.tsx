import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { ActionButton } from "@/components/ActionButton";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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
    <WorkPanel
      title="Modelli di risposta"
      description="Scheletro opzionale usato dalla generazione bozze; se assente per una categoria si usa uno scheletro di default."
    >
      <div className="mb-4 flex flex-col">
        {templates.map((t) => (
          <div key={t.id} className="detail-setting-row">
            <div>
              <div className="detail-setting-name">
                {t.name} {!t.isActive && <Badge tone="muted">Disattivo</Badge>}
              </div>
              <div className="detail-setting-desc">
                {t.category ? CASE_CATEGORY_LABELS[t.category] : "Generico"} · {t.subject}
              </div>
            </div>
            <ActionButton method="PATCH" url={`/api/settings/reply-templates/${t.id}`} body={{ isActive: !t.isActive }} size="sm">
              {t.isActive ? "Disattiva" : "Attiva"}
            </ActionButton>
          </div>
        ))}
        {templates.length === 0 && <EmptyState title="Nessun modello configurato" description="Si usano gli scheletri di default." />}
      </div>
      <NewReplyTemplateForm />
    </WorkPanel>
  );
}
