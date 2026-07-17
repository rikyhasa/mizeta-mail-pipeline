# Audit UX critico — luglio 2026 (FASE 9, Fase A)

> Prodotto durante una sessione di sola analisi (`/clear`, modalità Plan). Nessuna
> modifica a codice, schema, seed o test è stata effettuata in questa fase.
> Branch: `audit/ux-e-autovelox` (da `main`). Le correzioni P0 vanno su
> `fix/p0-validazioni` (Fase B), fuori da questo documento/branch.

## 1. Stato attuale del branch e dei test

- Punto di partenza: `main`, pulito, nessun branch di audit ancora esistente.
- `npm run typecheck` → **pulito**.
- `npm run lint` → **pulito**.
- `npm run test` → **227/228**. Unico fallimento: `tests/integration/job-queue.test.ts`
  → *"in caso di fallimento, ripianifica con backoff finché non esaurisce i
  tentativi"* (assertion su `claimed`/`jobId`, timing-dependent). Preesistente e
  scorrelato da quest'audit — non toccato.
- Dev server target già attivo su `:3001` (usato per l'ispezione DOM read-only
  descritta sotto); reference Mizeta Flow già attiva su `:3000`, **non toccata**
  (demo in uso in ufficio, come richiesto dalle note operative).
- `docs/UI-PORTING-REPORT.md` (1103 righe) documenta già cicli di confronto
  visivo con Playwright (`scripts/ui-compare.ts`) per tutte le 9 schermate, con
  screenshot versionati in `docs/screenshots/`. Questo audit si basa su
  quell'evidenza già esistente oltre che su lettura diretta del codice corrente
  e su tre agenti di esplorazione paralleli (route handler, componenti,
  `prisma/schema.prisma`, modulo mock della reference), tutti con verifica
  file:riga.

## 2. Metodologia di verifica dei due possibili P0 "dal vivo"

Le note operative chiedevano di verificare il comportamento reale degli
endpoint (non solo leggendo il codice). Dato che una chiamata mutante reale
(POST/PATCH) avrebbe lasciato il database di sviluppo del target esattamente
nello stato del difetto contestato (campo "confermato" senza valore, bozza
"Approvata" senza destinatario), la verifica dal vivo è stata fatta con:

1. **Ispezione DOM read-only** (login reale con l'utente seed `admin@mizeta.local`,
   navigazione al dev server già attivo su `:3001`, nessuna richiesta mutante
   inviata) per confermare visivamente il rendering.
2. **Query SQL di sola lettura** contro il Postgres di sviluppo (`docker compose
   exec postgres psql`, solo `SELECT`) per verificare se il difetto ipotizzato
   fosse già presente nei dati reali persistiti, non solo teoricamente possibile.

Il risultato di questa verifica ha prodotto una conferma più forte del previsto:
si veda il punto 3.2 sotto — un caso reale del database di sviluppo mostra
esattamente il difetto contestato, già accaduto e già tracciato nell'audit log.

## 3. Matrice di validazione

Legenda stati: **Validata** / **Parzialmente validata** / **Non validata** /
**Richiede una decisione di prodotto** / **Non verificabile**.

### Valutazione generale (parità 90-95% / 80-85% / 75-80%)

**Stato: Validata e superata.** `docs/UI-PORTING-REPORT.md` (verifica finale
post-tappa 10, ciclo `ui:compare` su tutte le 9 schermate, 1440×900) misura
altezza pagina intera target/reference:

| Schermata | Target | Reference | Rapporto |
|---|---|---|---|
| Dashboard | 1661px | 1628px | **1.02x** |
| Pratiche (elenco) | 2647px | 2325px | **1.13x** |
| Dettaglio pratica | 3257px | 1919px | **1.69x** |

