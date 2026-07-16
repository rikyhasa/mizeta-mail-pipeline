import { FileBarChart, Lock } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getDocumentTemplateStats, CATEGORY_BY_IMPLEMENTED_TYPE } from "@/lib/documents/report-queries";
import { Badge } from "@/components/ui/Badge";
import { TemplateCard } from "./_components/TemplateCard";
import type { GeneratedDocumentType } from "@/generated/prisma/enums";

/** Gli 8 modelli di SPEC.md §12, nell'ordine del documento. Descrizioni brevi, oneste sul
 * contenuto reale — non promesse su dati non disponibili. */
const TEMPLATE_ORDER: GeneratedDocumentType[] = [
  "QUOTE_SHEET",
  "TRANSPORT_ORDER_SHEET",
  "CLAIM_DOSSIER",
  "FINE_SHEET",
  "DEADLINES_REPORT",
  "DAILY_BRIEFING",
  "OVERDUE_RECEIVABLES_REPORT",
  "SUPPLIER_INVOICES_REPORT",
];

const TEMPLATE_DESCRIPTIONS: Record<GeneratedDocumentType, string> = {
  QUOTE_SHEET: "Dati richiesta, tratta, carico e campi mancanti",
  TRANSPORT_ORDER_SHEET: "Riferimenti, finestre, mezzo e istruzioni",
  CLAIM_DOSSIER: "Danno, foto, CMR, importi e cronologia",
  FINE_SHEET: "Verbale, veicolo, importi e scadenze",
  DEADLINES_REPORT: "Scadenze amministrative ordinate per urgenza",
  DAILY_BRIEFING: "Priorità, assegnazioni e anomalie della giornata",
  OVERDUE_RECEIVABLES_REPORT: "Crediti scaduti e promesse di pagamento non verificate",
  SUPPLIER_INVOICES_REPORT: "Fatture fornitore, totali e scadenze",
};

/** "Report e documenti" (FASE 3, tappa 5): a differenza della reference (galleria statica
 * mock, ogni card punta a un caseId hardcoded), qui solo 3 modelli su 8 hanno generazione
 * server-side reale (QUOTE_SHEET/CLAIM_DOSSIER/FINE_SHEET — v. `pratiche/[id]/page.tsx`,
 * `IMPLEMENTED_TYPES` nella route API). Gli altri 5 (compresa "Scheda ordine di trasporto",
 * mai implementata nemmeno per-pratica; e i 4 report aggregati, che richiederebbero rendere
 * `GeneratedDocument.caseId` opzionale e una nuova generazione cross-pratica — funzionalità
 * backend mai esistita, fuori perimetro di un porting UI) restano "Non ancora disponibile",
 * onesti sullo stato reale invece di un bottone "Genera" finto. */
export default async function ReportPage() {
  await requireUserOrRedirect();
  const stats = await getDocumentTemplateStats();
  const statsByType = new Map(stats.map((s) => [s.type, s]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--color-brand)] uppercase">Documenti operativi</p>
        <h1 className="mt-1 text-page-title font-semibold text-[var(--color-ink)]">Report e documenti</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Template stampabili generati solo da dati reali e verificati.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TEMPLATE_ORDER.map((type) => (
          <TemplateCard
            key={type}
            type={type}
            description={TEMPLATE_DESCRIPTIONS[type]}
            stats={statsByType.get(type) ?? null}
            category={CATEGORY_BY_IMPLEMENTED_TYPE[type] ?? null}
          />
        ))}
      </div>

      <div className="detail-panel bg-[var(--color-surface-muted)]">
        <div className="flex items-start gap-3.5">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-anthracite)]">
            <FileBarChart className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-card-title font-semibold text-[var(--color-ink)]">Presentazioni PowerPoint</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Report mensili clienti, gare, business review — pianificati per una fase successiva alla validazione dei
              documenti operativi (SPEC.md §12).
            </p>
          </div>
          <Badge tone="muted" icon={Lock}>
            Fase futura
          </Badge>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
