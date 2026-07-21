import { parseItalianDate } from "@/lib/text/patterns";

/**
 * Normalizzazione deterministica delle date estratte dal modello (SPEC.md §6, Fase 5): il
 * modello restituisce l'espressione testuale grezza così com'è nel documento (`value`,
 * mai auto-normalizzata — vedi `buildExtractionSystemPrompt` in
 * `src/lib/adapters/llm/anthropic/prompts.ts`), il codice la converte in una data assoluta.
 * Le regole deterministiche sono più affidabili del modello per questo compito (CLAUDE.md).
 */

export interface DateNormalizerContext {
  /** ISO datetime del messaggio sorgente del campo (per risolvere espressioni relative come
   * "entro 5 giorni"), o il momento di elaborazione della pipeline come fallback. */
  referenceIso: string;
}

// Include le forme tedesche e francesi oltre a quelle italiane: nomi lessicalmente distinti fra
// le tre lingue, un'unica mappa basta e non richiede sapere la lingua dell'email in anticipo
// (FASE 10b, docs/FASE-10-LETTURA-ALLEGATI.md — Mizeta riceve occasionalmente fatture/comunicazioni
// da fornitori tedeschi e francesi; niente formato USA, mai richiesto da questo bacino di posta).
const MONTH_NAMES: Record<string, number> = {
  gennaio: 1,
  gen: 1,
  febbraio: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  aprile: 4,
  apr: 4,
  maggio: 5,
  mag: 5,
  giugno: 6,
  giu: 6,
  luglio: 7,
  lug: 7,
  agosto: 8,
  ago: 8,
  settembre: 9, // condiviso con il francese "settembre" (stessa grafia)
  set: 9,
  ottobre: 10,
  ott: 10,
  novembre: 11, // condiviso con il francese "novembre" (stessa grafia)
  nov: 11,
  dicembre: 12,
  dic: 12,
  // Tedesco
  januar: 1,
  jan: 1,
  februar: 2,
  märz: 3,
  april: 4,
  mai: 5, // condiviso con il francese "mai" (stesso mese, stessa grafia)
  juni: 6,
  juli: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  dezember: 12,
  dez: 12,
  // Francese
  janvier: 1,
  janv: 1,
  février: 2,
  févr: 2,
  mars: 3,
  avril: 4,
  avr: 4,
  juin: 6,
  juillet: 7,
  juil: 7,
  août: 8,
  octobre: 10,
  oct: 10,
  décembre: 12,
  déc: 12,
};

