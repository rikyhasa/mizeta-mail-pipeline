/**
 * Regex ed euristiche di parsing condivise per testo italiano di email aziendali (importi,
 * date, targhe, IBAN, partita IVA, numeri fattura/ordine/verbale). Usate sia dal motore
 * euristico del MockLLMProvider sia dal motore di regole (rule "importi discordanti" ri-scansiona
 * indipendentemente corpo e allegato con le stesse funzioni).
 */

export interface TextMatch<T> {
  value: T;
  raw: string;
  index: number;
}

// Alternativa 1: numero con separatore delle migliaia esplicito ("1.200,00", "3.400,00", "40.000",
// "1 500,00" — lo spazio, incluso il non-breaking U+00A0 già incluso in \s per lo standard
// ECMAScript, è il separatore delle migliaia in formato francese, FASE 10b). Il separatore
// decimale finale resta solo punto o virgola: uno spazio prima dei decimali non è mai un formato
// reale in nessuna delle lingue coperte. Alternativa 2: cifre consecutive senza separatore delle
// migliaia, con decimali opzionali ("1200.00", "980,00", "121"). Senza questa seconda
// alternativa, un numero a 4+ cifre scritto come "1200.00" (comune negli allegati sintetici,
// formato inglese) veniva troncato a "120".
const AMOUNT_REGEX = /(?:€\s*)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)?/g;
// Il punto è aggiunto come separatore valido (formato tedesco "17.07.2026", FASE 10b) accanto
// allo slash italiano/francese: nessun rischio di confondere un importo con punto come
// separatore delle migliaia ("1.500,00", "1.500.000") con una data, per lo stesso motivo
// strutturale di DATE_ABSOLUTE_NUMERIC_REGEX in date-normalizer.ts (gruppo finale vincolato a
// esattamente 4 cifre, i primi due a 1-2 cifre) — verificato in tests/unit/text/patterns.test.ts.
const DATE_IT_REGEX = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g;
const PLATE_REGEX = /\b[A-Z]{2}\d{3}[A-Z]{2}\b/g;
const IBAN_REGEX = /\bIT\d{2}[A-Z]\d{10}[A-Z0-9]{12}\b/gi;
const VAT_NUMBER_REGEX = /\b(?:p\.?\s?iva|partita\s+iva)\D{0,10}(\d{11})\b/i;
// Richiede un trattino seguito da una cifra dopo "FAT": senza, `[A-Z0-9-]+` sotto /i
// combacerebbe anche lettere minuscole e matcherebbe per errore la parola "fattura" stessa.
const INVOICE_NUMBER_FAT_REGEX = /\bFAT-\d[\dA-Z-]*\b/i;
const INVOICE_NUMBER_LABEL_REGEX = /\b(?:fattura\s*n[°.]?\s*|numero\s+fattura\s*[:.]?\s*)([A-Z0-9\-/]+)/i;
// Stesso accorgimento del numero fattura: richiede un trattino + cifra dopo "ORD" per evitare
// che il pattern combaci per errore con la parola italiana "ordine".
const ORDER_NUMBER_ORD_REGEX = /\bORD-\d[\dA-Z-]*\b/i;
const ORDER_NUMBER_LABEL_REGEX = /\b(?:ordine\s*n[°.]?\s*|numero\s+ordine\s*[:.]?\s*)([A-Z0-9\-/]+)/i;
const FINE_NOTICE_NUMBER_REGEX = /\bverbale(?:\s+di\s+accertamento)?\s*n[°.]?\s*([A-Z0-9\-/]+)/i;
const SHIPMENT_REFERENCE_REGEX = /\b(?:spedizione|viaggio)\s*n?[°.]?\s*(SPD-[A-Z0-9\-/]+|[A-Z0-9\-/]+)/i;

