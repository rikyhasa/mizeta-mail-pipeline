# UI Porting Plan — Mizeta Flow → Mizeta Mail Pipeline (Fase 8)

Vedi `FASE-8-UI-PORTING.md` (root del repo) per il prompt completo che ha originato
questo lavoro. Questo documento è la mappa vivente mock→reale richiesta dal metodo di
lavoro della Fase 8: viene aggiornata riga per riga man mano che ogni schermata viene
portata (FASE 2 = pilota, FASE 3 = schermate complete). Non tutte le righe sono
compilate fin da subito: solo quelle nello scope della tappa in corso.

## Riferimento riproducibile

- Repository reference: `https://github.com/rikyhasa/mizeta-flow`
- PR: #1 "MVP iniziale Mizeta Flow" (draft), branch `agent/initial-mvp`
- Commit di riferimento: `2247f0e3765c01e313398b860fb727161a766736`
- Clone locale, sola lettura, mai committato: `.reference/mizeta-flow` (in `.gitignore`)
- Snapshot statico vendorizzato in Fase 7B (verificato identico al commit sopra per
  colori/classi/logica): `docs/design-reference-codex.css`,
  `docs/design-reference/{app-shell,cases-table,case-detail}.tsx`

## Palette — deviazione vincolante documentata

La reference usa navy `#10253f`/`#173654` e arancione `#e56b2f`. Si riproduce il navy
così com'è; l'arancione viene sostituito con l'arancione brand Zeta Transport
`#f28a1d` (hover `#c8680d`) e le tinte derivate vengono adattate di conseguenza. Font:
Inter (non Arial). Questa decisione sostituisce, solo per questa fase, il vincolo
"solo antracite" delle Fasi 7/7B/7C.

## Struttura della matrice

Colonne: **Schermata/componente Mizeta Flow · File di origine · Schermata/componente
target · Dato mock nella reference · Fonte reale nel target · API/azione reale ·
Permessi richiesti · Audit richiesto · Differenze funzionali · Decisione · Rischi ·
Stato porting**.

