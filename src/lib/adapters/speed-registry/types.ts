/**
 * Astrazione per la sorgente del registro MIT dispositivi (docs/SPEC-AUTOVELOX-DRAFT.md §7bis),
 * stesso principio di `MailProviderAdapter`/`LLMProvider`: un'unica interfaccia, implementazione
 * reale + mock, per essere dimostrabile senza rete (CLAUDE.md, `SPEED_REGISTRY_FETCHER=mock`).
 */
export interface SpeedRegistryFetcher {
  /** Scarica tutte le pagine della tabella dispositivi, nell'ordine (nessun export CSV/JSON sul
   * portale reale: solo una tabella HTML paginata, ~3625 righe al momento della verifica). */
  fetchDevicePages(): Promise<string[]>;
}
