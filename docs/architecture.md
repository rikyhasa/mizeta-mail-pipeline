# Architettura

Riferimento: `docs/SPEC.md` (specifica completa), `docs/architecture-assessment.md` (decisione
di Fase 0: webapp standalone, nessun gestionale esistente da integrare). Questo documento
descrive come il codice è organizzato oggi, non un piano futuro.

## 1. Stack

Next.js (App Router) + TypeScript strict, PostgreSQL via Prisma 7 (`@prisma/adapter-pg`),
Tailwind per lo styling, coda job su Postgres (nessun Redis/BullMQ — vedi §5), sessioni
server-side custom (nessun NextAuth — vedi `docs/security.md`), Puppeteer per la generazione
PDF, Docker Compose per Postgres in sviluppo/test.

## 2. Struttura di `src/`

```
src/app/
  (app)/                 rotte autenticate: pratiche (dashboard + dettaglio), revisione,
                         impostazioni — ognuna con una cartella _components/ colocata
  login/                 login (pre-autenticazione)
  api/
    auth/                login, logout
    cases/               CRUD azioni pratica: [id]/{status,assign,fields/[fieldKey],
                         drafts/[draftId],documents,relations,relations/[relationId]}
    attachments/         download allegato (storage locale dietro AttachmentStorage)
    health/               liveness non autenticata
    observability/       snapshot dettagliato (settings:manage) — SPEC.md §17
    settings/            mailboxes, reply-templates, rules, users, users/[id]
    webhooks/microsoft365 ricezione change notification Graph

src/components/          componenti generici riusati tra pagine (ActionButton, InlineSelect)

src/lib/
  adapters/
    mail/                MailProviderAdapter: mock, microsoft365, pec_imap (scheletro)
    llm/                 LLMProvider: mock (euristico), anthropic, openai (scheletro)
    documents/            GeneratedDocumentService: puppeteer + template HTML
    erp/                  ERPAdapter: solo interfaccia, non implementato (docs/erp-integration.md)
  auth/                  sessioni, password, RBAC, guard, wrapper route
  config/env.ts          parsing/validazione delle variabili d'ambiente
  dashboard/             query per le 3 fasce della dashboard (SPEC.md §9)
  db/prisma.ts           client Prisma condiviso
  i18n/                  etichette italiane, icone per categoria, etichette campo
  jobs/                  coda job su Postgres: queue, worker, tipi (SPEC.md §3/§17)
  mail/ingest-mailbox.ts orchestratore di ingestione condiviso da tutti i provider
  matching/              motore di associazione email → pratica (SPEC.md §7), 8 livelli
  observability/         logger strutturato + metriche (SPEC.md §17)
  pipeline/              orchestrazione classify → extract → rules → actions/draft, audit
  rules/                 motore di regole deterministico (SPEC.md §8)
  storage/               AttachmentStorage (driver locale; S3 non implementato)
  text/patterns.ts       euristiche di parsing testo (es. importi vicino a un'ancora)
```

## 3. Ciclo di vita di un'email in ingresso

1. **Sync**: un job `INGEST_MAILBOX_CHANGES` (per provider diverso da `mock`, innescato da
   webhook Graph o da sincronizzazione manuale) chiama `listChanges` sull'adapter e, per ogni
   messaggio nuovo/aggiornato, chiama `src/lib/mail/ingest-mailbox.ts`, che deduplica per
   `(mailboxConnectionId, providerMessageId)`, salva `EmailMessage`/`EmailThread`/`Attachment`,
   scrive `AuditLog(EMAIL_SYNCED)` e mette in coda un job `PROCESS_INCOMING_MESSAGE`.
2. **Pipeline AI** (`src/lib/pipeline/process-incoming-message.ts`, dettagliata in
   `docs/ai-pipeline.md`): classificazione → associazione a una pratica esistente o creazione di
   una nuova (`src/lib/matching`) → estrazione campi (se la categoria lo prevede) → motore di
   regole deterministico (priorità, `needsHumanReview`) → persistenza (`persist-classification`,
   `persist-extraction`, `persist-actions`) con audit log per ogni passaggio ed errore.
3. **Dashboard/dettaglio**: le pagine in `src/app/(app)/pratiche` leggono lo stato persistito
   (mai chiamano l'LLM in modo sincrono da una richiesta utente); ogni azione umana (conferma
   campo, cambio stato, generazione documento/bozza, collegamento pratiche) passa da una route
   `api/cases/[id]/...` protetta da `withPermission` e scrive un `AuditLog`.
4. **Bozze e documenti**: generati su richiesta esplicita dell'utente, mai automaticamente;
   restano in stato `PENDING_APPROVAL` finché un utente non approva (invariante 3 di
   `CLAUDE.md`).

## 4. Autenticazione e permessi

Sessioni server-side custom (`src/lib/auth/session.ts`): token casuale in un cookie
`httpOnly`, hash SHA-256 salvato in `Session`; nessuna libreria di terze parti. RBAC a 4
permessi grezzi (`case:read`, `case:write`, `user:manage`, `settings:manage`) mappati dai 5
ruoli di dominio in `src/lib/auth/rbac.ts`. Ogni route API passa da `withPermission()`
(`src/lib/auth/route-helpers.ts`), tranne login/logout/health/webhook Graph (autenticazione non
applicabile o sostituita da `clientState`). Dettagli in `docs/security.md`.

## 5. Job queue

Coda su Postgres (tabelle `Job`/`JobAttempt`), non Redis/BullMQ: scelta esplicita per non
introdurre un'infrastruttura aggiuntiva nell'MVP (CLAUDE.md permette "BullMQ o simile").
`enqueueJob()` deduplica per `idempotencyKey`; `src/lib/jobs/worker.ts` (processo separato,
`npm run jobs:worker`) esegue i job con retry ed exponential backoff fino a `JOB_MAX_ATTEMPTS`,
poi `DEAD_LETTER`. Tre tipi di job: `INGEST_MAILBOX_CHANGES`, `PROCESS_INCOMING_MESSAGE`,
`RENEW_SUBSCRIPTION`.

## 6. Cosa NON fa questa architettura (per scelta, MVP)

Nessun invio email, pagamento, scrittura nel gestionale, apertura di URL o esecuzione di
allegati/macro (invarianti 1-2 di `CLAUDE.md`). Nessuna integrazione S3 reale (storage locale
dietro `AttachmentStorage`). Nessun APM/error-tracking esterno: solo logging strutturato su
stdout/stderr (`src/lib/observability/logger.ts`).
