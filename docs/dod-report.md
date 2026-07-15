# Definition of Done dell'MVP — report di verifica

Riferimento: `docs/SPEC.md` §22. Ogni voce è stata verificata leggendo il codice reale (non a
memoria) al termine della Fase 5. Stato: **Completo** (funziona come richiesto, verificabile),
**Simulato** (esiste ma con una limitazione nota e documentata), **Mancante** (non esiste).

## 1. Avviabile localmente con istruzioni documentate

**Completo.** `README.md` — prerequisiti, `docker compose up -d`, `npm install`,
`npm run db:migrate`, `npm run db:seed`, `npm run dev`, utenti demo con credenziali. Verificato
eseguendo l'intera sequenza in questa sessione (typecheck/lint/test/test:e2e tutti verdi contro
il Postgres locale già in esecuzione). Build di produzione documentata (`npm run build` /
`npm start`) in README e `docs/deployment.md`.

## 2. Funziona interamente in mock

**Completo.** `EMAIL_PROVIDER=mock` (`src/lib/adapters/mail/mock-mail-provider.ts`) e
`LLM_PROVIDER=mock` (`src/lib/adapters/llm/mock-llm-provider.ts`, motore euristico reale, non
canned) sono i default di `.env.example`. Nessuna API key richiesta. I tre test end-to-end
aggiunti in questa fase (`tests/e2e/*.test.ts`) attraversano l'intero flusso email → pratica →
azione umana interamente in modalità mock.

## 3. Almeno 25 email sintetiche

**Completo.** `prisma/seed-data/emails.ts` contiene 28 fixture (`EML-001`…`EML-028`), confermato
dal log di seed ("Seed completato: 28 email"). Tutti i 13 casi difficili elencati in SPEC.md §4
sono presenti e annotati (`hardCase`): email ambigua (EML-025), fattura duplicata
(EML-009/EML-010), fattura senza scadenza (EML-008), reclamo con foto (EML-019), multa PEC
termine ridotto (EML-015), ricevuta di consegna PEC (EML-016), preventivo incompleto (EML-002),
conversazione che cambia categoria (EML-004/EML-004b), email in inglese (EML-003), email con più
intenzioni (EML-006), prompt injection (EML-026), allegato illeggibile (EML-024), importo
discordante (EML-011).

## 4. Crea e aggiorna pratiche

**Completo.** `src/lib/pipeline/process-incoming-message.ts` + `src/lib/matching/` (8 livelli di
SPEC.md §7): un'email senza match crea una nuova `Case` (`persist-classification.ts`,
`CASE_CREATED`); un'email che matcha un livello con confidenza sufficiente aggiorna la pratica
esistente (nuovi `CaseField`, nuova `CaseDeadline`, ecc.), senza mai un merge automatico a bassa
confidenza. Verificato da `tests/integration/pipeline-orchestrator.test.ts` e dai tre file
`tests/e2e/*.test.ts`.

## 5. Classifica

**Completo.** Passaggio 1 della pipeline AI (`docs/ai-pipeline.md` §1), Structured Output +
Zod, enum da allowlist, `confidence`/`needs_human_review`/`security_flags`. Test:
`tests/unit/classification-schema.test.ts`, `tests/unit/llm/mock-classify.test.ts`,
`tests/unit/mock-llm-provider.test.ts`. **Nota**: l'accuratezza reale con `LLM_PROVIDER=anthropic`
è inferiore al mock (100% per costruzione) su alcune categorie — vedi §12 di questo report e
`docs/evaluation.md`. Non è un blocco per il DoD, che richiede la funzionalità dimostrabile in
mock, non un'accuratezza minima del provider reale.

## 6. Estrae campi con fonte e confidenza

**Completo.** Ogni `CaseField` ha `value`, `normalizedValue`, `confidence`, `sourceType`,
`sourceMessageId`/`sourceAttachmentId`/`sourceExcerpt`, `needsHumanReview` (`docs/data-model.md`
§2). L'interfaccia (dettaglio pratica) apre la fonte in un clic. Copertura per le 6 categorie
prioritarie di SPEC.md §5 (`src/lib/adapters/llm/schemas/extraction-*.ts`). Test:
`tests/unit/llm/extraction-schemas.test.ts`, `tests/unit/llm/mock-extract.test.ts`.

