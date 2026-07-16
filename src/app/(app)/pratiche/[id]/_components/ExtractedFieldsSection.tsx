import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExtractedFieldCell } from "./ExtractedFieldCell";
import { classifyFieldTier } from "./field-tiers";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { CATEGORY_FIELD_ORDER, fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";
import type { CaseCategory, FieldSourceType } from "@/generated/prisma/enums";

interface CaseFieldData {
  fieldKey: string;
  value: string | null;
  confidence: number | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
}

export function ExtractedFieldsSection({
  caseId,
  category,
  fields,
}: {
  caseId: string;
  category: CaseCategory;
  fields: CaseFieldData[];
}) {
  const fieldOrder = isExtractableCategory(category) ? CATEGORY_FIELD_ORDER[category] : [];
  const fieldsByKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const orderedFieldKeys = [...fieldOrder, ...fields.map((f) => f.fieldKey).filter((k) => !fieldOrder.includes(k))];

  const fieldsWithTier = orderedFieldKeys
    .map((key) => {
      const field = fieldsByKey.get(key);
      return field ? { key, field, tier: classifyFieldTier(field) } : null;
    })
    .filter((f): f is { key: string; field: CaseFieldData; tier: ReturnType<typeof classifyFieldTier> } => f !== null);
  const problematicFields = fieldsWithTier.filter((f) => f.tier === "problematic");
  const otherFields = fieldsWithTier.filter((f) => f.tier !== "problematic");

  return (
    <Card padding="compact" id="dati-estratti" className="scroll-mt-24">
      <CardHeader title="Dati estratti" action={<Badge tone="neutral">{fields.length}</Badge>} />
      {!isExtractableCategory(category) ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Questa categoria riceve solo classificazione e sintesi, senza estrazione campi dedicata.
        </p>
      ) : orderedFieldKeys.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessun campo ancora estratto.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {problematicFields.length > 0 && (
            <div className="flex flex-col gap-3">
              {problematicFields.map(({ key, field, tier }) => (
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
          {otherFields.length > 0 && (
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2">
              {otherFields.map(({ key, field, tier }, index) => (
                <ExtractedFieldCell
                  key={key}
                  caseId={caseId}
                  fieldKey={key}
                  label={fieldLabel(key)}
                  formattedValue={field.value ? formatFieldValue(key, field.value) : null}
                  field={field}
                  tier={tier}
                  spanFull={otherFields.length % 2 !== 0 && index === otherFields.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
