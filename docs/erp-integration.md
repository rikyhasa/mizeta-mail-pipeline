# Integrazione gestionale — `ERPAdapter`

Riferimento: `docs/SPEC.md` §2 (decisione architetturale), §5 (modello dati), §6
(CUSTOMER_RECEIVABLE). Invariante 8 di `CLAUDE.md`: "Non modificare tabelle legacy del
gestionale non documentate. Accesso al gestionale solo tramite l'interfaccia `ERPAdapter`, in
sola lettura."

## 1. Perché non c'è un'integrazione oggi

`docs/architecture-assessment.md` (Fase 0) documenta che, alla creazione del progetto, non
esisteva alcun repository del gestionale da integrare: per la regola decisionale di SPEC.md §2
("Se non esiste alcun repository del gestionale, salta l'assessment e procedi come webapp
standalone"), il progetto è stato costruito come webapp standalone. `ERPAdapter` è comunque
stato predisposto come punto di estensione futuro, come richiesto dalla stessa sezione.

## 2. Contratto — `src/lib/adapters/erp/types.ts`

```typescript
interface ERPAdapter {
  getCustomerByVatNumber(vatNumber: string): Promise<{ id: string; name: string } | null>;
  getInvoicePaymentStatus(
    invoiceNumber: string,
  ): Promise<{ status: "OPEN" | "PAID" | "UNKNOWN"; paidAt: Date | null } | null>;
  healthCheck(): Promise<{ ok: boolean }>;
}
```

Solo tre metodi, tutti di sola lettura per firma (nessun metodo di scrittura esiste
nell'interfaccia — non è possibile aggiungerne uno senza modificare volontariamente il
contratto, il che rende la violazione dell'invariante 8 visibile in review).

## 3. Stato attuale — verificato nel codice

**Solo l'interfaccia esiste. Nessuna classe la implementa e nessun codice la chiama.** I due
riferimenti presenti nel repository sono commenti che documentano l'assenza:

- `src/lib/pipeline/persist-extraction.ts`: `sourceExcerpt: "ERPAdapter non implementato in
  questa fase."`
- `src/lib/adapters/llm/schemas/extraction-customer-receivable.ts`: stesso concetto sullo schema
  del campo "stato verificato nel gestionale".

## 4. Impatto sul flusso CUSTOMER_RECEIVABLE

SPEC.md §6 richiede, per i crediti/incassi, sia "stato dichiarato dal cliente" (estratto
dall'email — dato non affidabile per definizione) sia "stato verificato nel gestionale (via
ERPAdapter, se disponibile)". Senza un'implementazione, il campo di stato verificato resta
sempre `null`/non popolato: l'interfaccia utente e la pipeline non affermano mai che una fattura
è stata incassata sulla sola base dell'email o di un contabile allegato (invariante 4 di
`CLAUDE.md` — rispettata proprio perché il verificato-gestionale non esiste ancora, quindi non
può essere confuso con il dichiarato-dal-cliente).

## 5. Estensione futura

Per collegare un gestionale reale: implementare `ERPAdapter` come nuova classe in
`src/lib/adapters/erp/` (stesso pattern factory di `mail`/`llm` — un file `*-erp-adapter.ts` più
un `erp-adapter-factory.ts` che sceglie l'implementazione da variabile d'ambiente), chiamarla da
`persist-extraction.ts` per popolare il campo "stato verificato" di CUSTOMER_RECEIVABLE, ed
esporre lo stato di salute in Impostazioni/osservabilità come già avviene per gli adapter mail
(`src/lib/observability/metrics.ts`). Nessuna tabella legacy va letta al di fuori di questa
interfaccia, e mai in scrittura.
