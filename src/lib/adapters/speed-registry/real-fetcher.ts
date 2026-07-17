import type { SpeedRegistryFetcher } from "./types";

export const SPEED_REGISTRY_SOURCE_URL = "https://velox.mit.gov.it/dispositivi";

/** Margine ampio: ~3625 dispositivi verificati (docs/SPEC-AUTOVELOX-DRAFT.md §7bis) a un numero
 * di righe per pagina non noto a priori — capiente ma non infinito, per non restare bloccati se
 * il link "successiva" formasse accidentalmente un ciclo. */
const MAX_PAGES = 300;

function findNextPageUrl(html: string, currentUrl: string): string | null {
  const relNext = /<a[^>]+rel=["']next["'][^>]*href=["']([^"']+)["']/i.exec(html);
  const labelNext = /<a[^>]+href=["']([^"']+)["'][^>]*>\s*(?:successiv[ao]|avanti|next|»)/i.exec(html);
  const match = relNext ?? labelNext;
  if (!match) return null;
  try {
    return new URL(match[1], currentUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Implementazione reale (docs/SPEC-AUTOVELOX-DRAFT.md §7bis): nessun export CSV/JSON sul
 * portale, solo una tabella HTML paginata — un solo accesso al giorno (job SYNC_SPEED_DEVICE_REGISTRY),
 * mai più frequente, coerente con l'assenza di una cadenza di aggiornamento dichiarata dal MIT.
 * Consultazione in sola lettura, mai ridistribuzione dei dati grezzi fuori dall'app.
 *
 * NON ancora esercitata contro il portale reale in questa sessione (nessuna chiamata di rete
 * effettuata durante lo sviluppo): l'euristica di individuazione della pagina successiva è
 * generica (rel="next" o testo del link "successiva"/"avanti"/"next"/"»") e andrà validata —
 * ed eventualmente adattata — al primo utilizzo reale (`SPEED_REGISTRY_FETCHER=real`).
 */
export class RealSpeedRegistryFetcher implements SpeedRegistryFetcher {
  async fetchDevicePages(): Promise<string[]> {
    const pages: string[] = [];
    let url: string | null = SPEED_REGISTRY_SOURCE_URL;
    let pageCount = 0;

    while (url && pageCount < MAX_PAGES) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Registro MIT non raggiungibile (HTTP ${response.status}) su ${url}.`);
      }
      const html = await response.text();
      pages.push(html);
      pageCount += 1;
      url = findNextPageUrl(html, url);
    }

    return pages;
  }
}
