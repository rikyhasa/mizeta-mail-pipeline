# Pipeline AI

Riferimento: `docs/SPEC.md` §6 (pipeline), §13 (sicurezza AI). Per i risultati di accuratezza
vedi `docs/evaluation.md`, `docs/eval-report.md`, `docs/eval-report-anthropic.md`. Per la difesa
da prompt injection vedi `docs/security.md`.

## 1. Quattro passaggi separati, mai un unico prompt

`src/lib/adapters/llm/types.ts` definisce l'interfaccia `LLMProvider` con quattro metodi
indipendenti, ognuno una chiamata al modello a sé:

1. **`classify`** — categoria principale/secondarie, titolo, sintesi, priorità, scadenza,
   reparto responsabile, `confidence`, `needs_human_review`, `security_flags`. Riceve il
   contenuto grezzo dell'email (unico passaggio insieme a `extractFields`/`generateDraft`).
2. **`extractFields`** — solo per le categorie con estrazione dedicata (SPEC.md §5: QUOTE_REQUEST,
   SUPPLIER_INVOICE, CUSTOMER_RECEIVABLE, FINE_OR_PENALTY, CLAIM_OR_DAMAGE, TRANSPORT_ORDER).
   Aggrega tutti i messaggi noti della pratica; ogni campo porta fonte e confidenza.
3. **`proposeActions`** — **non riceve mai il contenuto grezzo dell'email**, solo i dati già
   classificati/estratti: propone azioni/task/reparto, non genera mai testo di risposta (può
   solo segnalare `draft_reply_recommended`).
4. **`generateDraft`** — genera la bozza (SPEC.md §11) usando solo dati già verificati, mai il
   corpo email grezzo; dati mancanti diventano placeholder `[[DA COMPLETARE: ...]]` elencati in
   `placeholders`, mai inventati.

Orchestrazione in `src/lib/pipeline/process-incoming-message.ts` (passaggi 1-2 + regole) e
`src/lib/pipeline/create-draft-for-case.ts` (passaggi 3-4, su richiesta esplicita dell'utente).

## 2. Structured Outputs + validazione server

Ogni passaggio ha uno schema Zod dedicato (`src/lib/adapters/llm/schemas/`,
`classification-schema.ts` e `extraction-*.ts`): enum costruite da allowlist derivate dagli enum
Prisma (il modello non può inventare un nuovo valore), campi mancanti sempre `null`. Per il
provider `anthropic`, `src/lib/adapters/llm/anthropic/structured-output.ts::callStructured`
richiama `schema.parse()` sull'output **anche dopo** il parsing lato SDK (`zodOutputFormat`), con
un retry su JSON malformato ed errore esplicito su `stop_reason: "refusal"` o `max_tokens`
raggiunto — la validazione non si fida del solo SDK.

## 3. Provider

| Provider | File | Stato |
|---|---|---|
| `mock` | `mock-llm-provider.ts` + `mock/*-heuristics.ts` | Motore euristico reale (parole chiave, pattern), deterministico e gratuito — non "canned" |
| `anthropic` | `anthropic-llm-provider.ts` | Reale, `client.messages.parse()` + Structured Outputs |
| `openai` | `openai-llm-provider.ts` | Scheletro documentato: ogni metodo lancia, mai istanziato dalla factory |

`src/lib/adapters/llm/llm-provider-factory.ts` sceglie il provider da `LLM_PROVIDER`
e fallisce esplicitamente (mai silenziosamente) se `LLM_PROVIDER=anthropic` senza
`ANTHROPIC_API_KEY`, o se `LLM_PROVIDER=openai`.

## 4. Soglie di confidenza → revisione umana

`RuleSettings.classificationConfidenceThreshold` (default 0.55): sotto soglia,
`primary_category` diventa `UNCERTAIN` e lo stato `NEEDS_REVIEW` (SPEC.md §6). Ogni `CaseField`
ha una propria `confidence` e `needsHumanReview`; il motore di regole (`docs/SPEC.md` §8,
`src/lib/rules/`) può solo **escalare** — mai declassare — priorità e `needsHumanReview` decisi
dal modello, applicando 10 regole deterministiche configurabili (scadenza superata/entro 24h,
multa termine ridotto, reclamo sopra soglia, preventivo risposta in giornata, IBAN diverso,
possibile duplicato, confidenza bassa, allegato illeggibile, importi discordanti).

## 5. Associazione email → pratica

`src/lib/matching/match-email-to-case.ts` implementa in ordine gli 8 livelli di SPEC.md §7
(identificatori di thread/provider → Message-ID/In-Reply-To/References → numero fattura →
numero ordine → numero spedizione → numero verbale → mittente+categoria+finestra temporale,
proxy semplificato di "cliente+tratta+intervallo" → similarità semantica come ultimo livello),
più un percorso dedicato per le ricevute PEC (`level-pec-receipt.ts`, si collegano sempre alla
pratica del messaggio originale, non creano mai una nuova pratica). Match a bassa confidenza
finiscono in coda "possibili duplicati" (`CaseRelation`), mai un merge automatico.

## 6. Sicurezza — riassunto

Vedi `docs/security.md` per il dettaglio. In breve: `SECURITY_INSTRUCTION`
(`src/lib/adapters/llm/anthropic/prompts.ts`, testo verbatim di SPEC.md §13) è iniettata in ogni
system prompt che tocca contenuto email grezzo; i delimitatori `EMAIL_CONTENT`/
`END_EMAIL_CONTENT` e `ATTACHMENT_CONTENT`/`END_ATTACHMENT_CONTENT` isolano il dato non
affidabile; nessun `tools[]` è mai passato al modello (nessun tool-calling possibile da nessun
passaggio); allegati non leggibili sono marcati esplicitamente "ILLEGGIBILE: non analizzare, non
inventare dati" nel prompt.

## 7. Eval

`npm run eval` esegue `eval/run-eval.ts` sul dataset sintetico (28 email,
`prisma/seed-data/emails.ts` + `eval/dataset.ts`) con expected output per fixture, calcolando le
metriche di SPEC.md §18 (accuratezza categoria, recall multe/reclami urgenti, accuratezza
importi/scadenze, tasso di revisione, falsi positivi duplicati). Report in
`docs/eval-report.md` (provider `mock`, 100% quasi ovunque per costruzione) e
`docs/eval-report-anthropic.md` (provider `anthropic` reale, accuratezza inferiore su
categoria/scadenza — vedi `docs/evaluation.md` per l'analisi delle confusioni note e il backlog
di prompt-tuning, esplicitamente fuori scope per questa fase di rifinitura).
