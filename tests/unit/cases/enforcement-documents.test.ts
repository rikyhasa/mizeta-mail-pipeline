import { describe, expect, it } from "vitest";
import {
  ALL_ENFORCEMENT_DOCUMENT_TYPES,
  REQUIRED_ENFORCEMENT_DOCUMENT_TYPES,
  countMissingRequiredDocuments,
} from "@/lib/cases/enforcement-documents";

describe("REQUIRED_ENFORCEMENT_DOCUMENT_TYPES", () => {
  it("esclude OTHER, mai obbligatorio (FASE 12, Bug 3)", () => {
    expect(REQUIRED_ENFORCEMENT_DOCUMENT_TYPES).not.toContain("OTHER");
    expect(ALL_ENFORCEMENT_DOCUMENT_TYPES).toContain("OTHER");
    expect(REQUIRED_ENFORCEMENT_DOCUMENT_TYPES.length).toBe(ALL_ENFORCEMENT_DOCUMENT_TYPES.length - 1);
  });
});

describe("countMissingRequiredDocuments", () => {
  it("conta 4 mancanti quando nessun documento è presente", () => {
    expect(countMissingRequiredDocuments([])).toBe(REQUIRED_ENFORCEMENT_DOCUMENT_TYPES.length);
  });

  it("un OTHER presente non maschera i tipi tecnici mancanti (prima del fix: contava come uno dei presenti)", () => {
    const documentChecks = [{ documentType: "OTHER" as const, status: "PRESENT" }];
    expect(countMissingRequiredDocuments(documentChecks)).toBe(REQUIRED_ENFORCEMENT_DOCUMENT_TYPES.length);
  });

  it("zero mancanti quando tutti i tipi tecnici richiesti sono presenti, anche se OTHER resta mancante", () => {
    const documentChecks = REQUIRED_ENFORCEMENT_DOCUMENT_TYPES.map((documentType) => ({ documentType, status: "PRESENT" as const }));
    expect(countMissingRequiredDocuments(documentChecks)).toBe(0);
  });

  it("conta correttamente un mix di presenti/mancanti tra i soli tipi richiesti", () => {
    const [first, ...rest] = REQUIRED_ENFORCEMENT_DOCUMENT_TYPES;
    const documentChecks = [{ documentType: first, status: "PRESENT" as const }];
    expect(countMissingRequiredDocuments(documentChecks)).toBe(rest.length);
  });
});
