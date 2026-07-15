# Privacy checklist

Riferimento: `docs/SPEC.md` §14 (permessi/privacy), §17 (osservabilità — mai il corpo email nei
log). Elenco verificabile di cosa è già in vigore e cosa resta da collegare.

## 1. Dati sintetici

Nessuna credenziale reale nel codice o nel repository (invariante 5 di `CLAUDE.md`). Il seed
(`prisma/seed-data/emails.ts`, `prisma/seed.ts`) usa 28 email interamente sintetiche, utenti
demo con password condivisa configurabile via `SEED_DEMO_PASSWORD` (marcata
"local/demo only, never use in production" in `.env.example`). Nessun dato di un cliente o
fornitore reale è mai stato usato per popolare l'ambiente di sviluppo/demo.

## 2. Minimo privilegio

5 ruoli, RBAC applicato su ogni route (`docs/security.md` §6). `READ_ONLY` non può mai scrivere.
Nessuna registrazione pubblica: utenti creati/invitati solo da un ADMIN. Sessioni server-side
con scadenza configurabile (`SESSION_TTL_HOURS`) e revocabili (`Session.revokedAt`).

## 3. Retention — configurabile ma non ancora applicata

`RuleSettings` ha `emailRetentionDays`, `attachmentRetentionDays`, `auditLogRetentionDays` e
`excludedSenderPatterns`, tutti modificabili dalla pagina Impostazioni
(`RuleSettingsForm.tsx`, SPEC.md §16). **Stato reale, verificato nel codice**: questi campi sono
persistiti e mostrati in UI, ma **nessun job di pulizia** legge `*RetentionDays` per cancellare o
anonimizzare dati scaduti, e **nessun filtro di ingestione** (`src/lib/mail/ingest-mailbox.ts`)
applica `excludedSenderPatterns` per escludere mittenti/cartelle durante la sincronizzazione. È
un gap esplicito, non una funzionalità nascosta altrove — va colmato prima di un uso in
produzione con dati reali. Vedi anche `docs/dod-report.md`.

## 4. Cosa non finisce mai nei log

`src/lib/observability/logger.ts` blocca (fuori produzione: lancia; in produzione: omette in
silenzio) `bodyText`, `bodyHtml`, `content`, `password`, `passwordHash`, `secret`, `token`,
`clientState`, `accessToken`, `clientSecret` come chiavi di log strutturato. Lo stesso principio
vale per `AuditLog.metadata`: mai corpo email o segreti (verificato nei call site di
`docs/security.md` §4 — i metadata registrati sono sempre valori strutturati come
`{ from, to }` per un cambio stato, non testo libero proveniente dall'email).

## 5. Non salvare più del necessario

Gli allegati non vengono mai eseguiti né analizzati oltre l'estrazione testo richiesta dalla
pipeline; quelli non leggibili sono marcati `isReadable: false` e il loro contenuto non viene
mai passato al modello (`docs/security.md` §1). Lo storage (`AttachmentStorage`, driver locale)
conserva solo ciò che è stato effettivamente ricevuto — nessuna duplicazione dei dati in sistemi
esterni (nessuna integrazione S3/cloud reale nell'MVP).

## 6. Sola lettura verso il gestionale

`ERPAdapter` è un'interfaccia read-only per contratto (`docs/erp-integration.md`); nessuna
tabella legacy del gestionale viene mai letta o scritta al di fuori di questa interfaccia
(invariante 8 di `CLAUDE.md`) — nel codice attuale non è nemmeno implementata, quindi non
avviene alcun accesso.

## 7. Riepilogo — cosa manca per un deployment con dati reali

- Job di retention/cancellazione/anonimizzazione che legga `RuleSettings.*RetentionDays`.
- Applicazione di `excludedSenderPatterns` in fase di ingestione.
- Una revisione formale (DPIA o equivalente) se il volume di dati personali reali lo richiede —
  fuori scope per questa fase, che riguarda solo rifinitura/documentazione/audit dell'MVP mock.
