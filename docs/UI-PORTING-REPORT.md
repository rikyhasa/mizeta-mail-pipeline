# UI Porting Report — Fase 8 (pilota)

Aggiornato progressivamente man mano che ogni vertical slice viene portata e verificata.
Vedi `docs/UI-PORTING-PLAN.md` per la matrice completa e il riferimento riproducibile
(SHA `2247f0e3765c01e313398b860fb727161a766736`).

## Pilota — shell, sidebar, topbar, dashboard, elenco pratiche

**Stato**: implementato e verificato via HTTP (typecheck/lint/test/build puliti,
verifica funzionale su dev server). **Nessuno screenshot visivo prodotto**: l'ambiente
di esecuzione di questa sessione non dispone di un tool di cattura schermo/browser
headless con rendering visuale, solo `curl` per verifiche HTTP/HTML. Questo è un
limite noto (vedi rischio "Nessun e2e visivo" nel piano) — il confronto pixel-per-pixel
con la reference resta da fare manualmente dall'utente (`npm run dev`, aprire `/` e
`/pratiche` in un browser, confrontare con gli screenshot già presenti in
`.reference/mizeta-flow` — vedi commit `2247f0e37` "Add UI reference screenshots" —
o con `docs/design-reference/`).

### Cosa è stato verificato (via HTTP, dev server su `npm run dev`)

| Verifica | Esito |
|---|---|
| `npm run typecheck` | pulito |
| `npm run lint` | pulito |
| `npm run test` (228 test, 43 file) | tutti passano, nessuna regressione |
| `npm run build` (produzione) | completata, `/` compare come rotta dinamica |
| Login ADMIN (`admin@mizeta.local`) → `GET /` | 200, dashboard reale |
| Saluto dashboard | `"Buongiorno, Amministratore"` (nome reale dalla sessione, non "Elena") |
| Eyebrow data | `"giovedì 16 luglio"` (data reale calcolata, non "Martedì 14 luglio") |
| 7 KPI card | tutte e 7 le etichette presenti (Da gestire oggi, Scaduti, Scadenze prossimi 7 giorni, Preventivi da rispondere, Reclami urgenti, Multe urgenti, Elementi da verificare) |
| Stringhe finte reference | `"Mock connesso · ora"` e `"Elena Bianchi"`: **assenti** |
| Pill di stato provider | `"Modalità mock · sincronizzato alle 17:06"` — dato reale da `getProviderStatusSummary()`, non hardcoded |
| `GET /pratiche` (con sessione) | 200, filtri+tabella presenti, **nessuna** etichetta KPI (spostate sulla dashboard) |
| `GET /` senza sessione | 307 → `/login` (autenticazione ancora enforced sulla nuova rotta radice) |
| Voci sidebar disabilitate | "Non ancora disponibile" compare 3 volte (Posta acquisita, Report e documenti, Registro attività); nessun `href="/posta"`, `"/report"`, `"/audit"` reale nel markup |
| Form di ricerca globale | `action="/pratiche"`, `name="q"` presenti nella topbar |
| `/revisione`, `/impostazioni` (ADMIN) | 200, nessuna regressione |
| `/impostazioni` (READ_ONLY) | redirect applicato (meta-refresh verso `/pratiche`, meccanismo di `redirect()` di Next.js per questa rotta — contenuto di Impostazioni assente dalla risposta) — permessi invariati |
| Pill di stato provider per READ_ONLY | presente, stesso dato aggregato dell'ADMIN — coerente con la decisione raccolta in fase di piano |
| `/pratiche/[id]` (dettaglio, fuori scope pilota) | 200, nessuna regressione da verificare oltre lo smoke test |

### Differenze note rispetto alla reference (motivate)

- **Pannello filtri+tabella non fuso in un unico box bordato** come nella reference
  (`.panel` con divisori interni): per il pilota, `FiltersBar` e `CasesTable` restano
  due blocchi bordati separati, impilati con uno spazio. La fusione visiva completa è
  stata valutata a rischio/beneficio sfavorevole per il pilota (richiede toccare la
  struttura interna di `CasesTable`, condivisa anche con la dashboard in modalità
  `compact`) — rimandata a un'eventuale rifinitura in FASE 3, documentata qui invece di
  essere implementata in modo affrettato.
- **Colonne tabella**: la reference mostra sempre Importo/Responsabile/Ultima attività;
  il target le mantiene come colonne opzionali personalizzabili (funzionalità più
  avanzata, esplicitamente da conservare) — non uniformato alla reference.