## 7. Mostra alert e scadenze

**Completo.** Dashboard a 3 fasce (`src/app/(app)/pratiche/_components/{AlertsBand,KpiBand,
CasesTable}.tsx`, SPEC.md §9), query in `src/lib/dashboard/queries.ts`
(`tests/integration/dashboard-queries.test.ts`). `CaseDeadline` alimenta sia gli alert (scaduti,
scadenza oggi, entro 7 giorni) sia il dettaglio pratica.

## 8. Consente correzione manuale

**Completo.** `PATCH /api/cases/[id]/fields/[fieldKey]` (conferma se body vuoto, corregge se
`value` fornito), sempre con audit (`FIELD_CONFIRMED`/`FIELD_UPDATED`). UI:
`FieldEditForm.tsx`/`ActionButton`. Test: `tests/integration/case-detail-actions.test.ts`,
flusso completo in `tests/e2e/quote-to-document.test.ts`. Metrica di adozione aggiunta in questa
fase: `src/lib/observability/metrics.ts` (`manualCorrections`, SPEC.md §17).

## 9. Registra audit log

**Completo.** `AuditLog` immutabile, 21 valori di `AuditAction`, copertura verificata voce per
voce in `docs/security.md` §4 per tutte le azioni elencate in SPEC.md §15. Nessun segreto o
corpo email in `metadata` (verificato nei call site).

## 10. Genera almeno scheda preventivo e dossier reclamo in PDF

**Completo** (e oltre il minimo richiesto). `GeneratedDocumentService`
(`src/lib/adapters/documents/`) con Puppeteer, 3 template implementati: `QUOTE_SHEET`,
`CLAIM_DOSSIER`, `FINE_SHEET` (`src/lib/adapters/documents/templates/`). Verificato generando un
PDF reale (bytes `%PDF...`) in `tests/integration/documents-route.test.ts` e in
`tests/e2e/quote-to-document.test.ts`. **Simulato**: gli altri 5 tipi di
`GeneratedDocumentType` (scheda ordine trasporto, report scadenze amministrative, briefing
operativo giornaliero, report crediti scaduti, report fatture fornitori) rispondono 501 — oltre
il minimo del DoD, non implementati in questa fase (rifinitura, non nuove feature di pipeline).

## 11. Test automatici

**Completo.** 20 file di unit test (`tests/unit/`), 18 file di test di integrazione
(`tests/integration/`, Postgres reale via `DATABASE_URL_TEST`), 3 file di test end-to-end
(`tests/e2e/`, aggiunti in questa fase — 4 scenari: preventivo→documento,
multa-PEC→bozza-approvata, fattura-duplicata→revisione, prompt-injection). Copertura di
autorizzazione (`auth-guard.test.ts`, `rbac.test.ts`), idempotenza (`job-queue.test.ts`,
"è idempotente" in `pipeline-orchestrator.test.ts`), duplicati (`review-queue.test.ts`),
webhook (`microsoft365-webhook.test.ts`), parser (`postacert.test.ts`,
`microsoft365-mappers.test.ts`), Structured Outputs (`classification-schema.test.ts`,
`extraction-schemas.test.ts`), prompt injection (`mock-security-flags.test.ts`, oggi anche
`tests/e2e/duplicate-and-injection.test.ts`). **Simulato**: nessun test guida un vero browser
(no Playwright/Cypress) — i test "E2E" attraversano le route Next.js reali in-process contro
Postgres reale, non l'interfaccia renderizzata; nessun test dedicato esercita esplicitamente il
percorso di un allegato non valido oltre alla fixture di seed (EML-024) e al test
`pipeline-orchestrator.test.ts` "allegato illeggibile".

## 12. Eval ripetibili

