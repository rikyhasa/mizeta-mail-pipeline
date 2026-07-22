# Backlog — Mizeta Mail Pipeline

Lavori identificati ma deliberatamente rimandati, con l'innesco che li rende eseguibili.
Non un elenco di idee: solo cose analizzate o scoperte durante FASE 9-12 e non ancora
implementate. Aggiornare (non accumulare doppioni) quando un punto viene chiuso o quando
l'innesco si verifica.

## P5 — Auto-classificazione documenti (suggerimento, mai auto-conferma)

Analisi completa in FASE 12, Blocco C (artefatto 3): un passaggio di classificazione
(euristica in mock, LLM in prod) sul testo già estratto degli allegati non ancora
collegati propone un tipo di documento tecnico (`EnforcementDocumentType`) con
confidenza e provenienza. Non modifica mai `EnforcementDocumentCheck.status` da sola:
resta sempre e solo un suggerimento — l'operatore conferma con un click (riusa
`PATCH /api/cases/[id]/enforcement/documents/[documentType]` esistente, invariato) o
ignora. Mai un tipo legalmente decisivo marcato `PRESENT` senza conferma esplicita
(CLAUDE.md invariante 6/9).

**Innesco**: una casella di posta reale collegata, con traffico documentale sufficiente
a tarare la soglia minima di confidenza sotto cui il suggerimento resta silenzioso (senza
dati reali, la soglia proposta nell'analisi — 0.5 — è una stima non verificata).

## Analisi di un periodo di posta reale (incoming + sent)

Osservare un periodo reale di email in arrivo e in uscita per decidere, sui dati veri e
non su ipotesi, cosa aggiungere alla pipeline (nuovi campi/categorie ricorrenti non
coperti) e cosa alleggerire (check che nella pratica non scattano mai, o che scattano
sempre e quindi non discriminano nulla).

**Innesco**: una casella di posta reale collegata (`MailProviderAdapter` non-mock).

## Blocco D — Qualità eval

- **Accuratezza scadenze al 46.2%** (`docs/eval-report.md`, 53 fixture, `MockLLMProvider`)
  — prima di intervenire, capire se il problema è di *parsing* (formati di data non
  riconosciuti: nomi di mese, formati a trattino, "entro N giorni") o di *ragionamento*
  (termine calcolato male da una data corretta). Le due cause richiedono interventi
  diversi e non vanno confuse.
- **Duplicati falsi positivi**: 4 (`docs/eval-report.md`) — capire quali fixture li
  generano e se la soglia `matchingPossibleDuplicateConfidenceThreshold` va ritarata o se
  è un problema del matcher.
- **Casi autovelox out-of-distribution**: l'accuratezza applicabilità dispositivo
  autovelox al 100% (`docs/eval-report.md`) è dichiarata esplicitamente "guardia di
  regressione, non generalizzazione" — copre solo le fixture note, non è una misura di
  come si comporta il sistema su verbali mai visti in tuning. Servono fixture aggiuntive
  deliberatamente diverse da quelle di tuning per una misura reale di generalizzazione.

## Blocco E — Hardening deploy

- Smoke test post-deploy (endpoint critici raggiungibili, job queue attiva, connessione
  DB) non ancora definiti.
- Verificare che non ci sia mismatch fra Prisma client generato e schema applicato al DB
  di destinazione (rischio concreto quando una migrazione viene applicata senza rigenerare
  il client, o viceversa — già incontrato in sessione durante FASE 12 Blocco A).
