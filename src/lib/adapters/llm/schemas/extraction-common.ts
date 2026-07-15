import { z } from "zod";

const FIELD_SOURCE_TYPE_VALUES = ["EMAIL_BODY", "EMAIL_SUBJECT", "ATTACHMENT", "MANUAL", "SYSTEM"] as const;

/**
 * Common shape for every extracted field (SPEC.md §6): value, normalized_value, confidence,
 * source_type, source_message_id, source_attachment_id, source_page, source_excerpt,
 * needs_human_review. `value`/`normalized_value` are always nullable, never omitted — missing
 * data is null, never invented (CLAUDE.md invariant 6).
 */
export function extractedField<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    normalized_value: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    source_type: z.enum(FIELD_SOURCE_TYPE_VALUES).nullable(),
    source_message_id: z.string().nullable(),
    source_attachment_id: z.string().nullable(),
    source_page: z.number().int().nullable(),
    source_excerpt: z.string().nullable(),
    needs_human_review: z.boolean(),
  });
}

export const extractedStringField = extractedField(z.string());
export const extractedNumberField = extractedField(z.number());
export const extractedBooleanField = extractedField(z.boolean());

export type ExtractedField<T> = ReturnType<typeof extractedField<z.ZodType<T>>>;
