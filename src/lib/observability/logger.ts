import { env } from "@/lib/config/env";

export type LogMeta = Record<string, string | number | boolean | null | undefined>;

/**
 * Chiavi che non devono MAI comparire in un log (CLAUDE.md invariante 7 / SPEC.md §17: mai
 * segreti o corpo email nei log). Guard-rail economico, non un motore di redazione completo:
 * lancia in ambienti non di produzione così un errore di questo tipo viene scoperto durante lo
 * sviluppo/test, non silenziosamente in produzione (dove si preferisce non far esplodere
 * l'applicazione per un log mancato — si omette solo la chiave incriminata).
 */
const DENYLISTED_META_KEYS = new Set([
  "bodyText",
  "bodyHtml",
  "content",
  "password",
  "passwordHash",
  "secret",
  "token",
  "clientState",
  "accessToken",
  "clientSecret",
]);

function sanitizeMeta(meta: LogMeta | undefined): LogMeta | undefined {
  if (!meta) return meta;
  for (const key of Object.keys(meta)) {
    if (DENYLISTED_META_KEYS.has(key)) {
      if (env.NODE_ENV !== "production") {
        throw new Error(`logger: tentativo di loggare una chiave vietata "${key}" (possibile segreto o corpo email).`);
      }
      delete meta[key];
    }
  }
  return meta;
}

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, meta?: LogMeta): void {
  const safeMeta = sanitizeMeta(meta ? { ...meta } : undefined);
  const line = JSON.stringify({ level, message, ...safeMeta, timestamp: new Date().toISOString() });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/** Logger strutturato minimale (SPEC.md §17), senza dipendenze esterne: righe JSON su
 * stdout/stderr. Deliberatamente non una libreria (pino/winston) — a questo volume di log per
 * un MVP, la struttura/livello si ottengono con poche righe, senza aggiungere una dipendenza. */
export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta),
};
