import type { GeneratedDocumentFormat, GeneratedDocumentType } from "@/generated/prisma/enums";

/**
 * Extensible document-generation interface (SPEC.md §12). Type-only stub in Fase 1 —
 * HTML→PDF template rendering is built in Fase 4.
 */
export interface GeneratedDocumentService {
  generate(input: {
    caseId: string;
    type: GeneratedDocumentType;
    format: GeneratedDocumentFormat;
  }): Promise<{ storageKey: string }>;
}
