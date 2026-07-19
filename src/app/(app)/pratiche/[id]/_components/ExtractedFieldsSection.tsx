import { WorkPanel } from "@/components/ui/WorkPanel";
import { ActionButton } from "@/components/ActionButton";
import { ExtractedFieldCell } from "./ExtractedFieldCell";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";
import type { CaseCategory } from "@/generated/prisma/enums";
import type { TieredField } from "./field-tiers";

/** Un'unica griglia compatta per tutti i campi — mancanti, da verificare, confermati — come
 * `.field-list` nella reference (FASE 8B, iterazione 3): nessun campo isolato in una riga a
 * tutta larghezza. Il conteggio dei problematici va in una sola riga sotto il titolo, non in
 * un blocco "Attenzione richiesta" separato (già coperto da "Prossima azione" in colonna
 * laterale). */
export function ExtractedFieldsSection({
  caseId,
  category,
  totalFieldCount,
  problematicCount,
  fields,
}: {
  caseId: string;
  category: CaseCategory;
  totalFieldCount: number;
  problematicCount: number;
  fields: TieredField[];
}) {
  return (
    <WorkPanel
      id="dati-estratti"
      title="Dati estratti"
      count={totalFieldCount}
      description={problematicCount > 0 ? `${problematicCount} dato/i mancante/i o da verificare` : undefined}
    >
      {!isExtractableCategory(category) ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Questa categoria riceve solo classificazione e sintesi, senza estrazione campi dedicata.
        </p>
      ) : fields.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessun campo ancora estratto.</p>
      ) : (
        <>
          {(() => {
            const highConfidenceCount = fields.filter((f) => f.tier === "middle").length;
            return highConfidenceCount > 0 ? (
              <div className="mb-3">
                <ActionButton method="POST" url={`/api/cases/${caseId}/fields/confirm-high-confidence`} variant="secondary" size="sm">
                  Conferma tutti i dati ad alta confidenza ({highConfidenceCount})
                </ActionButton>
              </div>
            ) : null;
          })()}
          <div className="detail-field-grid">
            {fields.map(({ key, field, tier }, index) => (
              <ExtractedFieldCell
                key={key}
                caseId={caseId}
                fieldKey={key}
                label={fieldLabel(key)}
                formattedValue={field.value ? formatFieldValue(key, field.value) : null}
                field={field}
                tier={tier}
                spanFull={fields.length % 2 !== 0 && index === fields.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </WorkPanel>
  );
}
