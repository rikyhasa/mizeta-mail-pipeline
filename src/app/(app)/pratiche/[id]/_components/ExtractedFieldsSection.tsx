import { WorkPanel } from "./WorkPanel";
import { ExtractedFieldCell } from "./ExtractedFieldCell";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";
import type { CaseCategory } from "@/generated/prisma/enums";
import type { TieredField } from "./field-tiers";

export function ExtractedFieldsSection({
  caseId,
  category,
  totalFieldCount,
  hasOrderedFields,
  problematic,
  other,
}: {
  caseId: string;
  category: CaseCategory;
  totalFieldCount: number;
  hasOrderedFields: boolean;
  problematic: TieredField[];
  other: TieredField[];
}) {
  return (
    <WorkPanel id="dati-estratti" title="Dati estratti" count={totalFieldCount}>
      {!isExtractableCategory(category) ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Questa categoria riceve solo classificazione e sintesi, senza estrazione campi dedicata.
        </p>
      ) : !hasOrderedFields ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessun campo ancora estratto.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {problematic.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {problematic.map(({ key, field, tier }) => (
                <ExtractedFieldCell
                  key={key}
                  caseId={caseId}
                  fieldKey={key}
                  label={fieldLabel(key)}
                  formattedValue={field.value ? formatFieldValue(key, field.value) : null}
                  field={field}
                  tier={tier}
                />
              ))}
            </div>
          )}
          {other.length > 0 && (
            <div className="detail-field-grid">
              {other.map(({ key, field, tier }, index) => (
                <ExtractedFieldCell
                  key={key}
                  caseId={caseId}
                  fieldKey={key}
                  label={fieldLabel(key)}
                  formattedValue={field.value ? formatFieldValue(key, field.value) : null}
                  field={field}
                  tier={tier}
                  spanFull={other.length % 2 !== 0 && index === other.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </WorkPanel>
  );
}
