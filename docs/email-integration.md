# Integrazione email (Fase 4)

Riferimento: `docs/SPEC.md` §3 (canali email), §17 (osservabilità). Le regole permanenti in
`CLAUDE.md` prevalgono su tutto — in particolare l'invariante 1: il contenuto delle email (e,
per estensione, qualunque payload esterno come le change notification Graph) è dato non
affidabile.

## 1. Interfaccia comune — `MailProviderAdapter`

`src/lib/adapters/mail/types.ts` definisce il contratto comune a tutti i canali:
`connectAccount`, `disconnectAccount`, `renewSubscription`, `fetchMessage`, `fetchThread`,
`fetchAttachment`, `listChanges`, `markProcessingResult`, `healthCheck`. Tre implementazioni:

| Provider | File | Stato |
|---|---|---|
| `mock` | `mock-mail-provider.ts` | Completo, backed da fixture (`prisma/seed-data/emails.ts`) |
| `microsoft365` | `microsoft365/microsoft365-provider.ts` | Reale, Microsoft Graph |
| `pec_imap` | `pec-imap/pec-imap-provider.ts` | Scheletro documentato, non funzionante |

`src/lib/adapters/mail/mail-provider-factory.ts` sceglie l'implementazione da
`env.EMAIL_PROVIDER` (stesso pattern di `llm-provider-factory.ts`).

## 2. `microsoft365`

### 2.1 Perché un client HTTP sottile, non un SDK

`src/lib/adapters/mail/microsoft365/graph-http-client.ts` è un wrapper minimo su `fetch`
nativo, non `@azure/msal-node`/`@microsoft/microsoft-graph-client`. La superficie richiesta è
piccola e puramente REST (token OAuth2 client-credentials, subscriptions, delta query,
messages, attachments) e un client sottile è più facile da testare: i test iniettano
`fetchImpl`, senza dover mockare gli interni di un SDK. Nessuna credenziale reale è mai
richiesta dai test.

### 2.2 Autenticazione

