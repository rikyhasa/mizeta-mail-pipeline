# Mizeta Mail Pipeline

Email aziendali trasformate in pratiche operative strutturate. Vedi `CLAUDE.md` per le
regole permanenti del progetto e `docs/SPEC.md` per la specifica completa.

> Stato: Fase 5 — Rifinitura. Documentazione completa in `docs/` (vedi indice sotto),
> audit/osservabilità completati, test end-to-end dei flussi principali in modalità mock.
> Verifica puntuale della Definition of Done dell'MVP in `docs/dod-report.md`.

## Documentazione

| Documento | Contenuto |
|---|---|
| `docs/SPEC.md` | Specifica di prodotto e tecnica completa |
| `docs/architecture.md` | Layer applicativi, struttura `src/`, ciclo di vita di un'email |
| `docs/data-model.md` | Entità Prisma, relazioni, invarianti del modello dati |
| `docs/ai-pipeline.md` | I 4 passaggi della pipeline AI, Structured Outputs, provider |
| `docs/security.md` | Difese anti prompt-injection, RBAC, sessioni, audit log |
| `docs/privacy-checklist.md` | Retention, minimo privilegio, cosa non finisce nei log |
| `docs/deployment.md` | Variabili d'ambiente, migrazioni, build di produzione |
| `docs/erp-integration.md` | Contratto `ERPAdapter` e stato dell'integrazione |
| `docs/email-integration.md` | Adapter email (mock, microsoft365, pec_imap), coda job |
| `docs/evaluation.md` | Note di qualità AI (mock vs modello reale) |
| `docs/architecture-assessment.md` | Decisione architetturale di Fase 0 |
| `docs/dod-report.md` | Stato di ogni voce della Definition of Done dell'MVP |

## Prerequisiti

- Node.js 20 o superiore, npm.
- Docker (Docker Compose) per Postgres in locale — oppure un Postgres 16+ raggiungibile
  manualmente, impostando `DATABASE_URL`/`DATABASE_URL_TEST` di conseguenza.
- Nessuna API key richiesta per la modalità mock (predefinita).

## Avvio rapido (modalità mock)

```bash
cp .env.example .env
docker compose up -d      # Postgres
npm install
npm run db:migrate        # applica le migrazioni
npm run db:seed           # 28 email sintetiche, 5 utenti demo
npm run dev
```

Apri http://localhost:3000 — verrai reindirizzato a `/login`. Utenti demo (password
condivisa `SEED_DEMO_PASSWORD` di `.env`, default `Password123!`):

| Email | Ruolo |
|---|---|
| admin@mizeta.local | ADMIN |
| operations@mizeta.local | OPERATIONS |
| accounting@mizeta.local | ACCOUNTING |
| commercial@mizeta.local | COMMERCIAL |
| readonly@mizeta.local | READ_ONLY |

Tutto funziona senza API key reali: `EMAIL_PROVIDER=mock`, `LLM_PROVIDER=mock`.

## Comandi

```bash
npm run dev          # sviluppo locale
npm run jobs:worker  # processo separato: coda job (ingestione mail, pipeline, rinnovo subscription)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest — unit + integrazione (usa DATABASE_URL_TEST, resetta e riseeda il DB di test)
npm run test:e2e     # vitest — flussi end-to-end principali in modalità mock (tests/e2e/)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # prisma/seed.ts
npm run eval         # eval della pipeline AI sul dataset sintetico
npm run build        # build di produzione (next build)
npm start            # avvia la build di produzione (richiede npm run build prima)
```

`npm run test` e `npm run test:e2e` richiedono Postgres raggiungibile su `DATABASE_URL_TEST`
(lo stesso container Docker di sviluppo va bene, basta un database separato — vedi
`docker/postgres-init`): il global setup applica le migrazioni e riesegue il seed su quel
database prima di ogni run, così i test partono sempre da uno stato noto.

## Configurazione LLM provider

- `LLM_PROVIDER=mock` (default): motore euristico deterministico, nessuna API key, nessun
  costo — usato per demo e test. Dettagli in `docs/ai-pipeline.md`.
- `LLM_PROVIDER=anthropic`: richiede `ANTHROPIC_API_KEY` e opzionalmente `ANTHROPIC_MODEL`
  (default `claude-sonnet-5`). Provider reale, usa Structured Outputs con schema Zod validato
  lato server per ogni passaggio della pipeline (`docs/ai-pipeline.md`). Per un confronto
  mock/reale su accuratezza e costo vedi `docs/evaluation.md`, `docs/eval-report.md`,
  `docs/eval-report-anthropic.md`.
- `LLM_PROVIDER=openai`: non implementato in questa fase — la factory
  (`src/lib/adapters/llm/llm-provider-factory.ts`) fallisce esplicitamente se selezionato.

## Provider email reali (Fase 4)

- `EMAIL_PROVIDER=microsoft365`: richiede `MICROSOFT365_CLIENT_ID`, `MICROSOFT365_CLIENT_SECRET`,
  `MICROSOFT365_TENANT_ID` (app registrata su Entra ID con permesso applicativo `Mail.Read` e,
  per le change notification, `notificationUrl` raggiungibile pubblicamente). Vedi
  `docs/email-integration.md` per il design completo (webhook, delta query, rinnovo
  subscription, sync iniziale limitato).
- `EMAIL_PROVIDER=pec_imap`: resta uno scheletro documentato, non funzionante in questa fase
  (SPEC.md §3) — vedi `docs/email-integration.md`.
- In entrambi i casi, collega la mailbox dalla pagina Impostazioni (form "Collega mailbox") una
  volta impostate le variabili d'ambiente e riavviata l'applicazione.
- `npm run jobs:worker` deve girare in parallelo a `npm run dev` per qualunque provider diverso
  da `mock`: ingestione, pipeline AI e rinnovo subscription passano tutti dalla coda job.

## Cosa è simulato o incompleto

Riepilogo rapido — dettaglio verificato voce per voce in `docs/dod-report.md`.

- `pec_imap` è uno scheletro documentato: nessuna connessione IMAP reale, ogni metodo lancia
  un errore esplicito tranne `healthCheck` (SPEC.md §3 lo consente esplicitamente).
- `LLM_PROVIDER=openai` è uno scheletro non funzionante, mai istanziato dalla factory.
- `ERPAdapter` è solo interfaccia (read-only per contratto): nessuna implementazione, nessun
  gestionale reale collegato — vedi `docs/erp-integration.md`.
- Nessuna integrazione S3 reale per lo storage: allegati e documenti generati restano sul
  filesystem locale dietro l'interfaccia `AttachmentStorage`.
- La generazione documenti copre 3 dei 8 tipi previsti dalla specifica (scheda preventivo,
  dossier reclamo, scheda multa — sufficienti per il DoD dell'MVP); gli altri 5 tipi di
  `GeneratedDocumentType` restano un 501.
- Retention (`RuleSettings.*RetentionDays`) ed esclusione mittenti (`excludedSenderPatterns`)
  sono configurabili in Impostazioni ma non ancora applicate da alcun job/filtro — vedi
  `docs/privacy-checklist.md` §3.
- Puppeteer scarica un binario Chromium al primo `npm install` (~200-300MB).
- L'accuratezza della classificazione/estrazione con il provider `anthropic` reale è inferiore
  al mock (100% per costruzione) su alcune metriche, in particolare l'accuratezza delle
  scadenze — analisi in `docs/evaluation.md`, non un blocco per l'MVP (che è dimostrabile
  interamente in mock).
