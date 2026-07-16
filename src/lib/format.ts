const TIME_ZONE = "Europe/Rome";
const LOCALE = "it-IT";

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(typeof value === "string" ? Number(value) : value);
}

export function formatTime(value: Date | string): string {
  return timeFormatter.format(new Date(value));
}

/** Es. "martedì 14 luglio" — usata dall'eyebrow della dashboard, sempre calcolata sulla data reale. */
export function formatWeekdayDate(value: Date): string {
  return weekdayDateFormatter.format(value);
}