/** "1.234,56" -> 1234.56, "610,00" -> 610, "2640.00" -> 2640, "40.000" -> 40000, "3000" -> 3000. */
export function parseItalianAmount(raw: string): number | null {
  const cleaned = raw.replace(/[€\s]/g, "").replace(/EUR/gi, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized: string;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else if (hasDot) {
    const lastDotIndex = cleaned.lastIndexOf(".");
    const decimalsLength = cleaned.length - lastDotIndex - 1;
    normalized = decimalsLength === 2 ? cleaned : cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function findAmounts(text: string): TextMatch<number>[] {
  const matches: TextMatch<number>[] = [];
  for (const match of text.matchAll(AMOUNT_REGEX)) {
    const raw = match[1];
    if (!raw || match.index === undefined) continue;
    // Scarta numeri troppo corti privi di separatore, spesso falsi positivi (es. anni, quantità isolate)
    const value = parseItalianAmount(raw);
    if (value === null) continue;
    matches.push({ value, raw: match[0].trim(), index: match.index });
  }
  return matches;
}

/**
 * Cerca un importo vicino a una keyword di ancoraggio, preferendo il primo match seguito da un
 * simbolo di valuta (€/EUR) entro pochi caratteri: senza questa preferenza, un numero "intruso"
 * fra l'ancora e l'importo vero (es. "importo ridotto (entro 5 giorni): 121,00 EUR" — il "5" di
 * "5 giorni") verrebbe scelto per primo ed erroneamente interpretato come l'importo.
 */
export function findAmountNearAnchor(text: string, anchors: string[], windowSize = 100): TextMatch<number> | null {
  const idx = findKeywordIndex(text, anchors);
  if (idx === -1) return null;
  const window = text.slice(idx, idx + windowSize);
  const amounts = findAmounts(window);
  if (amounts.length === 0) return null;
  // AMOUNT_REGEX consuma già un simbolo di valuta finale/iniziale dentro `raw` quando presente
  // (es. "121,00 EUR"): basta controllare `raw` stesso, non il testo oltre il match.
  const withCurrency = amounts.find((a) => /€|EUR/i.test(a.raw));
  const chosen = withCurrency ?? amounts[0];
  return { value: chosen.value, raw: chosen.raw, index: idx + chosen.index };
}

/** Interpretata come mezzanotte Europe/Rome del giorno indicato. */
export function parseItalianDate(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  if (date.getUTCMonth() !== m - 1) return null;
  return date;
}

export function findDatesIt(text: string): TextMatch<Date>[] {
  const matches: TextMatch<Date>[] = [];
  for (const match of text.matchAll(DATE_IT_REGEX)) {
    if (match.index === undefined) continue;
    const date = parseItalianDate(match[1], match[2], match[3]);
    if (!date) continue;
    matches.push({ value: date, raw: match[0], index: match.index });
  }
  return matches;
}

export function findPlate(text: string): string | null {
  const match = PLATE_REGEX.exec(text);
  PLATE_REGEX.lastIndex = 0;
  return match ? match[0] : null;
}

export function findIban(text: string): string | null {
  const match = IBAN_REGEX.exec(text);
  IBAN_REGEX.lastIndex = 0;
  return match ? match[0].toUpperCase() : null;
}

export function findVatNumber(text: string): string | null {
  const match = VAT_NUMBER_REGEX.exec(text);
  return match ? match[1] : null;
}

export function findInvoiceNumber(text: string): string | null {
  const labelMatch = INVOICE_NUMBER_LABEL_REGEX.exec(text);
  if (labelMatch) return labelMatch[1];
  const fatMatch = INVOICE_NUMBER_FAT_REGEX.exec(text);
  return fatMatch ? fatMatch[0] : null;
}

export function findOrderNumber(text: string): string | null {
  const ordMatch = ORDER_NUMBER_ORD_REGEX.exec(text);
  if (ordMatch) return ordMatch[0];
  const labelMatch = ORDER_NUMBER_LABEL_REGEX.exec(text);
  return labelMatch ? labelMatch[1] : null;
}

export function findFineNoticeNumber(text: string): string | null {
  const match = FINE_NOTICE_NUMBER_REGEX.exec(text);
  return match ? match[1] : null;
}

export function findShipmentReference(text: string): string | null {
  const match = SHIPMENT_REFERENCE_REGEX.exec(text);
  return match ? match[1] : null;
}

/** Cerca la prima occorrenza di una qualunque keyword (case-insensitive) e ritorna il suo indice, o -1. */
export function findKeywordIndex(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let best = -1;
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}