**Completo.** `npm run eval` (`eval/run-eval.ts`) sul dataset sintetico con expected output,
metriche di SPEC.md §18, report in `docs/eval-report.md` (mock, deterministico, ripetibile
identico ad ogni run) e `docs/eval-report-anthropic.md` (provider reale, costo/token
riproducibili ma output non deterministico al 100% per natura del modello). Gap di accuratezza
noti tra mock e reale documentati onestamente in `docs/evaluation.md` (categoria 78.6%, scadenze
33.3% con provider reale) — backlog di prompt-tuning esplicitamente fuori scope per questa fase.

## 13. Non invia email

**Completo.** Nessuna funzione di invio esiste nel codice: `EmailDraft` non ha nemmeno un campo
`sentAt` nello schema (verificato in `prisma/schema.prisma`); resta sempre in
`PENDING_APPROVAL`/`APPROVED`/`DISCARDED`, mai uno stato "inviata". Verificato esplicitamente da
`tests/integration/drafts.test.ts` e `tests/e2e/fine-review-and-draft.test.ts`.

## 14. Non effettua pagamenti

**Completo.** Nessun codice di pagamento nel repository. Per CUSTOMER_RECEIVABLE, "stato
dichiarato dal cliente" (dall'email, non affidabile) è sempre distinto da "stato verificato nel
gestionale" (mai popolato, perché `ERPAdapter` non è implementato — vedi punto 15): non può
quindi esserci confusione tra i due, e nessuna pratica viene mai marcata "incassata" sulla sola
base di un'email.

## 15. Non modifica il gestionale

**Completo** (per assenza di integrazione, non solo per contratto). `ERPAdapter`
(`src/lib/adapters/erp/types.ts`) è read-only per firma, ma **nessuna implementazione esiste**:
nessun codice legge né scrive alcun gestionale. Dettaglio in `docs/erp-integration.md`.

## 16. Non espone segreti

**Completo.** `.env.example` non contiene credenziali reali (`SEED_DEMO_PASSWORD` è
esplicitamente marcata "local/demo only"). Logger con denylist che blocca `password`,
`passwordHash`, `secret`, `token`, `accessToken`, `clientSecret`, `clientState` (fuori
produzione: lancia; in produzione: omette), verificato da `tests/unit/logger.test.ts`. Sessioni:
solo l'hash SHA-256 del token è salvato lato server, mai il token in chiaro.

## 17. Tratta le email come contenuto non affidabile

**Completo.** `SECURITY_INSTRUCTION` (testo verbatim di SPEC.md §13) iniettata in ogni system
prompt che tocca contenuto grezzo; delimitatori `EMAIL_CONTENT`/`ATTACHMENT_CONTENT`; nessun
`tools[]` mai passato al modello (mitigazione strutturale, non solo istruzione testuale);
allegati illeggibili mai analizzati. Dimostrato end-to-end in
`tests/e2e/duplicate-and-injection.test.ts`: un'email con istruzioni malevole viene classificata
correttamente (dato reale della fattura estratto, non il testo iniettato), flaggata
(`security_flags`, `SECURITY_FLAG_DETECTED`) e forzata in `NEEDS_REVIEW` — nessuna azione
automatica ne deriva mai. Dettaglio completo in `docs/security.md`.

## Riepilogo

Tutte le 17 voci della Definition of Done sono **Completo** nell'accezione richiesta dalla
specifica (dimostrabile interamente in mock, senza credenziali reali). Due voci sono completo
"oltre il minimo richiesto ma con un residuo simulato esplicitamente fuori scope di questa fase":
generazione documenti (3/8 tipi, il minimo del DoD ne richiede solo 2) e test automatici (nessun
browser reale, ma E2E in-process contro le stesse route/Postgres di produzione). Nessuna voce è
**Mancante**. Le lacune note e non richieste da questo giro di lavoro — `pec_imap` scheletro,
`LLM_PROVIDER=openai` scheletro, `ERPAdapter` non implementato, retention/esclusione mittenti
configurabili ma non applicate — sono elencate anche in `README.md` ("Cosa è simulato o
incompleto") e nei singoli documenti di `docs/` pertinenti, per non lasciare nulla di implicito.
