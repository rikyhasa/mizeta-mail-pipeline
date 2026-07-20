import { z } from "zod";

/**
 * Output del livello 3 di estrazione allegati (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md):
 * trascrizione testuale per pagina di uno scan/foto/PDF senza livello testo. Passaggio
 * separato dalla classificazione/estrazione (SPEC.md §6: mai un unico prompt) — il testo
 * prodotto qui rientra poi nella pipeline esattamente come il testo estratto localmente
 * (stessi delimitatori ATTACHMENT_CONTENT). `security_flags` è testo libero, stesso
 * contratto di `classificationResultSchema.security_flags`: un'immagine può contenere un
 * tentativo di prompt injection tanto quanto un corpo email (CLAUDE.md invariante 1).
 */
export const attachmentVisionExtractionSchema = z.object({
  pages: z.array(
    z.object({
      page_number: z.number().int().positive(),
      text: z.string(),
    }),
  ),
  security_flags: z.array(z.string()),
});

export type AttachmentVisionExtractionResult = z.infer<typeof attachmentVisionExtractionSchema>;
