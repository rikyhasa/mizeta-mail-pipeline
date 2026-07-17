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

## Matrice — FASE 3, tappa 1: dettaglio pratica

Decisione vincolante dell'utente per questa tappa: **pagina unica a scorrimento, NIENTE
tab**. I contenuti oggi divisi nei 6 tab (`Tabs`) confluiscono come sezioni impilate
nella colonna principale, nell'ordine della reference dove esiste un equivalente;
colonna laterale sticky (340px) con Azioni/Contesto/Controllo umano, come in
`docs/design-reference-codex.css` (`.detail-grid`/`.detail-side`).

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Layout `.detail-grid` (contenuto + colonna sticky 340px) | `case-detail.tsx` | `pratiche/[id]/page.tsx` (grid `minmax(0,1fr)_340px`) | — | dati reali del `Case` Prisma | — | autenticato | no | il target usava `Tabs` (6 schede); ora sezioni impilate come richiesto dall'utente | rimosso `Tabs`, sezioni `Card` con `id` per ancoraggi | medio (pagina più lunga da scorrere) | fatto |
| Box "Sintesi operativa" (priorità + summary + meta-grid Stato/Responsabile/Scadenza/Importo) | `case-detail.tsx` | `SummaryCard.tsx` | campi statici | `Case` reale; Stato/Responsabile restano **modificabili inline** (`InlineSelect`) | PATCH status/assign | case:write | no | reference ha campi statici, target mantiene la modifica inline (più avanzato) | conservata la modifica inline, solo restyling nel meta-grid | basso | fatto |
| "Scadenze" (assente in reference: solo 1 campo "Scadenza" nel meta-grid) | — | `DeadlinesCard.tsx` | — | `CaseDeadline[]` reale, multi-scadenza | — | case:read | no | capacità del target senza equivalente reference | sezione propria dopo Sintesi operativa | basso | fatto |
| Box "Anomalie e controlli" | `case-detail.tsx` | `AnomaliesCard.tsx` | array di flag su dati mock | `securityFlags` da `EmailMessage`, `anomaly_reason` da `CaseField`, `CaseRelation` PENDING | — | case:read | no | — | 1:1, solo restyling | basso | fatto |
| — (assente in reference, "review" è solo un filtro tabella) | — | `RelationsCard.tsx` | — | `CaseRelation` reale (duplicati/collegate) | PATCH relations (confirm/reject) | case:write | sì (route esistente) | capacità del target senza equivalente reference — conservata | sezione propria dopo Anomalie | basso | fatto |
| Box "Dati estratti" con badge conteggio | `case-detail.tsx` | `ExtractedFieldsSection.tsx` | array `fields` mock, bottone "Conferma" client-only | `CaseField[]` reale, conferma reale con audit (`FIELD_CONFIRMED`) | PATCH fields | case:write | sì | reference: "Conferma" aggiorna solo `useState` locale — qui persiste davvero | 1:1 struttura visiva, dietro dati/azioni reali | basso | fatto |
| Box "Cronologia email" (allegati annidati per messaggio) | `case-detail.tsx` | `EmailTimelineCard.tsx` | array `emails` mock | `EmailMessage[]`/`Attachment[]` reali | download allegato via `/api/attachments/[id]` | case:read | no | il target aveva "Allegati" come card separata dalla cronologia — unificate come nella reference, allegati annidati per messaggio | fuso in un'unica sezione, fedeltà aumentata | basso | fatto |
| Box "Bozza di risposta" con bottone "Crea/Rigenera bozza" | `case-detail.tsx` | `DraftsCard.tsx` | bottone simulato, notice "modalità simulata; nessuna email è stata inviata" | `EmailDraft` reale, generato da `LLMProvider`, approvazione umana obbligatoria (invariante 3) | POST drafts, PATCH approve/discard | case:write | sì | reference finge la generazione; qui è reale (mock LLM heuristics o Anthropic dietro flag), e non invia mai nulla (invariante 2) | bottone di generazione spostato dall'header dentro la sezione, come in reference | basso | fatto |
| — (assente in reference come sezione: solo il PDF export nell'header) | — | `DocumentsCard.tsx` | — | `GeneratedDocument[]` reale, generazione via `GeneratedDocumentService` | POST documents | case:write | sì | capacità del target senza equivalente reference — conservata | sezione propria dopo Bozza di risposta | basso | fatto |
| — (assente in reference: bottone "Aggiungi attività" nella colonna azioni non apre una lista reale) | — | `TasksCard.tsx` | — | `Task[]` reale | POST tasks | case:write | no | capacità del target senza equivalente reference — conservata | sezione propria, raggiungibile da "Aggiungi attività" nella colonna Azioni | basso | fatto |
| — (assente in reference: bottone "Commento interno" nella colonna azioni non apre una lista reale) | — | `CommentsCard.tsx` | — | `Comment[]` reale | POST comments | case:write | no | capacità del target senza equivalente reference — conservata | sezione propria, raggiungibile da "Commento interno" nella colonna Azioni | basso | fatto |
| Box "Registro attività" (per-pratica) | `case-detail.tsx` | `AuditLogCard.tsx` | array `audit` mock, attore sempre "Sistema mock" | `AuditLog[]` reale, attore reale o "(sistema)" | — | case:read | — (è già il log) | — | 1:1, ultima sezione della pagina | basso | fatto |
| Colonna "Azioni" (bottoni: Assegna responsabile, Modifica dati, Aggiungi attività, Commento interno, Genera documento, Segna completata) | `case-detail.tsx` | `DetailSidebar.tsx` | bottoni simulati, "Assegna responsabile"/"Modifica dati" senza vera UI dietro | scorciatoie di **navigazione reale** (ancoraggi `#dati-estratti` `#attivita` `#commenti` `#documenti`) + toggle di stato reale | PATCH status | case:write | sì (toggle) | "Assegna responsabile" e "Modifica dati" non hanno un bottone dedicato: sono già editabili inline in Sintesi operativa/Dati estratti — niente azione duplicata e finta | ancoraggi reali invece di azioni popup simulate | basso | fatto |
| Colonna "Contesto" (party/reparto/categorie secondarie) | `case-detail.tsx` | `DetailSidebar.tsx` | campi statici | `Case.customer`/`.supplier`/`.department`/`.secondaryCategories` reali | — | case:read | no | — | 1:1 | basso | fatto |
| Colonna "Controllo umano" (disclaimer fisso) | `case-detail.tsx` | `DetailSidebar.tsx` | testo fisso della reference | testo riformulato per riflettere le invarianti reali (CLAUDE.md #2, #3) | — | — | no | copy diversa, stesso significato: nessun invio email, nessun pagamento, nessuna scrittura gestionale, bozze sempre da approvare | testo accurato al comportamento reale, non copiato letteralmente | basso | fatto |
| Verifica dispositivo multa (`FineDeviceVerification`, `.fine-verification`) | `fine-device-verification.tsx`, `lib/fines/*` | — | `FineTechnicalAnalysis` interamente mock | **nessun equivalente nel modello Prisma del target** | — | — | — | gap funzionale reale: il target non ha ancora un sotto-dominio "verifica multe" | non portato in questa tappa — nessuna struttura visiva aggiunta senza un dato reale dietro, per non creare una falsa parità (principio di veridicità, FASE-8-UI-PORTING.md) | medio (fedeltà incompleta per le pratiche categoria Multa) | non implementato — documentato come gap |

### Addendum FASE 8B — parità visiva (righe 60-74 aggiornate)

La tappa 1 sopra era verificata solo strutturalmente (DOM/HTTP). FASE 8B
(`FASE-8B-DETTAGLIO-PARITY.md`) ha portato la verifica a livello visivo
(screenshot reali, vedi `docs/UI-PORTING-REPORT.md`) e ha corretto la
composizione dove il layout non aveva raggiunto la densità/gerarchia della
reference. Cambia solo la presentazione — dati, query Prisma, permessi, audit,
validazioni restano quelli descritti nelle righe sopra, invariati. Rispetto
alla matrice sopra:

- **"Scadenze"** (riga 62): `DeadlinesCard.tsx` **rimosso**. La scadenza
  principale confluisce nel meta-grid di `SummaryCard.tsx` (come "Scadenza" in
  reference); le scadenze aggiuntive (se presenti) in una striscia compatta,
  `DeadlinesStrip.tsx` — non più una card intera per una riga.
- **"Anomalie e controlli"** (riga 63): `AnomaliesCard.tsx` **rimosso**,
  sostituito da `AttentionSummary.tsx`: stessa fonte dati (`securityFlags`,
  `anomaly_reason`, `CaseRelation` PENDING) più `Case.needsHumanReview` e i
  campi problematici di `CaseField[]` (già caricati, nessuna nuova query) —
  non più renderizzata quando non ci sono problemi (prima mostrava "Nessuna
  anomalia rilevata" come card vuota).
- **"Collega o separa pratica"** (riga 64): `RelationsCard.tsx` perde il
  proprio contenitore ed è ora avvolta da `RelationsSection.tsx`, un accordion
  "Relazioni e altre operazioni" (primo uso reale di `Disclosure.tsx`,
  fin qui codice morto) spostato dopo "Documenti generati" — mai più prima di
  "Dati estratti".
- **Colonna "Azioni"** (riga 72): `DetailSidebar.tsx` riscritta come
  composizione di 5 componenti — `RecommendedAction.tsx` (nuovo: un solo
  suggerimento derivato da una lista di blocker condivisa col pulsante di
  chiusura — presentazione pura, nessuna nuova logica di business, vedi
  `recommended-action.ts`), `QuickActions.tsx` (le stesse scorciatoie di
  navigazione reale di prima, peso visivo minore), `DocumentsPanel.tsx`
  (nuovo: riepilogo compatto, non duplica `DocumentsCard.tsx`),
  `ClosurePanel.tsx` (nuovo: "Segna completata" non più sempre primario —
  disabilitato con il motivo visibile quando la pratica ha blocker, stesso
  toggle `PATCH status` di prima).
- **Colonna "Contesto"** (riga 73): `ContextPanel.tsx` (nuovo) più ricco —
  aggiunge mittente e casella di origine (`EmailMessage.fromName/fromAddress`,
  nuovo include `mailboxConnection` su `loadCase()`), data ricezione
  (`EmailMessage.receivedAt` del primo messaggio), ultima attività
  (`Case.updatedAt`), veicolo/targa/conducente (`CaseField` `vehicle_type`/
  `plate`/`driver_name`, già caricati) e stato revisione
  (`Case.needsHumanReview`) — ogni riga condizionale al dato reale, mai
  inventata.
- **Sintesi operativa** (riga 61): Stato/Responsabile passano da `<select>`
  sempre visibili a etichetta maiuscola + valore in grassetto, editabili al
  click (`EditableMetaField.tsx`, avvolge `InlineSelect.tsx` invariato) — la
  modifica inline resta la stessa funzionalità, cambia solo la presentazione
  di default.
- Tutte le altre righe (Dati estratti, Cronologia email, Bozza di risposta,
  Documenti generati, Attività, Commenti, Registro attività, Controllo umano,
  gap `FineDeviceVerification`): dati/permessi/azioni invariati, solo swap del
  contenitore da `Card`/`CardHeader` a `WorkPanel.tsx` (stesse misure di
  `.box` nella reference — niente ombra, padding 19px, radius 12px) e, per
  Cronologia email/Registro attività, passaggio alla timeline a pallini
  connessi (`.detail-timeline*`) invece di liste semplici.

## Matrice — FASE 3, tappa 2: Posta acquisita

A differenza della tappa 1, qui non c'era funzionalità target da conservare/restilizzare: la
voce di nav era `disabled`, nessuna route esisteva. Vedi `docs/UI-PORTING-REPORT.md` per il
dettaglio del ciclo visivo (3 viewport, `scripts/ui-compare.ts --screen posta`).

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Pagina "Posta acquisita" (intestazione + tabella 7 colonne) | `posta/page.tsx` | `src/app/(app)/posta/page.tsx` (nuovo) | `mockEmails` (26 fissi) | `EmailMessage` reale (`direction: INBOUND`) | — (sola lettura) | autenticato | no | categoria/confidenza vivono su `Case` (via relazione), non su `EmailMessage` come nel mock; `caseId` è FK diretta, non una ricerca incrociata su tutte le pratiche | `src/lib/mail/inbox-queries.ts` nuovo, paginato (`PAGE_SIZE` di `/pratiche`) — necessario perché il volume reale cresce, a differenza del seed fisso | basso | fatto |
| Fallback "Da associare" per email senza pratica | `posta/page.tsx` | `IncomingMailTable.tsx` | codice morto (ogni mock email ha sempre una pratica) | percorso reale: messaggi non collegati (newsletter, promemoria automatici, contenuto non azionabile) | — | — | no | nella reference è puramente decorativo; nel target si attiva davvero — verificato con dati reali del seed (11 messaggi legittimamente non collegati) | nessuna modifica alla pipeline di classificazione, solo presentazione onesta dello stato reale | basso | fatto |
| Pillola di stato "Connessione mock integra" | `posta/page.tsx` | — | stringa statica | `getProviderStatusSummary()`, già usata dal Topbar | — | — | no | il Topbar globale mostra già lo stesso aggregato reale su ogni pagina; duplicarlo qui avrebbe mostrato testo identico due volte (a differenza della reference, dove le due pillole hanno testi diversi) | rimossa la pillola locale, `ProviderStatusPill` estratto come componente condiviso | basso | fatto |
| Voce di navigazione "Posta acquisita" | `app-shell.tsx` | `nav-items.ts` | — | — | — | — | no | — | `status: "disabled"` → `"active"` | basso | fatto |

## Matrice — FASE 3, tappa 3: Coda di revisione (restyling)

Nessuna pagina reference da misurare: in `.reference/mizeta-flow` "coda di revisione" è solo
un filtro client-side sulla tabella pratiche (`cases-table.tsx`), non un layout proprio.
Restyling puro del linguaggio già stabilito nelle tappe 1-2 — vedi `docs/UI-PORTING-REPORT.md`
per il dettaglio.

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Filtro "Da verificare" (bottone + etichetta rossa inline) | `cases-table.tsx` | `src/app/(app)/revisione/` (invariato in questa tappa) | `needsHumanReview` letto da un array mock | `CaseRelation` PENDING + `Case.needsHumanReview`, già reali da prima di FASE 3 | PATCH relazione (confirm/reject), PATCH review (segna verificata) | `case:write` | sì (già presente) | il target ha uno split-view con motore di motivazioni a 6 tipi (`computeReasons()`), la reference solo un filtro senza pagina propria — capacità del target, va preservata integralmente | nessuna query/azione toccata in questa tappa, solo contenitori | basso | fatto (funzionalità preesistente, non toccata) |
| — (nessun contenitore proprio nella reference) | — | `ReviewDetail.tsx` | — | — | — | — | — | i due pannelli (relazione/pratica) usavano `rounded-xl p-5` ad hoc | adottato `WorkPanel` (ora `src/components/ui/WorkPanel.tsx`, promosso da componente locale del dettaglio pratica) — stesse misure di `.box` (padding 19px, radius 12px, niente ombra) | basso | fatto |
| — | — | `ReviewDetail.tsx` | — | — | — | — | — | stato vuoto aveva una doppia cornice tratteggiata (`EmptyState` annidato in un altro contenitore tratteggiato) | rimosso il wrapper ridondante, `EmptyState` reso direttamente | basso | fatto |
| — | — | `ReviewList.tsx` | — | — | — | — | — | intestazioni di sezione a 12px (`text-xs`) invece del token `.detail-label` (10px) già stabilito | allineate a `.detail-label` | basso | fatto |

## Matrice — FASE 3, tappa 4: Bozze e documenti (verifica, non costruzione)

Né SPEC.md né la reference descrivono questo come una schermata a sé — vedi
`docs/UI-PORTING-REPORT.md` per il ragionamento completo. Tappa di verifica sui componenti
per-pratica già reskinnati in FASE 8B.

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | `DocumentsCard.tsx` | — | `GeneratedDocument.type` (enum) | — | — | — | il valore enum grezzo (es. "FINE_SHEET") veniva mostrato senza traduzione, unico caso nel dettaglio pratica | nuova mappa `GENERATED_DOCUMENT_TYPE_LABELS` in `src/lib/i18n/labels.ts` (8 voci, testo da SPEC.md §12) | basso | fatto |

## Matrice — FASE 3, tappa 5: Report e documenti

Galleria onesta, solo presentazione — nessuna migrazione, nessuna funzionalità backend nuova
(decisione utente). Vedi `docs/UI-PORTING-REPORT.md` per il ragionamento completo su quali
modelli hanno generazione reale.

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Galleria 8 modelli documento (`.settings-grid`, 2 colonne) | `report/page.tsx` | `src/app/(app)/report/page.tsx` (nuovo) | ogni card genera un PDF da un `caseId` hardcoded, bottone "Genera esempio · {code}" | `GeneratedDocument` reale, aggregato per tipo | — (nessuna generazione dalla pagina stessa) | autenticato | no | solo 3 modelli su 8 hanno generazione server-side reale (`QUOTE_SHEET`/`CLAIM_DOSSIER`/`FINE_SHEET`); gli altri 5 — inclusa "Scheda ordine di trasporto", mai implementata nemmeno per-pratica, e i 4 report aggregati — richiederebbero funzionalità backend mai esistita (caseId opzionale su `GeneratedDocument`, generazione cross-pratica) | `src/lib/documents/report-queries.ts` nuovo (`getDocumentTemplateStats`, conteggio reale via `groupBy`); i 3 modelli implementati linkano a `/pratiche?category=X` invece di generare qui (la generazione resta in `DocumentsCard.tsx`, non duplicata); gli altri 5 badge "Non ancora disponibile" | basso | fatto |
| Card bloccata "Presentazioni PowerPoint" | `report/page.tsx` | `report/page.tsx` | badge "Fase futura" | testo di SPEC.md §12 ("post-MVP") | — | — | no | — | 1:1, stesso principio di onestà delle voci di nav disabilitate | basso | fatto |
| Voce di navigazione "Report e documenti" | `app-shell.tsx` | `nav-items.ts` | — | — | — | — | no | — | `status: "disabled"` → `"active"` | basso | fatto |

## Matrice — FASE 3, tappa 6: Registro attività (pagina globale)

Vedi `docs/UI-PORTING-REPORT.md` per il dettaglio del ciclo visivo (2 iterazioni: baseline +
raggruppamento accessi ripetuti).

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Tabella 5 colonne (Data e ora/Azione/Pratica/Attore/Dettaglio), 30 eventi fissi | `audit/page.tsx` | `src/app/(app)/audit/page.tsx` (nuovo) | `mockCases.flatMap(c=>c.audit)` | `AuditLog` reale, paginato | — (sola lettura) | autenticato | — (è già il log) | `metadata` è JSON strutturato per azione, non testo libero come "Dettaglio" nel mock — colonna omessa (stessa scelta di `AuditLogCard.tsx` per-pratica); paginazione reale al posto del limite fisso a 30 | `src/lib/audit/queries.ts` nuovo (`getAuditLogEntries`), 4 colonne invece di 5 | basso | fatto |
| — | — | `AuditLogTable.tsx` | — | — | — | — | — | run consecutivi di `CASE_VIEWED` sulla stessa pratica/attore dominavano la pagina (rumore da sviluppo/test, un caso reale con 47 accessi consecutivi osservato) | raggruppati in un'unica riga "N accessi alla pratica", stesso principio di `AuditLogCard.tsx` (FASE 8B) applicato alla pagina globale | basso | fatto |
| Badge "Audit integro" | `audit/page.tsx` | `audit/page.tsx` | decorativo | garanzia architetturale reale (nessuna rotta di modifica/cancellazione per `AuditLog`) | — | — | — | — | 1:1, ma non più decorativo | basso | fatto |
| Voce di navigazione "Registro attività" | `app-shell.tsx` | `nav-items.ts` | — | — | — | — | no | — | `status: "disabled"` → `"active"` — tutte e 6 le voci ora reali | basso | fatto |

## Matrice — FASE 3, tappa 7: Impostazioni (restyling)

Reference qui in gran parte decorativa (`demoUsers` hardcoded, bottoni senza handler, 3
sezioni statiche) — il target ha 7 sezioni reali che coprono già ogni voce di SPEC.md §16.
Vedi `docs/UI-PORTING-REPORT.md` per il ragionamento completo.

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Griglia piatta 6 card (`.settings-grid`) | `impostazioni/page.tsx` | `SettingsNav` (7 tab verticali, invariata) | 3 sezioni su 6 completamente statiche, bottoni senza handler | `RuleSettingsData`/`MailboxConnection`/`User`/`ReplyTemplate` reali | PATCH/POST reali su 8 rotte `/api/settings/*` | `settings:manage` | sì (già presente) | il target ha 2 sezioni senza equivalente reference (Modelli di risposta, Monitoraggio) e form con molti campi — una griglia piatta sempre visibile avrebbe contraddetto la densità già stabilita | mantenuto `SettingsNav`, stessa scelta di "coda di revisione" (`SplitView`) | basso | fatto |
| 9 componenti (`MailboxesSection`, `AutomationSettingsForm` ×3, `CategorySettingsForm` ×2, `UsersSection`, `ReplyTemplatesSection`, `ObservabilitySection`, pannello "Modalità") | — | — | — | — | — | — | — | usavano `Card`/`CardHeader` (pattern pre-FASE-8B) | migrati a `WorkPanel` | basso | fatto |
| `.setting-row`/`.setting-name`/`.setting-desc` | `globals.css:74` | `globals.css` | — | — | — | — | — | non ancora portate | nuove classi `.detail-setting-row`/`.detail-setting-name`/`.detail-setting-desc`, misure esatte dalla reference | basso | fatto |
| Card "Limiti di sicurezza" (Privacy/Assegnazione/Limiti — 3 righe statiche) | `impostazioni/page.tsx` | `impostazioni/page.tsx` (tab "Informazioni tecniche") | testo statico | garanzie architetturali reali (CLAUDE.md invarianti 1-2) | — | — | — | — | nuova card, stesso contenuto già usato in `ContextPanel`/`DraftsCard` | basso | fatto |
| Bottone "Salva modifiche" (header) | `impostazioni/page.tsx` | — | senza handler | — | — | — | — | ogni tab ha già il proprio salvataggio reale (`UnsavedChangesBar`) | non portato: un bottone globale sarebbe stato fuorviante | basso | non applicabile (per scelta) |
| Toggle "Escludi caselle personali" | `impostazioni/page.tsx` | — | statico | — | — | — | — | non esiste in `RuleSettingsData` | non aggiunto: funzionalità nuova non richiesta, fuori dal perimetro di un restyling | basso | non applicabile (per scelta) |

## Matrice — FASE 3, tappa 8: Login

`/login` era già interamente reale (form POST, zod, verifica password, sessione) — nessun
divario funzionale, solo visivo. Vedi `docs/UI-PORTING-REPORT.md` per i valori esatti letti
dalla reference.

| UI reference | File origine | Target | Mock reference | Fonte reale | Azione reale | Permessi | Audit | Differenze funzionali | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `.login-page` (headline 47px, lockup brand 2 righe, eyebrow, riga 3 funzionalità, form h2 27px, bottone piena larghezza, `.form-help`) | `login/page.tsx` | `src/app/login/page.tsx` | credenziali precompilate, `.form-help` con claim "ambiente dimostrativo" falso per il target | form reale invariato | POST reale verso `/api/auth/login` (invariato) | — | — | tutti i valori misurati e applicati come Tailwind arbitrari one-off, non promossi a token condivisi | headline/eyebrow/lockup/riga funzionalità/dimensioni form portate esattamente; `.form-help` sostituita con una frase reale (non il claim demo della reference) | basso | fatto |
| Sfondo pannello destro (`background:#fff` esplicito) | `login/page.tsx` | `login/page.tsx` | — | — | — | — | — | ereditava `--color-surface-muted` dal `body`, grigio leggero invece di bianco puro | aggiunto `bg-white` su `&lt;main&gt;` | basso | fatto |

## Matrice — FASE 3, tappa 9: Responsive completo

Verifica trasversale, non una schermata singola: nessun divario funzionale trovato, solo
conferma che il comportamento responsive già costruito nelle tappe precedenti (pilota FASE 2 +
breakpoint `.detail-*` di FASE 8B) regge su tutte le 9 schermate portate. Dettagli completi in
`docs/UI-PORTING-REPORT.md`, sezione "FASE 3, tappa 9".

| UI reference | File origine | Target | Verifica | Esito | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|
| `@media(max-width:800px)` shell (`.app-shell`, `.sidebar`, `.nav{overflow:auto}`) | `globals.css` | `AppShell.tsx`/`Sidebar.tsx`/`Topbar.tsx` | drawer overlay sotto `lg:` (1024px), verificato interattivamente (apertura/chiusura a 390px) | già corretto, costruito nel pilota FASE 2 | nessuna modifica | basso | verificato |
| `@media(max-width:1200px)` `.meta-grid` / `@media(max-width:800px)` `.field-list` | `globals.css` | `.detail-meta-grid`/`.detail-field-grid` (`globals.css`, FASE 8B) | screenshot a 768px (1 colonna) e 1024px (2 colonne) | breakpoint già identici alla reference | nessuna modifica | basso | verificato |
| griglie KPI/statistiche/filtri (`.cards-seven`, `.stats-strip`) | `globals.css` | `DashboardKpiCards`, `StatsStrip`, `FiltersBar`, form Impostazioni (Tailwind `grid-cols-N sm:grid-cols-M`) | screenshot a 390px | già collassano senza overflow | nessuna modifica | basso | verificato |
| tabelle (nessun equivalente diretto: reference non ha tabelle dense multi-colonna fuori da `.cards-seven`) | — | `CasesTable`, `IncomingMailTable`, `AuditLogTable` (`overflow-x-auto` + `whitespace-nowrap`) | screenshot a 390px (colonne di destra tagliate al bordo, scroll orizzontale non catturabile in uno screenshot statico) | pattern scelto deliberatamente in tappa 2, coerente con `.nav{overflow:auto}` della reference | nessuna modifica | basso | verificato |

## Matrice — FASE 3, tappa 10: Rifinitura finale

Le 4 annotazioni raccolte durante FASE 8B/FASE 3. Dettagli completi in
`docs/UI-PORTING-REPORT.md`, sezione "FASE 3, tappa 10".

| Annotazione | File origine | Target | Fonte reale | Azione reale | Permessi | Audit | Decisione | Rischi | Stato |
|---|---|---|---|---|---|---|---|---|---|
| Sintesi operativa troncata a metà parola | `_components/SummaryCard.tsx` (rendering, invariato) | `llm/mock/classify-heuristics.ts` (`summary`) | il bug era nel generatore mock, non nel rendering: `emailBody.slice(0,240)` grezzo | nuova `truncateAtWordBoundary()` in `lib/format.ts`, troncamento sull'ultimo spazio + ellissi | — | — | fix nel provider mock, non un nuovo algoritmo di riassunto (fuori scope) | basso | fatto (verificato a livello di funzione; i case già seminati restano col vecchio summary finché non vengono ri-processati — nessun reseed del DB di sviluppo condiviso, per non alterare stato non mio) |
| Stampa/Genera PDF assenti in testata | `case-detail.tsx` (`window.print()` + `<a href=".../pdf">`) | `_components/DetailHeader.tsx`, nuovo `PrintButton.tsx` | — | Stampa: `window.print()` nativo (nuovo `print:hidden` su Sidebar/Topbar/DetailSidebar per un'stampa pulita). Genera PDF: link a `#documenti`, mostrato solo se `DOCUMENT_TYPE_BY_CATEGORY` ha un modello per la categoria — porta all'azione di generazione reale già in `DocumentsCard`, non la duplica | — | — | nessun endpoint PDF generico creato (la reference lo finge, il target no) — "Genera PDF" assente per le 5 categorie senza modello, non disabilitato con un falso testo | basso | fatto |
| Ricerca globale statica (form GET, nessun risultato inline) | `topbar` con ricerca live | nuovo `GlobalSearch.tsx` + `GET /api/cases/search` | riusa `getFilteredCases` (stessa query di `/pratiche`, campi titolo/riferimento/cliente/fornitore, + etichette categoria) | dropdown con debounce 300ms, minimo 2 caratteri, navigabile da tastiera (frecce/Invio/Esc), "Vedi tutti i N risultati" verso `/pratiche?q=...` | `requireUser()` (stesso livello di `/api/cases`) | — | nuovo endpoint di sola lettura, riuso della query esistente — non una nuova API di business, solo l'esposizione JSON necessaria per il dropdown | basso | fatto |
| Ricerca per nome categoria ("multa" → Multa, "reclamo" → Reclamo o danno) — richiesta utente dopo la prima consegna, 2026-07-17 | — | `getFilteredCases` (`lib/dashboard/queries.ts`) | `CASE_CATEGORY_LABELS` (etichette già esistenti, nessuna nuova lista) | `q` confrontato anche con le etichette di categoria (case-insensitive); se matcha, le categorie corrispondenti si aggiungono all'`OR` titolo/riferimento/cliente/fornitore — corregge sia `/pratiche` sia `/api/cases/search` con un'unica modifica condivisa | — | — | nessuna nuova API, nessuna lista duplicata | basso | fatto |
| Filtri di "Pratiche" con bottone "Applica" | `FiltersBar.tsx` | `FiltersBar.tsx` (client component) | stessa query `getFilteredCases` via `GET /pratiche`, invariata | submit automatico al cambio (`router.push`, `scroll:false`) — select/checkbox/date immediati, `q`/importi con debounce 400ms; bottone "Applica" rimosso, "Azzera filtri" invariato | — | — | nessun cambio alle API: stesso `GET /pratiche?...` di prima, solo innescato da `onChange` invece che da un submit nativo | basso | fatto |
| "Posta acquisita" senza alcun filtro | nessun equivalente (la reference non ha filtri neanche lei) | nuovo `MailFilters.tsx` + `getIncomingMessages(page, category)` | `Case.category`, già mostrata nella colonna "Categoria" di `IncomingMailTable` — nessuna nuova query di dominio | select categoria, submit automatico al cambio, "Azzera filtri" quando attivo, paginazione preserva il filtro | — | — | decisione utente esplicita (AskUserQuestion, 2026-07-17): aggiungere un filtro minimo a Posta invece di lasciarla senza, per rendere l'annotazione "Pratiche e Posta acquisita" applicabile a entrambe | basso | fatto |

## Righe non ancora compilate

Nessuna — tutte le tappe di FASE 3 (1-10) sono state completate.

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
