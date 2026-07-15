# Architecture assessment (Fase 0)

## Decisione

Alla creazione del progetto la cartella di lavoro era vuota (nessun repository del
gestionale esistente). Per la regola decisionale della sezione 2 di `docs/SPEC.md`:

> Se non esiste alcun repository del gestionale, salta l'assessment e procedi come
> webapp standalone: documenta la decisione.

**Decisione: webapp standalone.** Nessun modulo da integrare in un gestionale esistente;
il prodotto è un'applicazione Next.js autonoma con il proprio database PostgreSQL.

## Stack effettivo

Lo stack implementato segue quanto richiesto da `CLAUDE.md`, con alcune precisazioni
dovute a versioni molto recenti dei pacchetti (Next.js 16, Prisma 7) che introducono
convenzioni diverse da quelle "storiche":

- **Next.js 16** (App Router, TypeScript strict, Turbopack). Il file di intercettazione
  richieste si chiama `src/proxy.ts` (rinominato da `middleware.ts` a partire da
  Next.js 16 — la funzionalità è identica).
- **Prisma 7** con **driver adapter esplicito** (`@prisma/adapter-pg` + `pg`): la
  connessione al database non è più dichiarata come `url` nel blocco `datasource` dello
  schema, ma passata a `new PrismaClient({ adapter })` in `src/lib/db/prisma.ts`. La
  configurazione CLI (migrazioni, seed) vive in `prisma.config.ts`.
- **PostgreSQL** via `docker-compose.yml` (servizio singolo, healthcheck, database di
  test creato da uno script di init).
- **Tailwind CSS 4**, componenti accessibili nativi (form HTML semantici, niente
  dipendenze UI aggiuntive in questa fase).
- **Sessioni server-side custom**: tabella `Session` + cookie httpOnly opaco (SHA-256
  dell'hash del token), non una libreria di terze parti — coerente con il requisito di
  "sessioni server-side" di `CLAUDE.md` §14 senza introdurre un flusso OAuth non
  necessario per l'MVP (nessuna registrazione pubblica, utenti creati da seed/ADMIN).
- **bcryptjs** per l'hashing password (nessuna dipendenza nativa da compilare).
- **Vitest** + **tsx** per test e script standalone (seed).

## Astrazioni obbligatorie

Tutte presenti in `src/lib/adapters/`:

- `MailProviderAdapter` (`src/lib/adapters/mail/types.ts`) — implementazione mock
  completa in `mock-mail-provider.ts`, che legge da `prisma/seed-data/emails.ts`.
- `LLMProvider` (`src/lib/adapters/llm/types.ts`) — implementazione mock inerte in
  `mock-llm-provider.ts`; lo schema Zod `ClassificationResult` (`schemas.ts`) rispecchia
  già la struttura minima di `docs/SPEC.md` §6, pronto per la Fase 2.
- `ERPAdapter` (`src/lib/adapters/erp/types.ts`) — solo interfaccia, sola lettura, come
  richiesto da `CLAUDE.md` invariante 8. Nessuna implementazione in questa fase.
- `GeneratedDocumentService` (`src/lib/adapters/documents/types.ts`) — solo interfaccia.

## Ambiente di sviluppo di questa sessione

Questa sessione di sviluppo non disponeva di Docker installato in locale. Per verificare
concretamente migrazioni, seed, test e flusso applicativo end-to-end è stato usato
`npx prisma dev` (server Postgres locale gestito da Prisma) al posto di
`docker compose up -d`. Il file `docker-compose.yml` resta comunque il percorso
supportato e documentato per chiunque abbia Docker disponibile — non è stato modificato
per adattarsi a questa scelta locale. Chi clona il repository con Docker installato può
seguire il README senza differenze.

## Assunzioni

- **Single tenant**: nessuna entità `Company`; un solo tenant (Mizeta S.r.l.).
  "Appartenenza aziendale" (§14) si riduce a "utente attivo nel database".
- **Enum fissi** per `CaseCategory`, `CaseStatus`, `CasePriority`, `Role` (non tabelle di
  lookup): rispecchiano l'elenco valori fisso della spec. La pagina Impostazioni (Fase 3)
  potrà aggiungere una tabella `CategorySetting` per abilitare/disabilitare categorie
  senza toccare l'enum.
- **Storage allegati su filesystem locale** (`./storage`, in `.gitignore`) dietro
  un'interfaccia `AttachmentStorage` sostituibile con un'implementazione S3 in una fase
  successiva.

## Rischi

- Le versioni Next.js 16 / Prisma 7 sono molto recenti: la documentazione pubblica e i
  modelli di riferimento più diffusi assumono ancora le convenzioni precedenti
  (`middleware.ts`, `datasource.url` in `schema.prisma`). Sono stati consultati i file
  `node_modules/next/dist/docs/**` per verificare le convenzioni correnti prima di
  scrivere codice.
- Il matching email→pratica di questa fase è deliberatamente naive (guidato dai
  `seedHint` dei dati sintetici, non da una vera euristica): la Fase 2 lo sostituisce con
  il motore di associazione descritto in `docs/SPEC.md` §7.

## Piano di implementazione Fase 1-5

Segue l'elenco fasi di `docs/SPEC.md` §21 / `PROMPTS-FASI.md`, senza deviazioni:
Fase 1 Fondamenta (questa fase) → Fase 2 Pipeline AI → Fase 3 Dashboard e pratiche →
Fase 4 Email reale e documenti → Fase 5 Rifinitura e chiusura.
