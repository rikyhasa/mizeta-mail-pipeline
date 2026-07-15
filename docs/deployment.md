# Deployment

Riferimento: `README.md` (avvio rapido in mock), `docs/email-integration.md` (provider reali),
`.env.example` (elenco completo variabili). Questo documento copre build di produzione e
variabili d'ambiente; per l'avvio rapido in sviluppo vedi il README.

## 1. Docker Compose (Postgres)

`docker-compose.yml` avvia solo Postgres (`docker compose up -d`); l'applicazione Next.js e il
worker dei job non sono containerizzati in questa fase — girano con Node direttamente
(`npm run dev`/`npm run build && npm start`, `npm run jobs:worker`). Per un deployment reale,
containerizzare l'app è lasciato come estensione: nessun Dockerfile applicativo esiste ancora
nel repository.

## 2. Variabili d'ambiente

Vedi `.env.example` per l'elenco completo con i default. Gruppi principali:

| Gruppo | Variabili | Note |
|---|---|---|
| App/sessioni | `NODE_ENV`, `APP_URL`, `SESSION_COOKIE_NAME`, `SESSION_TTL_HOURS` | |
| Database | `DATABASE_URL`, `DATABASE_URL_TEST` | Due database Postgres distinti: applicazione e test (`npm run test` resetta e riseeda solo il secondo) |
| Email | `EMAIL_PROVIDER` (`mock`\|`microsoft365`\|`pec_imap`), `MICROSOFT365_*`, `PEC_IMAP_*` | `pec_imap` resta scheletro, variabili documentate ma non usate |
| LLM | `LLM_PROVIDER` (`mock`\|`anthropic`\|`openai`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OPENAI_API_KEY` | `openai` non implementato, la factory fallisce esplicitamente se selezionato |
| Coda job | `JOB_POLL_INTERVAL_MS`, `JOB_MAX_ATTEMPTS`, `JOB_BACKOFF_BASE_MS`, `JOB_RECOVERY_INTERVAL_MINUTES` | |
| Storage | `ATTACHMENT_STORAGE_DRIVER=local`, `ATTACHMENT_STORAGE_LOCAL_DIR`, `S3_*` | Solo il driver `local` è implementato; le variabili `S3_*` sono documentate per un'estensione futura, non lette da alcun codice |
| Demo | `SEED_DEMO_PASSWORD` | Solo per `npm run db:seed` locale — mai in produzione |

Validazione/parsing centralizzati in `src/lib/config/env.ts` — l'app non parte con variabili
mancanti o malformate per i provider effettivamente selezionati.

## 3. Migrazioni

```bash
npm run db:migrate    # prisma migrate dev — sviluppo, crea/applica nuove migrazioni
npx prisma migrate deploy   # produzione — applica le migrazioni esistenti senza generarne di nuove
```

Le migrazioni sono in `prisma/migrations/`, ordinate cronologicamente per fase (fondamenta →
pipeline AI → bozze/impostazioni → job/subscription). Nessuna tabella legacy di un gestionale
esterno viene mai toccata (invariante 8 di `CLAUDE.md`) — non ne esiste una in questo progetto
(`docs/architecture-assessment.md`).

## 4. Build di produzione

```bash
npm run build   # next build — build ottimizzata
npm start       # next start — serve la build di produzione (richiede npm run build prima)
```

In produzione servono comunque, come processi separati: Postgres raggiungibile da
`DATABASE_URL`, e — se `EMAIL_PROVIDER` è diverso da `mock` — `npm run jobs:worker` in
esecuzione continua (ingestione, pipeline AI e rinnovo subscription passano tutti dalla coda
job, non da richieste HTTP sincrone).

## 5. Limiti noti per un vero deployment (non solo demo mock)

- `pec_imap` è uno scheletro: nessuna connessione IMAP reale.
- `LLM_PROVIDER=openai` non è implementato.
- Storage allegati/documenti solo su filesystem locale (`ATTACHMENT_STORAGE_LOCAL_DIR`):
  in un deployment multi-istanza serve un driver condiviso (S3 o equivalente), non ancora
  scritto.
- Nessun job di retention/cancellazione (vedi `docs/privacy-checklist.md` §3) — i dati non
  vengono mai eliminati automaticamente anche se `RuleSettings` lo permetterebbe di configurare.
- Nessun container applicativo/orchestrazione (Kubernetes, ecc.): il deployment attuale assume
  un singolo host Node + Postgres raggiungibile.
- Puppeteer scarica un binario Chromium al primo `npm install` (~200-300MB) — da tenere in
  conto per immagini di build con vincoli di dimensione.
