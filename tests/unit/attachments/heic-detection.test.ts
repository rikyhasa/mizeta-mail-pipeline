import { describe, expect, it } from "vitest";
import { isHeicOrHeifAttachment } from "@/lib/attachments/extract-message-attachments";

/**
 * Rilevamento HEIC/HEIF (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md): nessun decoder aggiunto,
 * solo pattern matching su MIME type e, in fallback, estensione del nome file.
 */
describe("isHeicOrHeifAttachment", () => {
  it("riconosce i MIME type HEIC/HEIF standard", () => {
    expect(isHeicOrHeifAttachment({ fileName: "foto.heic", mimeType: "image/heic" })).toBe(true);
    expect(isHeicOrHeifAttachment({ fileName: "foto.heif", mimeType: "image/heif" })).toBe(true);
    expect(isHeicOrHeifAttachment({ fileName: "burst.heic", mimeType: "image/heic-sequence" })).toBe(true);
    expect(isHeicOrHeifAttachment({ fileName: "burst.heif", mimeType: "image/heif-sequence" })).toBe(true);
  });

  it("è case-insensitive sul MIME type", () => {
    expect(isHeicOrHeifAttachment({ fileName: "foto.HEIC", mimeType: "IMAGE/HEIC" })).toBe(true);
  });

  it("riconosce l'estensione del file come fallback quando il MIME type è generico", () => {
    expect(isHeicOrHeifAttachment({ fileName: "IMG_1234.heic", mimeType: "application/octet-stream" })).toBe(true);
    expect(isHeicOrHeifAttachment({ fileName: "IMG_1234.HEIF", mimeType: "application/octet-stream" })).toBe(true);
  });

  it("NON segnala i formati immagine già supportati", () => {
    expect(isHeicOrHeifAttachment({ fileName: "foto.jpg", mimeType: "image/jpeg" })).toBe(false);
    expect(isHeicOrHeifAttachment({ fileName: "foto.png", mimeType: "image/png" })).toBe(false);
    expect(isHeicOrHeifAttachment({ fileName: "documento.pdf", mimeType: "application/pdf" })).toBe(false);
  });
});
