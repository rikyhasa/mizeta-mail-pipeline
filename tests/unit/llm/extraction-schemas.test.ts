import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EXTRACTION_SCHEMA_BY_CATEGORY } from "@/lib/adapters/llm/schemas/extraction-index";
import { extractedField } from "@/lib/adapters/llm/schemas/extraction-common";

const EMPTY_FIELD = {
  value: null,
  normalized_value: null,
  confidence: null,
  source_type: null,
  source_message_id: null,
  source_attachment_id: null,
  source_page: null,
  source_excerpt: null,
  needs_human_review: true,
};

function buildAllNullPayload(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    // I campi "array semplice" (missing_data, missing_documents, customer_references, ecc.)
    // non hanno la forma {value,...}: si riconoscono provando a fare il parse di [] prima.
    payload[key] = shape[key].safeParse([]).success ? [] : EMPTY_FIELD;
  }
  return payload;
}

describe("schemi di estrazione (SPEC.md §6)", () => {
  for (const [category, schema] of Object.entries(EXTRACTION_SCHEMA_BY_CATEGORY)) {
    it(`${category}: un oggetto con ogni campo null/array vuoto è valido (dati mancanti = null, mai inventati)`, () => {
      const payload = buildAllNullPayload(schema as z.ZodObject<z.ZodRawShape>);
      expect(() => schema.parse(payload)).not.toThrow();
    });
  }

  it("un enum fuori allowlist fa fallire il parse (il modello non può inventare enum)", () => {
    const schema = EXTRACTION_SCHEMA_BY_CATEGORY.QUOTE_REQUEST;
    const payload = buildAllNullPayload(schema as z.ZodObject<z.ZodRawShape>);
    payload.transport_mode = { ...EMPTY_FIELD, value: "NOT_A_REAL_MODE" };
    expect(() => schema.parse(payload)).toThrow();
  });

  it("extractedField() ri-valida il tipo del value (confidence fuori range [0,1] fallisce)", () => {
    const stringField = extractedField(z.string());
    expect(() => stringField.parse({ ...EMPTY_FIELD, confidence: 1.5 })).toThrow();
  });
});
