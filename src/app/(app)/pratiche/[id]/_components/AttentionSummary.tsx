import { AlertTriangle } from "lucide-react";
import { CASE_RELATION_KIND_LABELS } from "@/lib/i18n/labels";
import type { RelationSummary } from "./relation-types";

/** "Attenzione richiesta" (FASE 8B, composizione vincolante #3): sostituisce AnomaliesCard,
 * mostrata solo se esistono problemi reali — mai una card vuota per "Nessuna anomalia
 * rilevata" (problema #3 del task doc). Assorbe anche i campi problematici di "Dati estratti"
 * e il flag needsHumanReview della pratica, cosi il primo dato mancante è visibile sopra la
 * piega invece di comparire solo scendendo fino a "Dati estratti" (problema #5). */
export function AttentionSummary({
  problematicFieldLabels,
  problematicFieldsCount,
  anomalyReason,
  securityFlags,
  pendingRelations,
  needsHumanReview,
}: {
  problematicFieldLabels: string[];
  problematicFieldsCount: number;
  anomalyReason: string | null;
  securityFlags: string[];
  pendingRelations: RelationSummary[];
  needsHumanReview: boolean;
}) {
  const hasProblems =
    problematicFieldsCount > 0 || !!anomalyReason || securityFlags.length > 0 || pendingRelations.length > 0 || needsHumanReview;
  if (!hasProblems) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_35%,white)] bg-[var(--color-warning-soft)] p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Attenzione richiesta</h2>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-[var(--color-ink)]">
        {problematicFieldsCount > 0 && (
          <li>
            <a href="#dati-estratti" className="hover:underline">
              {problematicFieldsCount} dato/i mancante/i o da verificare: {problematicFieldLabels.join(", ")}
              {problematicFieldsCount > problematicFieldLabels.length ? "…" : ""}
            </a>
          </li>
        )}
        {needsHumanReview && <li>La pratica è segnalata per revisione umana.</li>}
        {anomalyReason && <li>Fattura: {anomalyReason}</li>}
        {securityFlags.map((flag) => (
          <li key={flag}>
            Segnale di sicurezza nel contenuto email: <span className="font-mono text-xs">{flag}</span>
          </li>
        ))}
        {pendingRelations.length > 0 && (
          <li>
            <a href="#relazioni" className="hover:underline">
              {pendingRelations.length} collegamento/i pratica da verificare
              {pendingRelations
                .slice(0, 2)
                .map((r) => ` · ${CASE_RELATION_KIND_LABELS[r.kind]} con ${r.reference}`)
                .join("")}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