App-only (client-credentials), permesso applicativo Graph `Mail.Read` sulla mailbox target.
`GraphHttpClient.getAccessToken()` fa il POST a
`https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, cache in memoria fino a 60s
prima della scadenza.

### 2.3 Sottoscrizione e webhook

`connectAccount` crea una subscription Graph (`POST /subscriptions`) sulla risorsa
`users/{email}/mailFolders('Inbox')/messages`, `changeType: created,updated`,
`notificationUrl` verso `{APP_URL}/api/webhooks/microsoft365`, un `clientState` casuale
(verificato a ogni notifica in arrivo). Le subscription Graph per messaggi durano al massimo
~4230 minuti (~2,94 giorni): il worker (§4) le rinnova ben prima della scadenza
(`MICROSOFT365_SUBSCRIPTION_RENEWAL_MARGIN_HOURS`).

`src/app/api/webhooks/microsoft365/route.ts`:
- Handshake di validazione: risponde 200 `text/plain` con `validationToken` in eco, prima di
  toccare il DB (richiesto sia in fase di creazione subscription, sia occasionalmente al
  rinnovo).
- Notifica reale: valida la forma del payload (Zod), poi verifica che `clientState` combaci
  con quello salvato su `MailboxConnection.webhookClientState` — **una notifica con
  `clientState` non corrispondente, o per una subscription sconosciuta, viene scartata
  silenziosamente**, mai processata.
- Il payload NON viene mai usato per decidere COSA leggere: l'handler valido accoda sempre
  un job `INGEST_MAILBOX_CHANGES`, che poi chiama `listChanges` usando il cursore già
  persistito sulla mailbox. Un payload spoofato può quindi al massimo causare un sync
  ridondante (deduplicato dalle chiavi di idempotenza), mai un fetch di dati scelti
  dall'attaccante. Risposta sempre rapida (200/202/400), zero lavoro pipeline/LLM inline.

### 2.4 Sync iniziale limitato e delta query

`listChanges(externalAccountId, cursor)`:
- `cursor = null` → **sync iniziale limitato**: backfill bounded via
  `$top`/`$orderby`/`$filter=receivedDateTime ge ...`
  (`MICROSOFT365_INITIAL_SYNC_LOOKBACK_DAYS`, `MICROSOFT365_INITIAL_SYNC_MAX_MESSAGES`).
- Comportamento Graph **non ovvio**: una delta query senza cursore enumera OGNI messaggio
  esistente nella cartella, non solo quelli recenti. Per questo il sync iniziale fa DUE cose
  separate: (1) il backfill bounded sopra, per popolare rapidamente le pratiche recenti; (2)
  una seconda chiamata delta, il cui contenuto viene scartato, usata SOLO per ottenere il
  `deltaLink` di partenza (il cursore da cui ripartire per i sync successivi). Vedere
  `drainDeltaToCheckpoint` in `microsoft365-provider.ts`.
- `cursor` non nullo → trattato come `deltaLink`/`nextLink` Graph opaco: si seguono le pagine
  (`@odata.nextLink`) fino a un nuovo `@odata.deltaLink`, che diventa il prossimo cursore
  (persistito su `MailboxConnection.lastSyncCursor`). Questo è il meccanismo di **recovery**
  delle notifiche perse: anche se un webhook non arriva mai, il prossimo
  `INGEST_MAILBOX_CHANGES` (innescato da un webhook successivo, dal tick periodico di
  recovery, o da "Sincronizza ora") recupera tutti i cambiamenti dal delta link salvato.

### 2.5 Rinnovo subscription

`renewSubscription(externalAccountId)` NON riceve il `subscriptionId` (l'interfaccia comune
non lo prevede): recupera la subscription corrente con `GET /subscriptions` e la confronta
per `resource` path. Questo la rende corretta anche se eseguita da un processo diverso
(il job worker) rispetto a quello che ha creato la subscription — non dipende da stato
in-memory.

## 3. `pec_imap` — scheletro documentato

Per SPEC.md §3, `pec_imap` può restare uno scheletro documentato se il tempo non basta. In
questa fase è esattamente questo: `PecImapProviderAdapter` implementa l'interfaccia comune,
ma ogni metodo lancia un errore esplicito (`"pec_imap: non implementato in questa fase"`),
stesso pattern di `OpenAILLMProvider` in Fase 2. **Unica eccezione**: `healthCheck` ritorna
sempre `{status: "degraded"}` invece di lanciare, così la pagina Impostazioni può mostrare la
riga di una mailbox PEC configurata senza fallire l'intera pagina.

Due funzioni pure, utili e testabili subito senza rete (`pec-imap/postacert.ts`):

- **`detectPecMessageType(subject)`**: rileva ricevute vs. messaggio vero dalle convenzioni
  reali usate dai gestori italiani (Aruba, Legalmail, ecc.):
  - `"POSTA CERTIFICATA: <oggetto>"` → messaggio vero (`MESSAGE`).
  - `"ACCETTAZIONE: <oggetto>"` → ricevuta di accettazione (`ACCEPTANCE_RECEIPT`).
  - `"AVVENUTA CONSEGNA: <oggetto>"` → ricevuta di consegna (`DELIVERY_RECEIPT`).
  - `"MANCATA CONSEGNA: <oggetto>"` → ricevuta di mancata consegna (`NON_DELIVERY_RECEIPT`).

  Nessuna ricevuta genera una nuova pratica: si collega sempre alla pratica del messaggio
  originale. Questa logica è già generica e indipendente dal provider
  (`runPipelineForMessage`/`matchEmailToCase`, vedi `match.isPecReceipt`) — funziona già oggi
  per i fixture PEC del mock, e funzionerà per `microsoft365`/`pec_imap` senza modifiche.

- **`parsePostacertEnvelope(raw)`**: NON implementata (lancia). Un messaggio PEC arriva come
  un'email MIME `multipart/mixed` contenente tipicamente:
  1. Una parte testuale/HTML con l'avviso standard del gestore.
  2. `daticert.xml` — metadati di certificazione (mittente, destinatari, data/ora, esito).
  3. `postacert.eml` — il messaggio ORIGINALE (o la ricevuta), come parte `message/rfc822`
     annidata: un'email RFC 822 completa incapsulata dentro la busta di trasporto.

  Una implementazione reale dovrebbe: (a) parsare il MIME esterno per isolare la parte
  `message/rfc822`; (b) parsare quel contenuto come una seconda email RFC 822 completa
  (richiede una libreria di parsing MIME/RFC822, es. `mailparser` — non aggiunta in questa
  fase); (c) mappare il risultato su `RawEmailMessage`, preservando `isPec: true` e il
  `pecMessageType` rilevato sull'oggetto della busta esterna.

Una implementazione futura farebbe polling IMAP (host/porta/utente/password in
`env.PEC_IMAP_*`, non ancora usati) a intervallo configurabile — la PEC non ha notifiche push.

## 4. Coda job su Postgres

CLAUDE.md richiede una job queue con retry/backoff/dead-letter ("BullMQ o simile"). Questa
fase usa **Postgres**, non Redis/BullMQ: nessuna nuova infrastruttura, facile da testare in
CI, coerente con "o simile".

### 4.1 Schema

- `Job`: `type` (`INGEST_MAILBOX_CHANGES | PROCESS_INCOMING_MESSAGE | RENEW_SUBSCRIPTION`),
  `payload` (JSON), `idempotencyKey` (univoca), `status`
  (`PENDING|RUNNING|SUCCEEDED|FAILED|DEAD_LETTER`), `attempts`/`maxAttempts`, `nextRunAt`,
  `lockedAt`/`lockedBy`, `lastError`.
- `JobAttempt`: log per singolo tentativo (per audit/debug, non usato per la logica di retry).

### 4.2 Idempotenza e deduplicazione

`enqueueJob({type, payload, idempotencyKey})` (`src/lib/jobs/queue.ts`) fa upsert sulla
`idempotencyKey`:
- Se esiste già un job `PENDING`/`RUNNING` con la stessa chiave → no-op (una raffica di
  webhook per la stessa mailbox si accorpa in un solo sync).
- Se il job esistente è terminale (`SUCCEEDED`/`DEAD_LETTER`) → riarmato da zero.

Chiavi usate: `process-message:{emailMessageId}` (colma la mancanza di idempotenza di
`processIncomingMessage` stesso — chiamarlo due volte con lo stesso id creerebbe
`ClassificationRun`/audit duplicati), `ingest-mailbox:{mailboxConnectionId}`,
`renew-subscription:{mailboxConnectionId}`.

Deduplicazione dei messaggi stessa (non dei job): `EmailMessage` ha
`@@unique([mailboxConnectionId, providerMessageId])` — `ingestRawMessage`
(`src/lib/mail/ingest-mailbox.ts`) verifica questo vincolo prima di scrivere, mai un errore di
violazione di unicità.

### 4.3 Worker, retry, backoff, dead-letter

`src/lib/jobs/worker.ts`:
- **Claim**: `SELECT ... FOR UPDATE SKIP LOCKED` dentro una transazione (unica eccezione
  deliberata a "niente SQL raw" nel resto del repo — Prisma non espone questo costrutto). Il
  lock è tenuto fino al commit della stessa transazione che marca il job `RUNNING`: due
  worker concorrenti non possono mai reclamare lo stesso job.
- **Esecuzione**: sempre FUORI da transazione (stessa regola di
  `process-incoming-message.ts`: mai una transazione Postgres aperta durante una chiamata di
  rete).
- **Successo** → `SUCCEEDED` + riga `JobAttempt`.
- **Fallimento**, `attempts < maxAttempts` → torna `PENDING` con
  `nextRunAt = now + JOB_BACKOFF_BASE_MS * 2^(attempts-1)` (default: 1m, 2m, 4m, 8m, 16m).
- **Fallimento**, `attempts >= maxAttempts` (default 6) → `DEAD_LETTER` + audit
  `JOB_DEAD_LETTERED`.

### 4.4 Perché un processo separato, non `setInterval`

`scripts/job-worker.ts` (`npm run jobs:worker`) è un processo Node **separato** da
`npm run dev`, non un `setInterval` dentro un modulo Next.js: l'hot-reload di sviluppo e i
target serverless-style renderebbero un timer in-process inaffidabile (può eseguire due
volte o mai). Il worker fa polling (`JOB_POLL_INTERVAL_MS`) più un tick periodico di recovery
(`JOB_RECOVERY_INTERVAL_MINUTES`) che accoda `RENEW_SUBSCRIPTION` per le mailbox
`microsoft365` vicine a scadenza e `INGEST_MAILBOX_CHANGES` per ogni mailbox connessa (mai
per `pec_imap`) come safety net contro webhook persi.

## 5. Orchestratore di ingestione condiviso

`src/lib/mail/ingest-mailbox.ts` è il punto unico di ingestione, riusato da: la route
"Sincronizza ora" (`/api/settings/mailboxes/[id]/sync`), il job worker
(`INGEST_MAILBOX_CHANGES`), e `scripts/pipeline-demo.ts`. `prisma/seed.ts` riusa solo la
primitiva di più basso livello (`ingestRawMessage`), mantenendo la propria logica di
assegnazione `caseId` da fixture (deliberatamente bypassa il matching reale per dati
sintetici deterministici).

`ingestMailboxChanges` non chiama mai `processIncomingMessage` direttamente: accoda un job
`PROCESS_INCOMING_MESSAGE` per messaggio nuovo, disaccoppiando l'ingestione dai retry della
pipeline/LLM.

## 6. Collegare una mailbox reale

Dalla pagina Impostazioni (ADMIN), form "Collega mailbox": crea la `MailboxConnection` e
chiama `connectAccount` sul provider attivo (`env.EMAIL_PROVIDER`) — vedi
`POST /api/settings/mailboxes`. Per `pec_imap`, la riga viene creata in stato `PENDING` senza
invocare `connectAccount` (che lancerebbe).