// Il punto è un separatore di data valido in tedesco ("17.07.2026"): nessuna sovrapposizione
// reale con DATE_ISO_REGEX (che richiede l'ordine aaaa-mm-gg con '-') né con un importo, perché
// il gruppo finale è vincolato a esattamente 4 cifre e i primi due a 1-2 cifre — un importo con
// punto come separatore delle migliaia (es. "1.500,00", "1.500.000") non rispetta questa forma
// (verificato in tests/unit/text/date-normalizer.test.ts).
const DATE_ABSOLUTE_NUMERIC_REGEX = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/;
// Nessun \b finale: un datetime ISO completo ("2026-07-28T00:00:00.000Z") ha "T" subito dopo
// il giorno, e "T" è un carattere di parola come le cifre — non c'è transizione di \b fra loro,
// quindi \b\d{4}-\d{2}-\d{2}\b non troverebbe mai una data dentro un datetime completo.
const DATE_ISO_REGEX = /\b(\d{4})-(\d{2})-(\d{2})/;
// Separatore giorno/mese esteso a '.' per il formato tedesco ("17. Juli 2026"). Classe di
// lettere estesa con gli accenti tedeschi/francesi usati in MONTH_NAMES (ä di "März", û di
// "août") oltre a quelli italiani già presenti.
const DATE_NAMED_MONTH_REGEX = /\b(\d{1,2})[\s/.-]+([A-Za-zàèéìòùäöüûÄÖÜÛ]{3,9})[\s/.-]+(\d{4})\b/i;
// "entro"/"tra" opzionali: il modello a volte scrive l'excerpt del campo data già ritagliato
// dal resto della frase (es. "5 giorni lavorativi dalla notifica" invece di "pagabile entro 5
// giorni lavorativi dalla notifica"), pur seguendo l'istruzione di non calcolare la data lui
// stesso — verificato con chiamate reali (EML-030).
const RELATIVE_DAYS_REGEX = /\b(?:(?:entro|tra)\s+)?(\d{1,3})\s+giorni(\s+lavorativi)?\b/i;

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateToIso(date: Date): string {
  return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Data civile Europe/Rome (aaaa-mm-gg) corrispondente a un istante ISO, senza dipendenze esterne. */
function toRomeIsoDate(referenceIso: string): string {
  const instant = new Date(referenceIso);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(instant);
}

/**
 * Istante UTC corrispondente alla mezzanotte Europe/Rome di una data civile "aaaa-mm-gg".
 * L'offset Europe/Rome varia nell'anno (CET +1 / CEST +2 per l'ora legale): non va mai
 * assunto fisso. Calcolato senza dipendenze esterne, partendo da una stima a mezzanotte UTC
 * e correggendo dell'offset osservato per quella stessa data.
 */
export function romeMidnightToUtcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guessUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const romeHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(guessUtc),
  );
  return new Date(guessUtc.getTime() - romeHour * 60 * 60 * 1000);
}

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return dateToIso(date);
}

/** Salta solo sabato/domenica: nessun calendario festività italiane (limite noto, docs/evaluation.md §4). */
function addBusinessDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) remaining -= 1;
  }
  return dateToIso(date);
}

function matchAbsoluteNumeric(text: string): string | null {
  const match = DATE_ABSOLUTE_NUMERIC_REGEX.exec(text);
  if (!match) return null;
  const date = parseItalianDate(match[1], match[2], match[3]);
  return date ? dateToIso(date) : null;
}

function matchIso(text: string): string | null {
  const match = DATE_ISO_REGEX.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function matchNamedMonth(text: string): string | null {
  const match = DATE_NAMED_MONTH_REGEX.exec(text);
  if (!match) return null;
  const month = MONTH_NAMES[match[2].toLowerCase()];
  if (!month) return null;
  const date = parseItalianDate(match[1], String(month), match[3]);
  return date ? dateToIso(date) : null;
}

function matchRelativeDays(text: string, referenceIsoDate: string): string | null {
  const match = RELATIVE_DAYS_REGEX.exec(text);
  if (!match) return null;
  const days = Number(match[1]);
  if (!Number.isFinite(days) || days <= 0) return null;
  const isBusinessDays = Boolean(match[2]);
  return isBusinessDays ? addBusinessDays(referenceIsoDate, days) : addCalendarDays(referenceIsoDate, days);
}

/**
 * Converte un'espressione di data grezza (così come emessa dal modello in `value`) in una
 * data civile ISO "aaaa-mm-gg", o `null` se non riconosciuta — mai una data inventata
 * (CLAUDE.md invariante 6). Non lancia mai eccezioni.
 */
export function normalizeDateExpression(raw: string, context: DateNormalizerContext): string | null {
  const text = raw.trim();
  if (!text) return null;

  const absolute = matchAbsoluteNumeric(text);
  if (absolute) return absolute;

  const iso = matchIso(text);
  if (iso) return iso;

  const namedMonth = matchNamedMonth(text);
  if (namedMonth) return namedMonth;

  const referenceIsoDate = toRomeIsoDate(context.referenceIso);

  const relative = matchRelativeDays(text, referenceIsoDate);
  if (relative) return relative;

  if (/\boggi\b/i.test(text)) return referenceIsoDate;
  if (/\bdomani\b/i.test(text)) return addCalendarDays(referenceIsoDate, 1);

  return null;
}