## Matrice — FASE 2 (pilota: shell, sidebar, topbar, dashboard, elenco pratiche)

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Nome utente + ruolo nel footer sidebar | `src/components/app-shell.tsx` | `src/components/app-shell/Sidebar.tsx` | "Elena Bianchi" / "Amministratore" hardcoded | `getCurrentUser()` (`src/lib/auth/session.ts`) | — | autenticato | no | — | sessione reale, nessuna eccezione | basso | fatto |
| Nav sidebar 6 voci (Dashboard/Pratiche/Posta/Report/Audit/Impostazioni) | `app-shell.tsx` | `Sidebar.tsx` + `nav-items.ts` | array statico, nessun controllo permessi | config statica + `user.role` | — | Impostazioni solo ADMIN (omessa per gli altri, non disabilitata: è un gate di permesso, non "non ancora costruita") | no | reference non ha "Coda di revisione"; target non ha ancora `/posta` `/report` `/audit` come pagine | 7 voci: le 6 della reference + Coda di revisione (target-only, mantenuta perché più avanzata); le 3 non ancora costruite sono visibili ma disabilitate, `aria-disabled`, etichetta "Non ancora disponibile", niente `<Link>` | medio: nav più affollata, verificare leggibilità mobile | fatto |
| Pill "Mock connesso · ora" in topbar | `app-shell.tsx` | `Topbar.tsx` | stringa fissa, pallino verde sempre acceso | `getProviderStatusSummary()` (nuovo, `src/lib/observability/provider-status.ts`) — legge `MailboxConnection.status/lastSyncAt/lastHealthStatus` + `env.EMAIL_PROVIDER`/`env.LLM_PROVIDER` | nessuna scrittura, sola lettura | tutti i ruoli autenticati, ma **solo dato aggregato** (mock/connesso/attenzione/non disponibile) — nessun dettaglio per-mailbox, nessun costo/job | no | oggi lo stato mailbox dettagliato è visibile solo ad ADMIN via `/api/observability` (`settings:manage`) | decisione utente raccolta in fase di piano: pill coarse visibile a tutti i ruoli, tramite funzione nuova e separata da `getObservabilitySnapshot()` (che resta ADMIN-only) | medio — piccola esposizione informativa nuova verso ruoli non-admin, mitigata dal livello di dettaglio ridotto | fatto |
| Campo di ricerca globale in topbar | `app-shell.tsx` | `Topbar.tsx` (form GET) | input decorativo, nessuna logica reale nel markup fornito | campo `q` già esistente in `getFilteredCases()` (`src/lib/dashboard/queries.ts`) | submit GET verso `/pratiche?q=...` | autenticato | no | reference promette anche ricerca per "ordine"; `q` oggi copre solo titolo/riferimento/cliente/fornitore, non spedizioni/fatture | copy onesta sullo scope reale, niente promesse su ricerca non implementata | basso | fatto |
| Saluto "Buongiorno, Elena" + eyebrow "Martedì 14 luglio" | `src/app/(app)/page.tsx` (reference) | `src/app/(app)/page.tsx` (nuovo, target) | nome fisso "Elena", data congelata 14/07/2026 09:30 CET | `getCurrentUser().name` (primo nome), data reale `Europe/Rome` via `Intl.DateTimeFormat` | — | autenticato | no | — | saluto e data sempre calcolati, mai valori fissi | basso | fatto |
| Bottone "Sincronizza posta mock" | `app/(app)/page.tsx` (reference) | `DashboardHeader.tsx` | nessun handler, puramente cosmetico | `POST /api/settings/mailboxes/[id]/sync` esiste ma è per-mailbox e gated `settings:manage` | — | ADMIN | sì (route esistente) | reference non specifica quale mailbox sincronizzare, il target non ha un'azione "sincronizza tutto" | nessun bottone di sync generico e finto: per ADMIN un link reale a Impostazioni → Connessioni email (dove il sync per-mailbox esiste davvero); per gli altri ruoli nessun bottone | basso | fatto |
| 7 KPI "cards-seven" | `mock-data.ts` (array `seeds`, 26 elementi fissi) | `DashboardKpiCards.tsx` | somme calcolate su un array statico | `getAlerts()` (`src/lib/dashboard/queries.ts`) — mapping 1:1 già esistente sulle 7 etichette | filtro dashboard, click → `/pratiche?quick=...` | autenticato | no | — | riuso diretto della query esistente, nessuna nuova aggregazione Prisma | basso | fatto |
| Stats-strip secondaria "Quadro operativo" (7 celle) | `mock-data.ts` | `DashboardSecondaryStats.tsx` | somme su array statico | `getKpis()` (mapping quasi 1:1: `quotes` si divide in 2 celle count/totale) | filtro dashboard | autenticato | no | composizione diversa dalla fascia unica "fusa" della Fase 7C (che univa alert+kpi) | ricomposizione pura dei dati già restituiti da `getKpis()`, nessuna nuova query | basso | fatto |
| Elenco pratiche compatto (dashboard, 12 righe) | `cases-table.tsx` (prop `compact`) | `CasesTable` (nuovo prop `compact`, spostato in `src/components/cases/`) | 12 righe filtrate client-side da un array mock | `getDashboardWorkItems(12)` (nuovo in `src/lib/dashboard/queries.ts`, riusa la stessa proiezione di `getFilteredCases`) | apertura pratica | autenticato | no | — | nuova funzione di query, nessuna duplicazione della logica di mapping esistente | basso | fatto |
| Elenco pratiche completo | `cases-table.tsx`, `app/(app)/pratiche/page.tsx` | `src/app/(app)/pratiche/page.tsx` (slim) | filtro client-side su array mock (categoria/priorità/stato/testo) | `getFilteredCases()` (server-side, già più ricco) | filtri reali, paginazione reale | autenticato | no | il target ha filtri molto più ricchi (responsabile/cliente/fornitore/intervallo date/importi/allegati/scaduto/filtri rapidi) e colonne personalizzabili con `localStorage`, assenti nella reference | **tutte le funzionalità del target vengono conservate**: solo restyling visivo (pannello unico filtri+tabella, densità, badge) | basso | fatto |
| Badge priorità/stato | classi CSS `.priority-*`/`.status-*` | `src/components/ui/Badge.tsx` | classi CSS statiche con coppie di colori fisse | stesso componente (`Badge`/`PriorityBadge`/`StatusBadge`), tinte lette dai token `--color-critical`/`--color-warning` già presenti in `globals.css` | — | — | no | il target oggi usa classi Tailwind sciolte (`red-50/red-700`, `amber-50/amber-800`) invece dei token centralizzati già definiti | allineamento ai token esistenti, nessun nuovo componente parallelo | basso | fatto |

