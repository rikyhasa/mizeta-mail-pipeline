import { describe, expect, it } from "vitest";
import { parseItalianAmount, findAmounts, findAmountNearAnchor, findDatesIt } from "@/lib/text/patterns";

describe("parseItalianAmount", () => {
  it("riconosce il formato italiano/tedesco (punto migliaia, virgola decimale)", () => {
    expect(parseItalianAmount("1.500,00")).toBe(1500);
    expect(parseItalianAmount("40.000")).toBe(40000);
    expect(parseItalianAmount("610,00")).toBe(610);
  });

  it("riconosce il formato senza separatore delle migliaia", () => {
    expect(parseItalianAmount("2640.00")).toBe(2640);
    expect(parseItalianAmount("3000")).toBe(3000);
  });

  it("riconosce il formato francese con spazio come separatore delle migliaia", () => {
    expect(parseItalianAmount("1 500,00")).toBe(1500);
    expect(parseItalianAmount("12 340,50")).toBe(12340.5);
  });

  it("riconosce il formato francese con spazio non-breaking (U+00A0) come separatore delle migliaia", () => {
    expect(parseItalianAmount("1 500,00")).toBe(1500);
  });

  it("ritorna null per una stringa vuota o non numerica, senza lanciare eccezioni", () => {
    expect(parseItalianAmount("")).toBeNull();
    expect(parseItalianAmount("EUR")).toBeNull();
  });
});

describe("findAmounts", () => {
  it("trova un importo con separatore delle migliaia a spazio nel testo (formato francese)", () => {
    const matches = findAmounts("Montant total: 1 500,00 EUR");
    expect(matches.some((m) => m.value === 1500)).toBe(true);
  });

  it("trova un importo con punto migliaia e virgola decimale nel testo (formato italiano/tedesco)", () => {
    const matches = findAmounts("Gesamtbetrag 2.450,00 EUR");
    expect(matches.some((m) => m.value === 2450)).toBe(true);
  });
});

describe("findAmountNearAnchor", () => {
  it("trova un importo francese con spazio come separatore delle migliaia vicino a un'ancora", () => {
    const found = findAmountNearAnchor("Montant total: 1 500,00 EUR", ["montant total"]);
    expect(found?.value).toBe(1500);
  });
});

describe("findDatesIt", () => {
  it("riconosce gg.mm.aaaa (formato tedesco) oltre a gg/mm/aaaa", () => {
    const matches = findDatesIt("Fällig am 26.07.2026");
    expect(matches).toHaveLength(1);
    expect(matches[0].value.toISOString().startsWith("2026-07-26")).toBe(true);
  });

  it("NON interpreta un importo con punto come separatore delle migliaia come una data (guardia contro l'ampliamento del separatore '.')", () => {
    expect(findDatesIt("Totale: 1.500,00 EUR")).toHaveLength(0);
    expect(findDatesIt("Gesamtbetrag 1.500.000 EUR")).toHaveLength(0);
  });
});