- **Card KPI cliccabili**: la reference le rende statiche (nessun link); il target le
  mantiene cliccabili verso l'elenco filtrato (funzionalità già presente, conservata).
  Un link preesistente rotto ("Da gestire oggi" puntava a un filtro rapido `oggi`
  inesistente lato server) è stato corretto in `dueToday` come parte della riscrittura.
- **Ricerca globale**: il placeholder non promette la ricerca per "ordine" (spedizioni/
  fatture), perché `getFilteredCases` non la implementa ancora — copy volutamente più
  onesta della reference.
- **Bottone "Sincronizza posta mock"**: non portato. Nessuna azione di sincronizzazione
  generica esiste nel target (solo sync per-mailbox, ADMIN, da Impostazioni); il
  bottone della reference è comunque simulato/senza handler. Per ADMIN, l'azione
  primaria della dashboard è un link reale a Impostazioni → Connessioni email.

## FASE 3, tappa 1 — dettaglio pratica (pagina unica, niente tab)

**Stato**: implementato e verificato via HTTP. Direttiva vincolante dell'utente:
pagina a scorrimento unico con colonna laterale sticky di azioni/contesto, nessun
componente `Tabs`. I 6 tab precedenti (Panoramica, Dati estratti, Email e allegati,
Attività e note, Bozze e documenti, Registro attività) sono confluiti in 11 sezioni
impilate nella colonna principale, nell'ordine della reference dove esiste un
equivalente (vedi matrice in `docs/UI-PORTING-PLAN.md`).

### Verificato via HTTP (dev server)

| Verifica | Esito |
|---|---|
| `npm run typecheck` | pulito |
| `npm run lint` | pulito |
| `npm run test` (228 test) | tutti passano |
| `npm run build` | completata |
| `role="tablist"` nel markup | **assente** (Tabs rimosso) |
| `id` delle 9 sezioni con ancoraggio (`anomalie`, `collegamenti`, `dati-estratti`, `email`, `bozza`, `documenti`, `attivita`, `commenti`, `registro`) | tutti presenti, **esattamente in quest'ordine** nel DOM |
| Link della colonna "Azioni" (`#dati-estratti`, `#attivita`, `#commenti`, `#documenti`) | presenti, puntano alle sezioni reali |
| Colonna laterale sticky (`lg:sticky lg:top-24`) | presente |
| Box "Contesto" e disclaimer "Controllo umano" | presenti, testo coerente con CLAUDE.md (invarianti 2 e 3) |
| `InlineSelect` Stato/Responsabile ancora funzionanti (dentro "Sintesi operativa") | presenti (`id="inline-select-status"`, `id="inline-select-assignedToId"`) |
| Toggle "Segna completata"/"Riapri pratica" nella colonna Azioni | presente, coerente con lo stato della pratica testata |

### Differenze note rispetto alla reference (motivate)

- **Verifica dispositivo multa** (`FineDeviceVerification` nella reference): non
  portata. Nessun equivalente nel modello Prisma del target — gap funzionale
  documentato in `docs/UI-PORTING-PLAN.md`, non colmato con una struttura visiva
  senza dati reali dietro (principio di veridicità).
- **Colonna "Azioni"**: la reference ha bottoni che presumibilmente aprono un flusso
  (mock, non presente nel codice sorgente esaminato); il target usa ancoraggi di
  navigazione reali verso le sezioni corrispondenti, già editabili inline dove
  possibile (Stato/Responsabile in "Sintesi operativa"), quindi "Assegna
  responsabile" non ha un bottone dedicato duplicato.
- **Allegati**: uniti dentro "Cronologia email" (annidati per messaggio) invece di
  restare una card separata come nel target precedente — aumenta la fedeltà alla
  reference senza perdere la funzione di download.
- **Nessuno screenshot visivo**: stesso limite ambientale del pilota (nessun tool
  browser/screenshot disponibile in questa sessione) — confronto visivo ancora da
  fare manualmente.

## Prossimi passi

FASE 3 continua con: posta acquisita, coda di revisione, bozze e documenti (già in
parte coperti dal dettaglio pratica), report, registro attività (pagina globale),
impostazioni, login, responsive completo, rifinitura finale — vedi
`FASE-8-UI-PORTING.md`, sezione "FASE 3".