## Righe non ancora compilate (fuori scope pilota, verranno aggiunte in FASE 3)

Dettaglio pratica (incl. verifica multe/`FineDeviceVerification`, senza equivalente nel
modello Prisma del target — gap funzionale da documentare quando affrontato) · Posta
acquisita · Coda di revisione (restyling, funzionalità già più avanzata da conservare)
· Bozze e documenti · Report e documenti · Registro attività (pagina globale, oggi
esiste solo come tab per-pratica) · Impostazioni · Login · Responsive completo ·
Rifinitura finale.

## Differenze strutturali tra i modelli dati (riepilogo)

- **Persistenza**: il target ha un modello Prisma/PostgreSQL completo (`Case`,
  `CaseField`, `CaseDeadline`, `EmailMessage`, `Attachment`, `EmailDraft`, `AuditLog`,
  `CaseRelation`, ecc.); la reference tiene tutto in un array `seeds` di 26 pratiche
  fisse in `src/lib/mock-data.ts`, con "ora" congelata al 14/07/2026 09:30 CET.
- **Coda di revisione**: assente come pagina nella reference (solo un filtro "Da
  verificare" client-side); il target ha un modello funzionale più ricco
  (`CaseRelation` con `DUPLICATE_CANDIDATE`/`RELATED`, motivazioni multiple) — va
  preservato integralmente in FASE 3.
- **Multe/verifica dispositivo**: la reference ha un intero sotto-dominio
  (`src/lib/fines/*`, `FineDeviceVerification`, tipo `FineTechnicalAnalysis`) senza
  equivalente nel modello Prisma del target — gap funzionale, non nello scope del
  pilota.
- **Bozze**: la reference simula generazione/approvazione con `useState` locale e
  notice esplicite ("modalità simulata"); il target ha `EmailDraft` reale con stati
  tipizzati, generazione via `LLMProvider` e approvazione umana obbligatoria con audit.
- **Audit log**: la reference mostra un array statico con attore sempre `"Sistema
  mock"`; il target ha `AuditLog` immutabile, collegato a utenti reali, ~22 azioni
  tipizzate, scritto in transazione con la mutazione che rappresenta.

## Funzioni finte/mock della reference — inventario (da non copiare come comportamento)

1. Nome utente "Elena Bianchi" / avatar "EB" / ruolo "Amministratore" hardcoded.
2. Pill "Mock connesso · ora" sempre verde, non dinamica.
3. "Ora" congelata al 14 luglio 2026 09:30 CET che guida tutte le KPI; saluto e data
   dashboard hardcoded invece che calcolati.
4. Bottone "Sincronizza posta mock" senza handler reale.
5. Nel dettaglio pratica (reference): "Conferma" campo, "Segna completata"/"Riapri
   pratica", "Crea bozza"/"Rigenera bozza" — mutazioni `useState` locali con notice che
   dichiara esplicitamente la simulazione, nessuna persistenza (fuori scope pilota, da
   tenere presente per FASE 3).
6. Impostazioni (reference): bottoni "Salva modifiche", "Test connessione", "Invita
   utente" senza handler; "Ultima sincronizzazione" hardcoded.
7. Login (reference): credenziali demo precompilate nel DOM.
8. Paginazione tabella pratiche puramente cosmetica ("Pagina 1" senza vera logica).

## Funzioni più evolute del target da conservare (non regredire)

Filtri pratiche ricchi (responsabile/cliente/fornitore/date/importi/allegati/scaduto/
filtri rapidi) · colonne personalizzabili con persistenza locale · coda di revisione
con motivazioni distinte e confronto pratiche · RBAC reale a 5 ruoli con enforcement
per-route · audit log immutabile transazionale · bozze con generazione LLM reale e
approvazione umana obbligatoria · pattern di accessibilità completi (ARIA su `Tabs`,
focus visibile, target ≥44px, badge mai solo colore, stati vuoti/caricamento/errore).
