import { z } from "zod";

/**
 * Structured Output del passaggio di generazione bozza (SPEC.md §11): SOLO testo di una bozza
 * di risposta, mai un invio. `placeholders` elenca le etichette dei dati mancanti che il
 * modello non ha potuto compilare — devono comparire evidenziati nel testo (es. `[[DA
 * COMPLETARE: ...]]`), mai inventati (CLAUDE.md invariante 6).
 */
export const draftGenerationResultSchema = z.object({
  subject: z.string().min(1),
  body_text: z.string().min(1),
  placeholders: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
});

export type DraftGenerationResult = z.infer<typeof draftGenerationResultSchema>;