Il rapporto per il dettaglio pratica (1.69x) è quasi identico ai ~3170/1885≈1.68x
citati nel nuovo confronto: **non è una nuova osservazione**, è la stessa
metrica già nota e già motivata in FASE 8B (15 campi estratti reali contro 4
mock nella pratica di riferimento, corpi email reali contro preview mock a una
riga — differenza di contenuto, non di porting; ridotta da 2.61x a 1.69x
nell'iterazione 4 di FASE 8B).

**Impatto**: nessuno — conferma che non serve un redesign generale.
**Soluzione consigliata**: nessuna azione.
**Priorità**: n/a.

---

### 3.1 Dashboard

**Osservazione**: "Connessioni email" troppo prominente; serve "Sincronizza
posta" solo se supportata; in assenza di sync reale mostrare solo stato/ultima
sincronizzazione.

**Stato: Non validata.**

**Evidenza**: `src/app/(app)/_components/DashboardHeader.tsx:1-41`. Non esiste
alcun bottone "Sincronizza posta" sulla dashboard — l'unica azione è un
`<Link href="/impostazioni">Connessioni email</Link>`, **visibile solo per
ADMIN** (`{isAdmin && (...)}`, righe 33-38). Il commento nel file stesso
documenta la decisione: *"Il target non ha un'azione di sincronizzazione
generica: per ADMIN un link reale alle connessioni email... nessun bottone per
gli altri ruoli — mai un bottone che finge un'azione senza handler."*

La sincronizzazione vera esiste, ma solo in Impostazioni → Connessioni email,
per-mailbox: `src/app/(app)/impostazioni/_components/MailboxesSection.tsx:63-71`
(`ActionButton` → `POST /api/settings/mailboxes/[id]/sync`). L'endpoint
(`src/app/api/settings/mailboxes/[id]/sync/route.ts:1-26`) è **reale anche in
modalità mock**: chiama `ingestMailboxChanges()`, che scrive davvero righe
`EmailMessage`/`Attachment` nel DB e accoda la pipeline — è disabilitato solo
per `pec_imap` (`501`, "scheletro documentato"). "Ultima sincronizzazione" è già
mostrata lì (`MailboxesSection.tsx:47-51`, `formatDateTime(mailbox.lastSyncAt)`).

**Differenza UI/backend**: nessuna — l'azione mostrata in UI corrisponde
esattamente a quanto implementato lato server.

**Impatto reale**: nullo — l'osservazione descrive un comportamento che è già
lo stato attuale, deciso esplicitamente in FASE 8 pilota (`docs/UI-PORTING-REPORT.md:61-64`:
*"Bottone 'Sincronizza posta mock': non portato... il bottone della reference è
comunque simulato/senza handler. Per ADMIN, l'azione primaria della dashboard è
un link reale a Impostazioni → Connessioni email"*).

**Soluzione consigliata**: nessuna azione.
**Alternative**: nessuna necessaria.
**Rischi**: nessuno.
**Priorità**: n/a.

Testi lunghi del quadro operativo su due righe: differenza marginale (rapporto
1.02x già ottimo) — **non richiede intervento**.

---

### 3.2 Elenco pratiche

**Osservazione (variabilità altezza righe 65-106px, ~7 righe visibili)**

**Stato: Validata nella causa, non nell'entità del problema.**

**Evidenza**: `src/components/cases/CasesTable.tsx`. Solo la cella titolo
(righe 179-191) non ha `whitespace-nowrap` (`max-w-xs`, nessun troncamento o
`line-clamp`) e porta sotto un `<div className="mt-1.5 flex flex-wrap gap-1">`
di badge (PEC/"Da verificare"/Allegati). Tutte le altre celle (Tipo, Cliente/
Fornitore, Scadenza, Priorità, Stato, e le opzionali Importo/Responsabile/Ultima
attività) hanno `whitespace-nowrap`. Nessuna riga ha un'altezza minima fissa.
Titoli che vanno a 2+ righe combinati con 0-3 badge (anch'essi `flex-wrap`, che
possono andare a capo a loro volta a larghezze strette) sono l'unica causa di
variabilità — confermato.

**Impatto reale**: basso — il rapporto altezza-pagina reale misurato (1.13x,
vedi sopra) è già entro la soglia accettabile indicata dallo stesso confronto.

**Soluzione consigliata**: se si vuole ridurre la variabilità, applicare
`line-clamp-2` al titolo invece di lasciarlo libero — intervento piccolo e
localizzato, **non urgente** dato il rapporto già accettabile.
**Alternative**: lasciare invariato (l'osservazione stessa scarta esplicitamente
di copiare i 61px della reference).
**Rischi**: un `line-clamp` troppo aggressivo potrebbe troncare titoli pratica
significativi (numero verbale, riferimenti) — da verificare con dati reali
prima di applicare.
**Priorità**: bassa.

**Osservazione (colonne default: includere Responsabile, mantenere
Importo/Ultima attività opzionali)**

**Stato: Non validata come difetto — decisione già presa in FASE 8.**

**Evidenza**: `CasesTable.tsx:16-20`:
```ts
const OPTIONAL_COLUMNS = [
  { key: "amount", label: "Importo" },
  { key: "responsible", label: "Responsabile" },
  { key: "updatedAt", label: "Ultima attività" },
] as const;
```
Tutte e tre opzionali, nessuna di default (`visible` iniziale è un `Set` vuoto,
riga 58 area). `docs/UI-PORTING-REPORT.md:51-53` conferma questa come decisione
esplicita di FASE 8 pilota: *"la reference mostra sempre Importo/Responsabile/
Ultima attività; il target le mantiene come colonne opzionali personalizzabili
(funzionalità più avanzata, esplicitamente da conservare)"*.

**Impatto**: nessuno — è una funzionalità del target più ricca della reference,
già valutata e mantenuta deliberatamente.
**Soluzione consigliata**: nessuna azione; se si volesse rendere "Responsabile"
visibile di default (unica modifica minima ragionevole, dato che aiuta a capire
subito chi lavora una pratica), è una scelta di prodotto reversibile in una riga
di codice (`OPTIONAL_COLUMNS` → un default-visible separato), non un fix.
**Alternative**: lasciare come oggi.
**Rischi**: nessuno.
**Priorità**: bassa/nessuna.

**Osservazione (salvare la preferenza colonne per utente)**

**Stato: Parzialmente validata.**

**Evidenza**: `CasesTable.tsx:22-75`. La preferenza è già persistita, ma solo in
`localStorage` (chiave `mizeta:pratiche:colonne`), **non per utente/DB** — non
sincronizzata multi-dispositivo. Se `window.localStorage.setItem` lancia
(private mode/quota esaurita), l'eccezione è silenziosamente ignorata
(`catch { /* preferenza non persistita, ma la sessione corrente funziona
comunque */ }`) — nessun avviso all'utente.

**Impatto reale**: basso — funziona per l'uso normale (stesso browser/dispositivo).
**Soluzione consigliata**: se si vuole "per utente" in senso stretto (cross-
dispositivo), servirebbe un campo su `User` o una tabella di preferenze — fuori
scope per un piccolo ritocco UX; **non consigliato** solo per questo dettaglio.
Più utile e a basso rischio: sostituire il `catch` silenzioso con un avviso
minimo (es. toast) quando la persistenza fallisce.
**Alternative**: lasciare `localStorage` così com'è.
**Rischi**: nessuno di rilievo.
**Priorità**: molto bassa.

**Osservazione ("Azzera filtri" nascosto quando nessun filtro è applicato)**

**Stato: Validata.**

**Evidenza**: `src/app/(app)/pratiche/_components/FiltersBar.tsx:216-218`:
```tsx
<Link href="/pratiche" className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:underline">
  Azzera filtri
</Link>
```
Nessuna condizione lo avvolge — sempre renderizzato, anche con zero filtri
attivi. Verificato anche dal vivo: nella schermata "Pratiche" filtrata per
"Multa" (screenshot), "Azzera filtri" è visibile assieme al chip "Multa" — ma
il link stesso non ha mai una condizione su `filters`. In contrasto,
`ActiveFiltersChips.tsx:102-121` ha un proprio "Rimuovi tutti i filtri"
**correttamente condizionale** (l'intera barra dei chip ritorna `null` se non
ci sono filtri attivi) — è un componente diverso dello stesso concetto.

**Impatto reale**: basso/cosmetico — un link sempre cliccabile che punta a
`/pratiche` pulito non causa danni, solo un piccolo rumore visivo quando non
serve.
**Soluzione consigliata**: avvolgere il `<Link>` di `FiltersBar.tsx:216-218`
nella stessa condizione già calcolata su `ADVANCED_KEYS`/`q`/`category`/
`status`/`priority` (pattern già presente per `hasAdvancedActive`, riga 53) —
intervento di una riga, basso rischio.
**Alternative**: lasciare invariato (impatto minimo).
**Rischi**: nessuno.
**Priorità**: bassa.

**Finding aggiuntivo non richiesto ma rilevante — autorizzazione a livello di
riga e paginazione in-memory**

**Stato: Richiede una decisione di prodotto.**

**Evidenza**: `src/lib/dashboard/queries.ts` (`getFilteredCases`, righe 243-300
circa) non applica **alcun filtro di autorizzazione a livello di riga**: nessun
campo tenant/org esiste in `prisma/schema.prisma` (zero corrispondenze per
`tenant|orgId|organizationId`) — il modello è a singolo tenant ovunque. La
query inoltre carica **tutte** le pratiche corrispondenti ai filtri con
`prisma.case.findMany({ where, include })` **senza `skip`/`take`**, poi pagina
in-memory in Node (`items.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)`,
`PAGE_SIZE = 50`) — necessario perché `amountMin`/`amountMax` filtrano su un
campo derivato (`amount`, non nativo su `Case`), non su colonna DB. RBAC
(`src/lib/auth/rbac.ts:1-16`) è puramente per-permesso (`case:read/write`), mai
per-riga: `READ_ONLY` legge l'intera tabella `Case`.

**Differenza UI/backend**: nessuna — l'interfaccia utente non promette
isolamento tenant (l'app non lo ha mai avuto), quindi non c'è un problema di
UI ingannevole. È una osservazione architetturale, non un bug rispetto alle
aspettative attuali.

**Impatto reale**: nel modello attuale (single-tenant, azienda unica Mizeta
S.r.l.) **nessun impatto di sicurezza** — non c'è un secondo tenant da cui
isolare i dati. È però un rischio di **scalabilità** (la query cresce
linearmente con il totale delle pratiche filtrate, non con la pagina) da tenere
presente se il volume di pratiche crescerà molto.

**Soluzione consigliata**: nessuna azione urgente. Se in futuro emergesse un
requisito multi-tenant (più clienti Mizeta-like sulla stessa istanza), andrebbe
introdotto un campo `organizationId` su `Case`/`User`/etc. in modo trasversale
a tutta l'app — non solo per il modulo autovelox (si veda anche
`SPEC-AUTOVELOX-DRAFT.md`, dove la stessa questione emerge). Per la
paginazione, se il numero di pratiche crescerà oltre poche migliaia, spingere
`skip`/`take` nella query Prisma e ricalcolare `amount` come colonna
derivata/materializzata invece che in-memory.
**Alternative**: nessuna azione (accettabile nel modello attuale).
**Rischi**: query più lenta al crescere del dataset; nessun rischio di
esposizione dati tra tenant (non esistono tenant multipli oggi).
**Priorità**: bassa oggi, da rivalutare se cambia la scala o il modello di
business (multi-cliente).

---

### 3.3 Dettaglio pratica

**Osservazione generale (densità/altezza pagina)**

**Stato: Non una nuova osservazione — già misurata e motivata in FASE 8B.**
Vedi tabella sopra (1.69x, ridotto da 2.61x nell'iterazione 4 di FASE 8B).
**Nessun ulteriore intervento necessario.**

**3.3.1 — Conferma dei campi mancanti (POSSIBILE P0 dal brief)**

Vedi **P0 #1** sotto.

**3.3.2 — Bozza approvata con destinatario da definire (POSSIBILE P0 dal brief)**

Vedi **P0 #2** sotto — **confermato con un caso reale nel database di sviluppo**.

**3.3.3 — Pannello laterale sticky senza `max-height`/`overflow-y`**

**Stato: Validata (nel codice); non riprodotta empiricamente sulla pratica
usata per il test, per assenza di contenuto sufficiente a superare la
viewport.**

**Evidenza**: `src/app/(app)/pratiche/[id]/_components/DetailSidebar.tsx:56`:
```tsx
<div className="flex flex-col gap-4 print:hidden lg:sticky lg:top-24">
```
Nessun `max-height` né `overflow-y` — a differenza del pattern già usato altrove
nello stesso codebase, `src/components/ui/SplitView.tsx:10`:
```tsx
<div className="lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem-2rem)] lg:overflow-y-auto">{list}</div>
```
Verifica dal vivo (Chrome, login reale, viewport ridotto a 1366×768, pratica
`PRT-2026-0025` con 7 campi mancanti su 15, nessun responsabile): il pannello
laterale (Prossima azione → Azioni rapide → Documenti → Chiusura → Contesto)
rientra interamente nell'altezza della pagina senza necessità pratica di
scroll interno — **su questo caso specifico il difetto non è visibile a
occhio**, perché il contenuto del pannello è abbastanza corto. Il codice non ha
comunque alcuna protezione: con più blocchi attivi (più campi mancanti,
Contesto più popolato, viewport ancora più basso — es. laptop 1280×720 o
finestra ridotta) il pannello supererebbe la viewport senza scroll interno,
come nell'osservazione originale (misurata a 906px di altezza viewport dalla
revisione esterna).

**Differenza UI/backend**: n/a (puramente CSS).
**Impatto reale**: basso ma reale — quando si presenta (viewport basso + molti
blocchi), le azioni in fondo al pannello (Chiusura, parte di Contesto) possono
uscire dalla parte visibile senza un modo ovvio di raggiungerle se non
scorrendo la pagina principale, perdendo la "prossima azione" dalla vista.
**Soluzione consigliata**: applicare lo stesso pattern già esistente e già
validato nel codebase (`SplitView.tsx:10`): `lg:max-h-[calc(100vh-7rem)]
lg:overflow-y-auto` (o equivalente) sul contenitore di `DetailSidebar.tsx:56`.
Intervento piccolo, un solo file, pattern già in uso altrove — basso rischio.
**Alternative**: ridisegnare il pannello per essere strutturalmente più corto
(es. comprimere "Contesto" dietro un accordion) — più invasivo, non necessario
se il fix CSS risolve il problema.
**Rischi**: uno scroll interno introduce potenzialmente una doppia scrollbar
(pagina + pannello) — da verificare visivamente dopo il fix che l'accessibilità
da tastiera (focus visibile, tab order) resti intatta, come richiesto dal brief.
**Priorità**: media (basso rischio, comportamento scorretto solo in condizioni
specifiche ma plausibili — pratiche molto incomplete su schermi piccoli).

**3.3.4 — CTA "Prossima azione" generica ("Vai")**

**Stato: Parzialmente validata.**

**Evidenza**: `src/app/(app)/pratiche/[id]/_components/recommended-action.ts:10-30`
deriva un **testo descrittivo dinamico** dallo stato reale della pratica (es.
osservato dal vivo: *"7 dato/i mancante/i o da verificare"* + *"+ 1 altro/i
punto/i da verificare"*), calcolato in `page.tsx:118-145` da `blockers` reali
(campi mancanti, revisione umana necessaria, responsabile assente, anomalie
fattura, segnali di sicurezza, relazioni pendenti). Il bottone stesso,
`RecommendedAction.tsx:27-29`, è però **sempre** testualmente "Vai":
```tsx
<a href={action.href} className={buttonClassName(...)}>Vai</a>
```
è un `<a>` di puro scroll-to-anchor (`href="#dati-estratti"` ecc.), confermato
anche dal commento nel codice stesso: *"Puro link di navigazione: nessuna
mutazione..."*. Confermato dal vivo: sulla pratica testata il blocco
"Prossima azione" mostra il testo dinamico corretto sopra un bottone "Vai".

**Impatto reale**: basso — l'informazione principale (cosa manca, quanti punti)
è già comunicata correttamente; manca solo che il bottone stesso rifletta
un'azione ("Completa i dati" invece di "Vai") e che il clic apra/focalizzi il
primo controllo invece di solo scrollare.
**Soluzione consigliata**: cambiare il testo del bottone da "Vai" a un verbo
d'azione derivato dallo stesso `blockers[0]` già disponibile (es. sostituire
"Vai" con un'etichetta breve coerente, tipo "Completa" per i dati mancanti,
"Assegna" per il responsabile) — richiede solo una mappa aggiuntiva
`label → verbo`, non nuova logica di business. Far sì che il clic, oltre allo
scroll, apra il form di modifica del primo campo problematico e vi porti il
focus è un intervento più ampio (tocca `ExtractedFieldCell`/`FieldEditForm`) —
valutabile in Fase C ma non urgente.
**Alternative**: lasciare "Vai" (impatto basso, non un bug funzionale).
**Rischi**: nessuno di rilievo per il solo cambio di testo; il focus automatico
del form richiederebbe attenzione all'accessibilità (focus trap, annunci
screen reader).
**Priorità**: bassa.

**3.3.5 — Azioni rapide come link di scorrimento**

**Stato: Validata.**

**Evidenza**: `src/app/(app)/pratiche/[id]/_components/QuickActions.tsx`: tutti
e quattro i collegamenti ("Modifica dati", "Aggiungi attività", "Commento
interno", "Genera documento") sono `<a href="#sezione">`, confermato anche dal
commento del file: *"Scorciatoie reali di navigazione verso le sezioni
corrispondenti — non un menu di azioni simulate."* — una scelta deliberata,
non un bug, ma le etichette (in particolare "Modifica dati" e "Genera
documento", che suonano come azioni immediate) restano potenzialmente
fuorvianti rispetto al comportamento reale (solo scroll, nessuna apertura di
form/generazione).

**Differenza UI/backend**: l'etichetta promette un'azione, il comportamento è
solo navigazione — non un difetto funzionale (i moduli target esistono più
sotto nella pagina), ma un disallineamento tra aspettativa e risultato.
**Impatto reale**: basso — l'utente arriva comunque alla sezione giusta, con
un click extra necessario per l'azione vera.
**Soluzione consigliata (una delle due, a scelta di prodotto)**: (a) rinominare
in modo che l'etichetta descriva la navigazione ("Vai ai dati", "Vai alle
attività"...), oppure (b) far sì che il click scrolli **e** apra/focalizzi il
controllo di editing pertinente (coerente con l'intervento suggerito per 3.3.4).
**Alternative**: lasciare invariato — è comunque una scelta già deliberata e
documentata nel codice, non un difetto introdotto per errore.
**Rischi**: nessuno.
**Priorità**: bassa — richiede una decisione di prodotto tra (a) e (b), non una
correzione tecnica obbligata.

**3.3.6 — Gerarchia dei dati estratti**

**Stato: Non richiede ulteriore intervento strutturale.** Già rivista in FASE
8B (griglia unica, "Mancante"/"Da verificare" come badge inline nella singola
cella, non più banner separati a tutta larghezza — `docs/UI-PORTING-REPORT.md:217-268`).
Confermato dal vivo: la griglia a 2 colonne mostra celle di altezza uniforme,
badge "Mancante" inline, bottone "Conferma" quando non confermato. **Indipendente**
dal fix P0 di validazione (3.3.1/P0#1), che è un problema di *cosa succede al
click*, non di *come è disposta la griglia*.

**3.3.7 — Cronologia email completamente aperta**

**Stato: Validata (nessuna collassabilità), impatto basso nel caso testato.**

**Evidenza**: verifica dal vivo su `PRT-2026-0025` (2 email in cronologia):
entrambe le email appaiono per intero (corpo completo, non troncato/preview),
senza alcun controllo "Mostra email completa"/"Espandi tutte", allegato sempre
visibile con nome file e dimensione. Nessun agente ha trovato, nel codice di
`EmailTimelineCard.tsx`, un meccanismo di espandi/comprimi per singola email.

**Impatto reale**: basso sul caso testato (2 email, corpi brevi/medi); più
rilevante su pratiche con molte email o corpi lunghi (già la causa principale,
insieme ai 15 campi estratti, del rapporto 1.69x discusso sopra — coerente con
quanto già osservato in FASE 8B, che però non ha introdotto un collassamento
specifico per i corpi email, per non eccedere lo scope di quel giro di
correzioni, come dichiarato esplicitamente in quel report).
**Soluzione consigliata**: introdurre lo stesso pattern `Disclosure` già usato
per Attività/Commenti/Bozze precedenti (FASE 8B iterazione 4): email più
recente aperta per intero, le altre con anteprima (2-4 righe) e un
"Mostra email completa" per singola voce — allegati sempre visibili come oggi.
**Alternative**: lasciare invariato se il volume tipico di email per pratica
resta basso (2-5, come nei dati seed osservati).
**Rischi**: nessuno di rilievo — pattern già in uso altrove nella stessa pagina.
**Priorità**: bassa/media (utile per densità, non urgente).

**3.3.8 — "Segna completata" e validazione dei blocchi**

Vedi **P0 #3** sotto — un finding più serio di quanto l'osservazione originale
ipotizzasse.

---

## 4. Problemi P0 (tre, non due — uno emerso dall'evidenza raccolta)

Tutti e tre condividono la stessa causa architetturale: le validazioni di
"completezza"/"blocco" (`blockers`, campo `disabled`) esistono **solo** come
calcolo client-side per il rendering (`page.tsx:118-145`), mai ripetute lato
server nell'endpoint PATCH corrispondente.

### P0 #1 — Conferma di un campo mancante senza validazione server-side

**Stato: Validata.**

**Evidenza**: `src/app/api/cases/[id]/fields/[fieldKey]/route.ts:6-8`:
```ts
const patchSchema = z.object({
  value: z.string().nullable().optional(),
});
```
Righe 28-38: quando il bottone "Conferma" su un campo "Mancante" invia un body
vuoto (`{}`), `hasNewValue` (riga 28) è `false`, e il codice comunque esegue:
```ts
data: {
  ...(hasNewValue ? { value: parsed.data.value } : {}),
  confirmedById: user.id,
  confirmedAt: new Date(),
  needsHumanReview: false,
},
```
**nessun controllo che il valore esistente (`existing.value`) non sia già
`null`/vuoto prima di accettare la conferma.** L'audit log viene scritto
correttamente (`FIELD_CONFIRMED`, righe 41-48), ma su un dato che resta
mancante.

**Verifica dal vivo**: confermato visivamente — sulla pratica `PRT-2026-0025`
(`ENTE`, `LUOGO INFRAZIONE`, `SCADENZA PAGAMENTO ORDINARIO`, `TERMINE PER IL
RICORSO`, `PUNTI DECURTATI`, `DOCUMENTI MANCANTI`, `CANALE DI RICEZIONE` — 7
campi) il bottone "Conferma" è renderizzato **abilitato** accanto al valore
`—` e al badge "Mancante". Non è stato inviato il click reale (per non lasciare
il dato di sviluppo in questo stato — vedi §2), ma la query SQL di sola lettura
sulla tabella `CaseField` per questa pratica conferma che **nessun campo
risulta ancora confermato** — cioè il bug non è (ancora) accaduto qui, a
differenza del P0 #2 sotto. Il codice sorgente e il test esistente
(`tests/integration/case-detail-actions.test.ts:77-101`, che verifica solo il
percorso di successo con valore presente) confermano che nessun test copre il
rifiuto di una conferma vuota.

**Differenza UI/backend**: nessuna — l'endpoint accetterebbe la richiesta
esattamente come il bottone la invierebbe.
**Impatto reale**: alto — un campo legalmente/operativamente rilevante (es.
scadenza ricorso di una multa) potrebbe risultare "confermato da un umano"
senza che nessun valore sia mai stato inserito, contraddicendo l'invariante 6
di CLAUDE.md ("dati mancanti = null, mai inventati" — qui non si inventa un
valore, ma si marca come *verificato* un dato ancora assente, il che è
altrettanto fuorviante per chi legge lo stato della pratica).
**Soluzione consigliata**: nella route, prima di eseguire l'update, rifiutare
la richiesta (`422`) quando `!hasNewValue && !existing.value` (conferma di un
campo ancora vuoto senza fornire un valore) — l'azione primaria lato UI per un
campo "Mancante" dovrebbe diventare "Inserisci valore"/"Completa dato" (che
apre `FieldEditForm`) invece di un "Conferma" abilitato senza valore.
**Alternative**: permettere una "conferma esplicita di assenza" (es. "confermo
che questo dato non è disponibile") come azione distinta e verbalizzata, se per
alcuni campi è legittimo che restino vuoti anche dopo revisione umana — da
decidere con l'utente, non implicito nel bottone "Conferma" attuale.
**Rischi**: il fix non tocca la logica di business di estrazione, solo la
route di conferma — rischio di regressione basso, purché il test esistente
(percorso di successo) resti verde e se ne aggiunga uno nuovo per il rifiuto.
**Priorità**: **alta (P0)**.

### P0 #2 — Bozza approvabile senza destinatario/con placeholder non risolti

**Stato: Validata, con un caso reale già presente nel database di sviluppo.**

**Evidenza**: `src/lib/pipeline/create-draft-for-case.ts:47` (circa):
```ts
const toAddresses = caseRecord.customer?.email ? [caseRecord.customer.email] : caseRecord.supplier?.email ? [caseRecord.supplier.email] : [];
```
Se né cliente né fornitore hanno un'email registrata, `toAddresses` è creato
vuoto (`[]`). `DraftCard.tsx:76` lo rende come *"(destinatario da definire)"*,
ma il bottone "Approva" **non è mai disabilitato** in base a
`toAddresses.length`/`placeholders.length`. L'endpoint di approvazione,
`src/app/api/cases/[id]/drafts/[draftId]/route.ts:25-27`, valida **solo** che
`draft.status === "PENDING_APPROVAL"`:
```ts
if (draft.status !== "PENDING_APPROVAL") {
  return Response.json({ error: "La bozza è già stata approvata o scartata" }, { status: 409 });
}
```
Nessun controllo su destinatario, oggetto, corpo o placeholder non risolti.

**Verifica dal vivo (query SQL read-only sul Postgres di sviluppo)**:
```
id                        | caseId                     | status   | toAddresses | subject
cmrm7pjld000mpdmh79tpi23t | cmrl7g035035yen8o3s317o1q  | APPROVED | {}          | Comunicazione in merito alla pratica
approvedById: cmrl7fzz20000en8offw5k4gk (admin@mizeta.local) · approvedAt: 2026-07-15 15:05:41.741
generatedAt/createdAt: 2026-07-15 15:05:38.161 (approvata 3 secondi dopo la generazione)
```
Confermato anche via `AuditLog`: una riga `DRAFT_APPROVED` per questo
`entityId`, con `actorId` = utente admin reale, timestamp coerente. **Questo
non è un dato seed difettoso** (i percorsi di seed/enrichment,
`prisma/seed.ts`/`prisma/seed-enrich.ts`, creano sempre bozze in
`PENDING_APPROVAL`, mai `APPROVED` direttamente) — è la prova che **qualcuno,
con una sessione autenticata reale, ha già cliccato "Approva" su questa
identica bozza priva di destinatario**, esattamente lo scenario descritto
nell'osservazione originale, e il sistema lo ha permesso senza alcun rifiuto.
Confermato anche dal vivo nel rendering: la card "Bozza di risposta" mostra
badge "Approvata", "A: (destinatario da definire)", corpo email troncato a metà
frase ("Importo ridotto (pagamento en" — coerente anche con l'annotazione già
nota in `docs/UI-PORTING-REPORT.md:387-388` sul troncamento della sintesi
operativa a metà parola).

**Differenza UI/backend**: nessuna — l'avviso "(destinatario da definire)" è
solo informativo, non blocca nulla lato client né lato server.
**Impatto reale**: alto — una bozza di comunicazione formale (potenzialmente
verso un ente per una multa) può risultare "Approvata" (cioè pronta, secondo lo
stato mostrato in UI, per un eventuale invio manuale futuro) senza un
destinatario valido né verifica che il contenuto sia completo. Non viola
l'invariante 2 (nessun invio reale nell'MVP) ma mina l'affidabilità dello stato
"Approvata" come segnale operativo per un umano che dovesse poi occuparsi
dell'invio manuale.
**Soluzione consigliata**: nella route PATCH, prima di accettare
`action: "approve"`, rifiutare (`422`) se `draft.toAddresses.length === 0` o se
`draft.placeholders.length > 0` (segnale di token non risolti) — messaggio
d'errore esplicito ("Impossibile approvare: destinatario mancante" /
"...placeholder non risolti"). Lato UI, disabilitare "Approva" con lo stesso
criterio e motivo visibile, coerente con il pattern già usato per "bozza già
approvata" (409).
**Alternative**: permettere l'approvazione ma con uno stato intermedio
"Approvata con riserva"/"Incompleta" se si vuole comunque tracciare la
revisione umana separatamente dalla piena idoneità all'invio — da valutare con
l'utente; la soluzione consigliata (blocco netto) è più semplice e coerente con
l'invariante "una bozza non deve risultare validamente approvata se manca il
destinatario" già enunciato nell'osservazione originale.
**Nota sul dato esistente**: il record reale trovato (`cmrm7pjld000m...`)
andrà gestito esplicitamente in Fase B — o correggendo lo stato via migrazione
dati (es. un campo `incomplete: true` o un downgrade a un nuovo stato), o
lasciandolo come evidenza storica pre-fix con una nota in audit log. Non è
stato modificato in questa sessione di sola analisi.
**Rischi**: basso per il fix (stessa forma del controllo 409 già esistente);
richiede però una decisione esplicita su come trattare il record già presente.
**Priorità**: **alta (P0)**.

### P0 #3 — "Segna completata" senza rivalidazione server-side (nuovo finding)

**Stato: Validata — più serio di quanto l'osservazione originale ipotizzasse.**

Il brief originale (punto 3.8) chiedeva di verificare che il target non
copiasse un comportamento "più permissivo" della reference. L'evidenza raccolta
mostra che il target **stesso**, indipendentemente dalla reference, non ha
alcuna rivalidazione lato server.

**Evidenza**: `src/app/(app)/pratiche/[id]/_components/ClosurePanel.tsx`:
```tsx
const disabled = isOpenCase && blockers.length > 0;
...
<ActionButton method="PATCH" url={`/api/cases/${caseId}/status`} disabled={disabled} disabledReason={disabled ? blockers.join(" · ") : undefined} .../>
```
`ActionButton.tsx` si limita a impostare l'attributo HTML `disabled` — un
controllo **puramente client-side**. L'endpoint,
`src/app/api/cases/[id]/status/route.ts:8-9,19-31`:
```ts
const patchSchema = z.object({ status: z.enum(CASE_STATUS_VALUES) });
...
const existing = await prisma.case.findUnique({ where: { id: caseId } });
if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });
// nessun controllo su blockers/needsHumanReview/assignedToId/anomalie prima dell'update
```
valida **solo** che lo status inviato sia uno dei valori dell'enum. Nessuna
verifica di `needsHumanReview`, campi mancanti, responsabile assente, anomalie
o relazioni pendenti prima di accettare una transizione a `COMPLETED` (o
qualunque altro stato). Confermato dal test esistente,
`tests/integration/case-detail-actions.test.ts:114-124`, che verifica solo il
percorso di successo — nessun test verifica un rifiuto quando esistono
blocchi.

**Verifica dal vivo**: confermato visivamente — sulla pratica `PRT-2026-0025`
(7 dati mancanti, nessun responsabile) il bottone "Segna completata" appare
visivamente disattivato con motivo elencato ("7 dato/i mancante/i o da
verificare · Nessun responsabile assegnato"). Non è stata inviata alcuna
richiesta diretta all'endpoint per non alterare lo stato della pratica — il
codice sorgente conferma comunque, senza ambiguità, l'assenza del controllo
lato server.

**Differenza UI/backend**: il bottone disabilitato **è** l'unica barriera —
chiunque sia in grado di chiamare `PATCH /api/cases/[id]/status` direttamente
(devtools, script, futuro chiamante non-UI) può chiudere una pratica bloccata.
**Impatto reale**: alto — è esattamente la stessa classe di problema di P0 #1
(validazione solo lato client), qui applicata alla chiusura dell'intera
pratica, l'azione più "definitiva" del flusso.
**Soluzione consigliata**: centralizzare il calcolo di `blockers` (oggi
duplicato solo in `page.tsx:118-145` per il rendering) in una funzione
condivisa e importabile lato server (es. `src/lib/cases/blockers.ts`), e
richiamarla dentro `PATCH /api/cases/[id]/status` prima di accettare una
transizione verso `COMPLETED`, rispondendo `409`/`422` con l'elenco dei motivi
— stesso pattern già usato per "bozza già approvata" (409 in P0 #2).
**Alternative**: nessuna ragionevole — un controllo server-side qui è
strettamente necessario, non opzionale, data la natura definitiva dell'azione.
**Rischi**: nel centralizzare `blockers`, attenzione a non introdurre
disallineamenti tra il calcolo usato per il rendering (`page.tsx`) e quello
usato per la validazione server — vanno **derivati dalla stessa funzione
condivisa**, non reimplementati due volte.
**Priorità**: **alta (P0)**.

## 5. Interventi UX consigliati (bassa priorità, Fase C)

1. Sticky sidebar: `max-h-[calc(100vh-...)] overflow-y-auto` su
   `DetailSidebar.tsx:56`, pattern già in uso in `SplitView.tsx:10`.
2. Etichetta CTA "Vai" → verbo derivato da `blockers[0]` quando disponibile.
3. Etichette "Azioni rapide" → chiarire che sono navigazione, o farle
   aprire/focalizzare davvero il controllo (decisione di prodotto).
4. Cronologia email → `Disclosure` per singola email oltre la più recente,
   stesso pattern già usato per Attività/Commenti/Bozze precedenti.
5. `localStorage` colonne → sostituire il `catch` silenzioso con un avviso
   minimo in caso di fallimento della persistenza.
6. "Azzera filtri" → condizionarlo alla presenza di almeno un filtro attivo,
   stesso criterio già usato da `ActiveFiltersChips`.

## 6. Interventi che NON consiglio

1. **Copiare le altezze riga ~61px della reference** nell'elenco pratiche: il
   rapporto reale misurato (1.13x) è già entro soglia accettabile; comprimere
   ulteriormente rischia di sacrificare leggibilità per un guadagno marginale
   già scartato esplicitamente anche nell'osservazione originale.
2. **Rendere Importo/Responsabile/Ultima attività colonne fisse** (non
   opzionali) per uniformarsi alla reference: la personalizzazione è una
   funzionalità più avanzata del target, deliberatamente conservata in FASE 8.
3. **Comprimere ulteriormente la densità del dettaglio pratica** oltre quanto
   già fatto in FASE 8B: il residuo 1.69x è spiegato da contenuto reale (15
   campi vs 4, email reali vs preview), non da overhead di porting —
   comprimere oltre rischierebbe di nascondere dati operativi reali,
   contraddicendo il principio di veridicità già seguito nelle fasi precedenti.
4. **Introdurre un concetto di tenant/organizzazione** solo per soddisfare la
   richiesta di "isolamento tenant" citata nel brief per il modulo autovelox:
   l'intero schema attuale è a singolo tenant; introdurlo ora, per un solo
   modulo, sarebbe incoerente con il resto dell'app. Segnalato come "richiede
   una decisione di prodotto" più ampia — si veda `SPEC-AUTOVELOX-DRAFT.md`.
5. **Disabilitare via JavaScript lato client come unica difesa** per i tre P0:
   il fix corretto è lato server (già descritto sopra); un ulteriore controllo
   client-side è già presente e va mantenuto come UX, ma non è mai sufficiente
   da solo.

## 7. Verifica eseguita in questa sessione

| Verifica | Esito |
|---|---|
| `npm run typecheck` | pulito (nessun file applicativo toccato) |
| `npm run lint` | pulito |
| `npm run test` | 227/228 (invariato — unico fallimento preesistente e noto) |
| Login reale (`admin@mizeta.local`) su dev server `:3001` | riuscito |
| Ispezione DOM read-only, pratica `PRT-2026-0025` (MULTA, PEC, 15 campi/7 mancanti) | eseguita, screenshot non versionati (sessione interattiva) |
| Query SQL read-only (`SELECT` su `EmailDraft`, `CaseField`, `AuditLog`) | eseguita, conferma P0 #2 con dato reale |
| Nessuna richiesta mutante (POST/PATCH) inviata al dev server | confermato — stato del DB di sviluppo invariato rispetto a prima dell'audit, a parte le sessioni di navigazione (righe "accessi alla pratica" nel registro attività, già esistenti prima di questa sessione) |
| Nessuna modifica a `prisma/schema.prisma`, seed, codice applicativo, test | confermato — unica modifica di questa sessione: i due file Markdown (`docs/UX-AUDIT-2026-07.md`, `docs/SPEC-AUTOVELOX-DRAFT.md`) sul branch `audit/ux-e-autovelox` |

## 8. Strategia di commit e ordine di lavoro proposto

Questa sessione produce un solo commit (o due, uno per documento) sul branch
`audit/ux-e-autovelox`, senza toccare `main`. Ordine di lavoro consigliato per
le fasi successive:

1. **Fase B** (branch `fix/p0-validazioni`): i tre P0 sopra, indipendenti dal
   nuovo modulo autovelox — bug di validazione a basso rischio/alto impatto
   sull'integrità dei dati, da risolvere per primi.
2. **Fase C** (stesso branch o uno dedicato al tuning): i 6 interventi UX a
   bassa priorità elencati al punto 5.
3. **Fase D**: già prodotta in parallelo in questa sessione — si veda
   `docs/SPEC-AUTOVELOX-DRAFT.md`.
4. **Fase E**: implementazione del modulo autovelox, branch `feature/autovelox`,
   solo dopo approvazione esplicita della specifica draft.

Motivazione dell'ordine B→C: i P0 riguardano l'integrità dei dati esistenti
(campi/bozze/chiusura pratica) e sono indipendenti dal nuovo modulo; risolverli
prima evita che un futuro modulo autovelox, se riuserà il pattern "conferma" di
`CaseField` (come proposto in `SPEC-AUTOVELOX-DRAFT.md`), erediti lo stesso
difetto strutturale.
