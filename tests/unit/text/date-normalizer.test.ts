import { describe, expect, it } from "vitest";
import { normalizeDateExpression } from "@/lib/text/date-normalizer";

// 2026-07-09 è un giovedì; usato come riferimento per verificare che le espressioni relative
// e "giorni lavorativi" saltino correttamente il weekend che cade nel mezzo della finestra.
const REFERENCE = { referenceIso: "2026-07-09T09:00:00+02:00" };

describe("normalizeDateExpression", () => {
  it("riconosce gg/mm/aaaa", () => {
    expect(normalizeDateExpression("17/07/2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce gg-mm-aaaa", () => {
    expect(normalizeDateExpression("17-07-2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce una data assoluta immersa in altro testo", () => {
    expect(normalizeDateExpression("Termine per il pagamento in misura ridotta: 17/07/2026", REFERENCE)).toBe("2026-07-17");
  });

  it("lascia passare invariata una data già ISO", () => {
    expect(normalizeDateExpression("2026-07-17", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce un datetime ISO completo (formato prodotto dall'euristica mock)", () => {
    expect(normalizeDateExpression("2026-07-17T00:00:00.000Z", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce il nome del mese in italiano", () => {
    expect(normalizeDateExpression("17 luglio 2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce il mese abbreviato con separatore", () => {
    expect(normalizeDateExpression("17/lug/2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce gg.mm.aaaa (formato tedesco)", () => {
    expect(normalizeDateExpression("17.07.2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce il nome del mese in tedesco", () => {
    expect(normalizeDateExpression("17. Juli 2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce il nome del mese in tedesco con umlaut (März)", () => {
    expect(normalizeDateExpression("17. März 2026", { referenceIso: "2026-03-01T09:00:00+01:00" })).toBe("2026-03-17");
  });

  it("riconosce il nome del mese in francese", () => {
    expect(normalizeDateExpression("17 juillet 2026", REFERENCE)).toBe("2026-07-17");
  });

  it("riconosce il nome del mese in francese con accento (août)", () => {
    expect(normalizeDateExpression("17 août 2026", { referenceIso: "2026-08-01T09:00:00+02:00" })).toBe("2026-08-17");
  });

  it("NON interpreta un importo con punto come separatore delle migliaia come una data (guardia contro l'ampliamento del separatore '.')", () => {
    expect(normalizeDateExpression("1.500,00", REFERENCE)).toBeNull();
    expect(normalizeDateExpression("1.500.000", REFERENCE)).toBeNull();
    expect(normalizeDateExpression("Totale: 1.500,00 EUR", REFERENCE)).toBeNull();
  });

  it("risolve 'entro N giorni' come giorni di calendario rispetto al riferimento", () => {
    expect(normalizeDateExpression("entro 5 giorni", REFERENCE)).toBe("2026-07-14");
  });

  it("risolve 'entro N giorni lavorativi' saltando sabato e domenica", () => {
    // Giovedì 09/07 + 5 giorni lavorativi: ven 10, (sab 11, dom 12 saltati), lun 13, mar 14, mer 15 -> gio 16.
    expect(normalizeDateExpression("entro 5 giorni lavorativi dalla notifica", REFERENCE)).toBe("2026-07-16");
  });

  it("risolve 'tra N giorni' come sinonimo di 'entro N giorni'", () => {
    expect(normalizeDateExpression("tra 10 giorni", REFERENCE)).toBe("2026-07-19");
  });

  it("risolve 'N giorni [lavorativi]' anche senza il prefisso 'entro'/'tra' (excerpt del modello già ritagliato)", () => {
    expect(normalizeDateExpression("5 giorni lavorativi dalla notifica", REFERENCE)).toBe("2026-07-16");
    expect(normalizeDateExpression("60 giorni", REFERENCE)).toBe("2026-09-07");
  });

  it("risolve 'oggi' rispetto al riferimento", () => {
    expect(normalizeDateExpression("oggi", REFERENCE)).toBe("2026-07-09");
  });

  it("risolve 'domani' rispetto al riferimento", () => {
    expect(normalizeDateExpression("domani", REFERENCE)).toBe("2026-07-10");
  });

  it("ritorna null per una data assoluta non valida (mese 13)", () => {
    expect(normalizeDateExpression("32/13/2026", REFERENCE)).toBeNull();
  });

  it("ritorna null per un'espressione non riconosciuta", () => {
    expect(normalizeDateExpression("quanto prima", REFERENCE)).toBeNull();
  });

  it("ritorna null per una stringa vuota, senza lanciare eccezioni", () => {
    expect(normalizeDateExpression("", REFERENCE)).toBeNull();
    expect(normalizeDateExpression("   ", REFERENCE)).toBeNull();
  });

  it("ritorna null per testo arbitrario senza alcun riferimento temporale", () => {
    expect(normalizeDateExpression("nessuna data qui", REFERENCE)).toBeNull();
  });
});
