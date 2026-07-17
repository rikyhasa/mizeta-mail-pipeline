# Specifica draft — Modulo verifica tecnica e documentale autovelox (FASE 9, Fase D)

> **Bozza da discutere e approvare esplicitamente prima della Fase E
> (implementazione).** Nessun codice, migrazione, seed o test è stato creato in
> questa sessione. Branch: `audit/ux-e-autovelox`. L'implementazione, se
> approvata, andrà su un branch dedicato `feature/autovelox`.

## 1. Perché questo modulo e cosa NON deve fare

Quando una pratica riguarda una multa rilevata da un dispositivo di controllo
della velocità, l'app deve aiutare l'operatore a identificare il dispositivo,
capire quali documenti tecnici sono presenti/mancanti, conservare le fonti,
eventualmente preparare (mai inviare) una richiesta di documentazione, e
sottoporre il caso a verifica umana/legale — tracciando ogni passaggio.

Il modulo **non deve mai**: dichiarare una multa valida/invalida; prevedere
l'esito di un ricorso; dichiarare un dispositivo "illegale"; simulare verifiche
presso banche dati inesistenti; considerare affidabile un dato senza fonte;
sostituire la revisione umana. Linguaggio prudente obbligatorio (allowlist
enum, mai testo libero generato dal modello per gli stati): *Documentazione
completa; Documentazione incompleta; Dato non disponibile; Dato non
verificato; Possibile incoerenza; Richiede verifica tecnica; Richiede verifica
legale; Controllo velocità non applicabile.*

## 2. Stato attuale del target — cosa esiste e cosa manca

Verificato per intero su `prisma/schema.prisma` (780 righe) e `docs/SPEC.md`
(312 righe):

- **`CaseCategory`** (`prisma/schema.prisma:48-61`) include `FINE_OR_PENALTY`,
  ma **nessuna sotto-categoria/tipo di violazione/articolo** — non esiste un
  campo che distingua un eccesso di velocità da una ZTL o un accesso non
  autorizzato. `docs/SPEC.md:136-139` (§5) elenca già i campi strutturati per
  multe (*ente; numero verbale; targa; autista; data e luogo infrazione; tipo
  violazione; importo; importo ridotto; scadenze; punti; documenti mancanti;
  canale di ricezione*) — `tipo violazione` esiste già come `CaseField` libero
  (confermato dal vivo: valore `"142 C.d.S."` sulla pratica testata), ma non è
  un enum né determina applicabilità.
- **`DeadlineKind`** (righe 96-104) ha già `PAYMENT_REDUCED_DUE`/`APPEAL_DUE`
  — riusabili per le scadenze del modulo, nessuna modifica necessaria.
- **`GeneratedDocumentType`** (righe 133-142) ha già `FINE_SHEET` — generico,
  nessun contenuto tecnico specifico.
- **Nessun modello dispositivo/verifica/tarautura esiste**: `grep -ni
  "autovelox|speed|camera|device|enforcement"` su `prisma/schema.prisma`
  restituisce **zero corrispondenze**.
- **Nessun concetto di tenant/organizzazione** in tutto lo schema (zero
  corrispondenze per `tenant|orgId|organizationId`) — il target è a singolo
  tenant ovunque (si veda anche `docs/UX-AUDIT-2026-07.md`, §3.2, stesso
  finding sull'elenco pratiche). Questo significa che la richiesta del brief
  originale di "isolamento tenant" per il nuovo modulo (§11-12 del prompt
  originale) **non ha un pattern esistente da riusare** — va trattata come
  fuori scope per la v1 (si veda §11 sotto).
- **Ruoli reali** (`prisma/schema.prisma:15-21`, confermato da
  `src/lib/auth/rbac.ts:1-16`): `ADMIN, OPERATIONS, ACCOUNTING, COMMERCIAL,
  READ_ONLY`, **flat**, nessun ruolo "responsabile" distinto — tutti tranne
  `READ_ONLY` hanno oggi `case:read`+`case:write` senza differenziazione.
- **Pattern riusabili già presenti e maturi**: `CaseField` (provenienza per
  campo: value/normalizedValue/confidence/sourceType/sourceMessageId/
  sourceAttachmentId/sourcePage/sourceExcerpt/needsHumanReview/confirmedById/
  confirmedAt — righe 407-430); `AuditLog` immutabile (righe 704-718, nessun
  `updatedAt`, nessuna route PATCH/DELETE, scrittura solo via
  `writeAuditLog()`); run tracciati (`ClassificationRun`/`ExtractionRun`/
  `ActionProposalRun`, righe 574-625, stesso schema: `llmProvider`, `status
  RunStatus`, `resultJson`, `costUsd`, `startedAt`/`finishedAt`);
  `CaseRelation` (righe 627-643: stato sempre `PENDING` finché un umano non
  conferma `CONFIRMED`/`REJECTED`, mai un merge automatico).

**Conclusione**: il modulo non parte da zero — ma nemmeno da un frammento già
pronto. Va costruito riusando i pattern sopra, non inventandone di nuovi.

## 3. Analisi del modulo mock della reference (`fine-device-verification.tsx` e affini)

Il modulo della reference è **puramente client-side**: nessuna chiamata
Prisma/API in tutto `lib/fines/` e `components/fine-device-verification.tsx`
(letti per intero) — solo `useState` locale, dati statici per due pratiche
demo (`case-008`, `case-023`).

**Tipi** (`lib/fines/types.ts`, 24 righe): ogni campo estratto è avvolto in
`FineSourceField<T>` (`value`/`normalizedValue`/`confidence`/`sourceDocument`/
`sourcePage`/`sourceExcerpt`/`verified`) — stessa filosofia di provenienza di
`CaseField`, ma annidata per-campo dentro un unico oggetto `FineDeviceData`
invece che una riga per campo in una tabella condivisa. Enum verbatim:
`enforcementDeviceTypes = ["SPEED_CAMERA","MOBILE_SPEED_DEVICE",
"TUTOR_AVERAGE_SPEED","RED_LIGHT_CAMERA","ZTL_CAMERA","BUS_LANE_CAMERA",
"OTHER_ENFORCEMENT_DEVICE","UNKNOWN_DEVICE"]`; `fineAnalysisOutcomes =
["NO_OBVIOUS_ANOMALY","POTENTIAL_DOCUMENT_ANOMALY","INSUFFICIENT_DOCUMENTATION",
"POTENTIAL_GROUND_FOR_CHALLENGE","LEGAL_REVIEW_RECOMMENDED","NOT_APPLICABLE",
"UNABLE_TO_VERIFY"]`.

**Motore regole** (`lib/fines/rules.ts`, 27 righe, `analyzeFine()`):
deterministico, confronta con un registro mock, valuta taratura/funzionalità,
deriva l'outcome da conteggi di anomalie/documenti mancanti — **non conclude
mai validità/invalidità**, e i testi di `suggestedAction` rimandano sempre a
revisione umana/legale ("Sottoporre il fascicolo a verifica legale"). **Rischio
identificato**: il file incorpora comunque **fatti legali hardcoded come
costanti di codice** — una data di efficacia normativa (`2026-07-12`), URL di
Gazzetta Ufficiale/MIT, una lista `annexBDecrees` — esattamente il tipo di
"banca dati legale simulata" che il brief vieta esplicitamente (§13 del prompt
originale: *"Non introdurre conclusioni giuridiche... senza una specifica
decisione legale e una fonte autorevole"*). **La proposta per il target
eviterà qualunque regola o fonte legale hardcoded nel codice.**

**Registro dispositivi mock** (`lib/fines/registry.ts`, 19 righe): un solo
dispositivo hardcoded, URL governativo reale nel commento ma mai realmente
interrogato — `refreshLocalCache()` richiede un `approvedBy` non vuoto (unico
"gate" di approvazione presente nel mock).

**Nota aggiuntiva verificata dopo la stesura iniziale di questa bozza**: l'URL
usato nel commento del mock, `https://velox.mit.gov.it/dispositivi`, **non è
inventato** — è il portale reale del Ministero delle Infrastrutture e dei
Trasporti, online dal 30/11/2025, che pubblica l'elenco nazionale dei
dispositivi di rilevamento velocità (~3625 dispositivi al momento della
verifica), base legale **Decreto Direttoriale MIT prot. 305 del 18/08/2025**,
attuativo dell'art. 5, comma 3-bis, del D.L. 73/2025 (conv. L. 105/2025) — le
sanzioni elevate con dispositivi non presenti in questo elenco sono nulle dal
30/11/2025 (fonti: [mit.gov.it](https://www.mit.gov.it/comunicazione/news/pubblicata-la-lista-nazionale-degli-autovelox),
[Altalex](https://www.altalex.com/documents/news/2025/12/14/autovelox-sanzioni-legittime-apparecchio-lista-ministero)).
Questo **non cambia la valutazione di rischio sul mock**: i *dati* del
dispositivo demo, il *registro* (`MockSpeedDeviceRegistryAdapter`, un solo
elemento hardcoded) e le *regole legali* (`annexBDecrees`, data di efficacia
`2026-07-12`) restano completamente fittizi — solo l'URL nel commento si è
rivelato, per coincidenza o previsione, corrispondere a un servizio reale
diventato operativo dopo la scrittura del mock. Il §13 di questa specifica usa
ora questo registro reale come base per una proposta di integrazione concreta,
sostituendo l'ipotesi iniziale "nessuna fonte esterna reale esiste" — si veda
sotto.

**Generatore bozza di richiesta accesso agli atti** (`lib/fines/access-request.ts`,
3 righe): stringa pura con placeholder (`[NOME E COGNOME]` ecc.), mostrata in un
**modal read-only** con avviso esplicito *"L'app non invia PEC"* — mai
un'istanza `EmailDraft` reale.

**UI** (`fine-device-verification.tsx`, 24 righe): disclaimer legale sempre
visibile in testa al pannello — *"Questa analisi è un controllo preliminare
automatizzato e non costituisce consulenza legale né garantisce l'accoglimento
di un eventuale ricorso"* — sezioni: riepilogo dispositivo, `verification-grid`
di controlli con stato (Corrisponde/Non corrisponde/Valido/Scaduto/Mancante/Non
applicabile/Non verificabile), anomalie, documenti mancanti, azioni ("Genera
richiesta documenti", "Segna per verifica legale", "Conferma dati") — **tutte
`useState` locali, nessuna persistenza**.

**Finding non ovvio — lo schema Prisma della reference anticipa già un modello
persistito, mai collegato al codice mock**: `.reference/mizeta-flow/prisma/schema.prisma`
(righe 392-438) definisce `FineTechnicalAnalysisRun` (input/output snapshot
`Json`, `markedForLegalReview`, `confirmedById`/`At`), `LegalRuleRecord`
(versionamento regole legali con fonte ufficiale e validità temporale),
`SpeedRegistrySnapshot` (provenienza/hash/verifica di un import da registro
esterno) — utile come punto di partenza concettuale, ma pensato per un'app
**multi-tenant** (`model Organization`, `organizationId` su quasi ogni
modello) — il target è single-tenant, quindi questi modelli vanno **adattati,
non copiati**.

## 4. Applicabilità — non solo `CaseCategory`

Il modulo non deve apparire per qualunque `FINE_OR_PENALTY`. Serve un
passaggio esplicito di classificazione dell'applicabilità, popolato dalla
pipeline AI **sempre con `needsHumanReview: true` finché un operatore non
conferma** (coerente con l'invariante 6 di CLAUDE.md: mai un enum libero dal
modello, sempre da un'allowlist validata Zod):

```
enum EnforcementCheckApplicability {
  NOT_APPLICABLE          // ZTL, semaforo, accesso non autorizzato, altro non legato alla velocità
  TO_BE_IDENTIFIED         // dispositivo non identificabile dal verbale
  SPEED_CAMERA_FIXED
  SPEED_CAMERA_MOBILE
  AVERAGE_SPEED_CONTROL    // tutor
  TELELASER
  OTHER_SPEED_DEVICE
}
```

La classificazione guarda tipo di violazione, articolo indicato, testo del
verbale, dati già estratti — non solo `CaseCategory === FINE_OR_PENALTY` —
esattamente come richiesto dal brief (§6). Esempio pratico osservato dal vivo:
la pratica `PRT-2026-0025` (`142 C.d.S.`, eccesso di velocità) sarebbe
`SPEED_CAMERA_FIXED` o `TO_BE_IDENTIFIED` finché un operatore non conferma il
tipo esatto di dispositivo dal verbale allegato (`verbale-MI-2026-889231.pdf`,
già presente come allegato reale nella cronologia email).

## 5. Stati proposti

```
enum EnforcementVerificationState {
  NOT_APPLICABLE
  TO_BE_IDENTIFIED
  IDENTIFIED
  DOCUMENTATION_TO_ACQUIRE
  DOCUMENTATION_INCOMPLETE
  DATA_CONFLICT
  TO_BE_VERIFIED
  DOCUMENTED_VERIFICATION_COMPLETE   // "Verificato documentalmente": solo che dati/documenti attesi sono stati controllati, MAI che la sanzione sia valida/invalida
  REQUIRES_LEGAL_REVIEW
}
```

Mappatura 1:1 sull'elenco proposto nel brief (§8) — nessuna semplificazione,
nessuna aggiunta di stati che implichino un giudizio di merito.

## 6. Workflow — riuso dei pattern già esistenti

| Fase brief | Pattern del target da riusare |
|---|---|
| P1 Rilevamento | Stesso hook della pipeline che oggi popola `CaseField` da `ExtractionRun` — nessuna nuova infrastruttura di ingestione. |
| P2 Estrazione | Nuovo `EnforcementDeviceField` (stessa forma di `CaseField`, vedi §7), popolato da un run tracciato analogo a `ExtractionRun`. Se applicabile, il confronto con il registro MIT (§13) avviene qui: si consulta l'ultimo `SpeedRegistrySnapshot` disponibile (nessuna chiamata di rete sincrona durante l'estrazione — solo lettura dello snapshot già scaricato). |
| P3 Valutazione preliminare | Funzione deterministica pura (niente LLM per la valutazione, solo per l'estrazione né per la consultazione del registro — §13) — analoga a `rules.ts` della reference ma **senza** costanti legali hardcoded: deriva `EnforcementVerificationState` solo da conteggi di campi/documenti mancanti/in conflitto e dall'esito del confronto con lo snapshot registro (corrisponde/non corrisponde/non trovato), mai da una data o un decreto specifico scritto nel codice. |
| P4 Revisione umana | Stesso pattern di conferma di `CaseField` (endpoint `confirmedById`/`confirmedAt`) — **ma con il fix di validazione di P0 #1 già applicato** (si veda `docs/UX-AUDIT-2026-07.md`), per non ereditare lo stesso bug. |
| P5 Richiesta documenti | Genera una stringa di bozza (come `access-request.ts` della reference) mostrata in read-only per revisione — **oppure**, se si vuole tracciarla come le altre bozze del target, crea un vero `EmailDraft` (riuso totale dell'infrastruttura esistente: stesso flusso di approvazione umana, stesso invariante "mai inviato"). Consigliato: **riusare `EmailDraft`** invece di duplicare un meccanismo di bozza parallelo — un solo posto dove si applica il fix di P0 #2. |
| P6 Esito operativo | `EnforcementVerificationState` finale + audit log — nessuna nuova infrastruttura di stato oltre l'enum. |

## 7. Proposta dati e migrazioni (raccomandazione)

**Modello ridotto ma normalizzato** — non un blob `Json` unico (perderebbe
provenienza per-campo e interrogabilità), non 5 tabelle separate come la rosa
di nomi proposta nel brief come domanda aperta (§11: `FineDeviceVerification;
EnforcementDevice; DeviceEvidence; DeviceDocumentCheck; FineDeviceReview`).
Tre modelli nuovi, additivi, nessuna modifica a tabelle esistenti:

```prisma
model EnforcementDeviceCheck {
  id               String                          @id @default(cuid())
  caseId           String                          @unique
  case             Case                             @relation(fields: [caseId], references: [id], onDelete: Cascade)
  applicability    EnforcementCheckApplicability
  state            EnforcementVerificationState     @default(TO_BE_IDENTIFIED)
  needsHumanReview Boolean                          @default(true)
  needsLegalReview Boolean                          @default(false)
  extractionRunId  String?
  extractionRun    ExtractionRun?                   @relation(fields: [extractionRunId], references: [id])
  registrySnapshotId String?                        // snapshot del registro MIT consultato per questa pratica (§13) — nullable: non ogni check consulta il registro (es. NOT_APPLICABLE lo salta)
  registrySnapshot   SpeedRegistrySnapshot?          @relation(fields: [registrySnapshotId], references: [id])
  registryMatch      EnforcementRegistryMatchState?  // MATCH | MISMATCH | NOT_FOUND | NOT_CONSULTED — esito del confronto, mai una conclusione di validità
  confirmedById    String?
  confirmedBy      User?                            @relation(fields: [confirmedById], references: [id])
  confirmedAt      DateTime?
  createdAt        DateTime                         @default(now())
  updatedAt        DateTime                         @updatedAt

  fields           EnforcementDeviceField[]
  documentChecks   EnforcementDocumentCheck[]
}

model EnforcementDeviceField {
  id                 String           @id @default(cuid())
  checkId            String
  check              EnforcementDeviceCheck @relation(fields: [checkId], references: [id], onDelete: Cascade)
  fieldKey           String           // "manufacturer" | "model" | "serialNumber" | "road" | "authority" | ... (allowlist applicativa, non enum DB — stessa scelta già fatta per CaseField.fieldKey)
  value              String?
  normalizedValue    String?
  confidence         Float?
  sourceType         FieldSourceType?
  sourceMessageId    String?
  sourceMessage      EmailMessage?    @relation(fields: [sourceMessageId], references: [id])
  sourceAttachmentId String?
  sourceAttachment   Attachment?      @relation(fields: [sourceAttachmentId], references: [id])
  sourcePage         Int?
  sourceExcerpt      String?
  needsHumanReview   Boolean          @default(false)
  confirmedById      String?
  confirmedBy        User?            @relation(fields: [confirmedById], references: [id])
  confirmedAt        DateTime?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@unique([checkId, fieldKey])
}

model EnforcementDocumentCheck {
  id             String                      @id @default(cuid())
  checkId        String
  check          EnforcementDeviceCheck      @relation(fields: [checkId], references: [id], onDelete: Cascade)
  documentType   EnforcementDocumentType     // decreto approvazione | certificato taratura | certificato funzionalità | manuale/scheda tecnica | altro
  status         EnforcementDocumentStatus   @default(MISSING) // PRESENT | MISSING | REQUESTED
  attachmentId   String?
  attachment     Attachment?                 @relation(fields: [attachmentId], references: [id])
  note           String?
  createdAt      DateTime                    @default(now())
  updatedAt      DateTime                    @updatedAt

  @@unique([checkId, documentType])
}

model SpeedRegistrySnapshot {
  id                 String                    @id @default(cuid())
  sourceUrl          String                    // "https://velox.mit.gov.it/dispositivi" — §13
  fetchMethod        SpeedRegistryFetchMethod  @default(SCHEDULED_FETCH)
  uploadedById       String?                   // valorizzato solo per MANUAL_UPLOAD (§13, fallback)
  uploadedBy         User?                     @relation(fields: [uploadedById], references: [id])
  fetchedAt          DateTime                  @default(now())
  payloadHash        String                    // hash del contenuto scaricato/caricato, per il diff e per rilevare "nessuna modifica"
  deviceCount        Int
  rawStorageKey      String                    // HTML/CSV grezzo salvato in storage S3-compatible (GeneratedDocumentService o storage equivalente) — evidenza ispezionabile, non solo il parsing
  diffFromPreviousId String?
  diffFromPrevious   SpeedRegistrySnapshot?    @relation("SnapshotDiff", fields: [diffFromPreviousId], references: [id])
  diffSummary        Json?                     // { added: number, removed: number, changed: number } rispetto allo snapshot precedente
  createdAt          DateTime                  @default(now())

  previousDiffs      SpeedRegistrySnapshot[]   @relation("SnapshotDiff")
  deviceChecks       EnforcementDeviceCheck[]
}

enum SpeedRegistryFetchMethod {
  SCHEDULED_FETCH
  MANUAL_UPLOAD
}

enum EnforcementRegistryMatchState {
  MATCH
  MISMATCH
  NOT_FOUND
  NOT_CONSULTED
}
```

Perché questa forma e non altre:

- **`EnforcementDeviceField` ricalca esattamente `CaseField`** (stessi 13
  campi di provenienza) per riusare l'infrastruttura di editing/conferma già
  esistente lato UI (`ExtractedFieldCell`, `FieldEditForm`, lo stesso endpoint
  di conferma — parametrizzato per operare su `CaseField` o
  `EnforcementDeviceField` a seconda del contesto) invece di duplicarla da
  zero. **Precondizione**: il fix di P0 #1 (validazione server-side contro
  conferma di campo vuoto) va applicato alla logica condivisa, non solo a
  `CaseField`, altrimenti il nuovo modulo eredita lo stesso bug.
- **`EnforcementDeviceCheck` è 1:1 con `Case`**, creato solo quando
  l'applicabilità non è `NOT_APPLICABLE` — evita di popolare righe inutili per
  il 90%+ delle pratiche che non sono multe da autovelox.
- **Niente `EnforcementDevice` come registro cross-pratica in v1**: il brief
  stesso lo pone come domanda aperta (§11) — non ci sono ancora dati
  sufficienti né un caso d'uso chiaro per deduplicare dispositivi tra verbali
  diversi (richiederebbe anche decidere identità/matching tra dispositivi, un
  problema separato). Proposto come estensione futura esplicita, non v1.
- **`SpeedRegistrySnapshot` è incluso in v1** (a differenza della prima stesura
  di questa bozza, che lo escludeva assumendo l'assenza di una fonte esterna
  reale): il registro MIT `velox.mit.gov.it/dispositivi` esiste davvero ed è
  operativo dal 30/11/2025 (verificato, si veda §3 e §13) — un modello di
  provenienza/hash/data di consultazione è quindi giustificato, non
  overengineering. **Resta escluso `LegalRuleRecord`**: non introduciamo un
  motore di regole legali versionate — il confronto con il registro produce
  solo `MATCH`/`MISMATCH`/`NOT_FOUND`, mai una conclusione di validità (si
  veda §13 per il perché questa distinzione è importante).

Migrazione Prisma singola, additiva (nessun `ALTER` su tabelle esistenti oltre
alle nuove relazioni inverse su `Case`/`ExtractionRun`/`User`/`Attachment`).

## 7bis. Fonti esterne — integrazione registro MIT (`velox.mit.gov.it/dispositivi`)

Sezione aggiunta dopo la stesura iniziale di questa bozza, su indicazione
esplicita dell'utente, con dettagli operativi verificati (ricerca web, lettura
`robots.txt`, lettura della pagina del registro e del comunicato ufficiale
MIT) prima di scriverli qui come fatti — coerente con la cautela richiesta dal
brief originale sul non trattare fonti/regole legali come verificate senza
riscontro.

**Cosa è stato verificato**:

- **Fonte**: `https://velox.mit.gov.it/dispositivi` — portale reale del
  Ministero delle Infrastrutture e dei Trasporti, online dal 30/11/2025,
  ~3625 dispositivi al momento della verifica (fonte:
  [mit.gov.it](https://www.mit.gov.it/comunicazione/news/pubblicata-la-lista-nazionale-degli-autovelox)).
  Base legale: **Decreto Direttoriale MIT prot. 305 del 18/08/2025**,
  attuativo dell'art. 5, comma 3-bis, del D.L. 73/2025 (conv. L. 105/2025) —
  citazione più precisa di "Decreto 305/2025 art. 5": è un decreto
  *direttoriale* del MIT che attua un articolo di un *diverso* provvedimento
  (il D.L. 73/2025), non un decreto legge numerato 305/2025 in sé. Questa
  distinzione va rispettata quando il riferimento normativo compare in UI o
  in audit log — mai abbreviata in modo impreciso, per lo stesso principio di
  prudenza linguistica del §1.
- **Formato dei dati esposti** (verificato leggendo la pagina): per ogni
  dispositivo — codice ente accertatore, nome dispositivo, codice catastale,
  decreto normativo, data decreto, tipo dispositivo, produttore, modello,
  versione, matricola, note, data ultima comunicazione, data primo
  inserimento. Mappa bene sui campi già proposti per `EnforcementDeviceField`
  (`manufacturer`/`model`/`version`/`serialNumber`/`decreeNumber`/`decreeDate`/`authority`).
- **Nessun export strutturato trovato**: nessun link a CSV/JSON/API — solo una
  tabella HTML consultabile a video. **Implicazione operativa importante**:
  il "download della lista" richiede il parsing di una tabella HTML (con
  paginazione, dato il volume — ~3625 righe), non una chiamata a un endpoint
  dati pulito. Questo rende l'integrazione strutturalmente più fragile di
  un'API versionata — coerente con la richiesta dell'utente di prevedere un
  fallback per cambio di formato (vedi sotto), che qui non è un'eventualità
  remota ma un rischio concreto e prevedibile.
- **Termini d'uso**: nessuna licenza dati esplicita (es. Creative Commons/open
  data) né termini di riuso trovati sulla pagina del registro o nel
  comunicato ufficiale MIT. `robots.txt` del dominio (`velox.mit.gov.it/robots.txt`)
  è permissivo (`User-agent: *`, nessun `Disallow`) — indicazione tecnica
  favorevole ma non un'autorizzazione legale esplicita. Il comunicato
  ufficiale descrive i dati come "automaticamente pubblicati e liberamente
  consultabili" — linguaggio informale, non una licenza. **Raccomandazione
  conservativa**: trattare l'accesso come pura consultazione pubblica
  in sola lettura per uso interno (confronto documentale su singole pratiche),
  **mai** ripubblicare o ridistribuire i dati grezzi scaricati al di fuori
  dell'app, sempre conservare l'attribuzione (URL sorgente + data di
  consultazione) accanto a ogni snapshot — esattamente lo stesso principio di
  provenienza già richiesto per `CaseField`/`EnforcementDeviceField.sourceExcerpt`.
  Se l'utente vuole un'automazione più aggressiva di quanto qui raccomandato,
  è un punto da confermare esplicitamente prima della Fase E, non da assumere.
- **Frequenza di accesso**: un solo accesso giornaliero, come richiesto — e
  comunque coerente con quanto verificato: nessuna frequenza di aggiornamento
  dichiarata dal MIT (il comunicato dice solo che gli aggiornamenti
  "continueranno... secondo le modalità stabilite dal decreto", senza cadenza
  precisa), quindi un fetch più frequente non porterebbe dati più freschi in
  modo garantito — un accesso al giorno è già proporzionato.

**Meccanismo di sync proposto**:

Il job queue esistente (`prisma/schema.prisma:735-753`, modello `Job`/`JobAttempt`
su Postgres, non Redis/BullMQ — deviazione già documentata nel repo,
`src/lib/jobs/queue.ts`) è oggi **reattivo**: i job esistenti
(`INGEST_MAILBOX_CHANGES`, `PROCESS_INCOMING_MESSAGE`, `RENEW_SUBSCRIPTION`)
vengono accodati da un evento (webhook, sync manuale), non da una
schedulazione ricorrente autonoma — non esiste oggi un meccanismo di "cron"
interno. **Per una sincronizzazione davvero giornaliera serve un piccolo
pezzo di infrastruttura in più**, non qualcosa che "esiste già gratis":

- Nuovo `JobType.SYNC_SPEED_DEVICE_REGISTRY`.
- Pattern di **auto-rischedulazione**: al completamento (successo o
  esaurimento tentativi), il job accoda se stesso con
  `enqueueJob({ type: "SYNC_SPEED_DEVICE_REGISTRY", idempotencyKey:
  "speed-registry-sync", runAt: new Date(Date.now() + 24h) })` — riusa
  esattamente il meccanismo di dedup per `idempotencyKey` già esistente in
  `enqueueJob()` (`src/lib/jobs/queue.ts:19-46`: se lo stato è terminale,
  "viene riarmato da zero"), nessuna nuova libreria di scheduling.
- Il job: scarica/effettua il parsing della tabella HTML, calcola
  `payloadHash` (per rilevare "nessuna modifica" e non creare uno snapshot
  identico ogni giorno — o comunque crearlo ma con `diffSummary` a zero, da
  decidere in Fase E), salva il file grezzo in storage (per audit/ispezione
  futura, non solo il risultato del parsing), calcola il diff rispetto
  all'ultimo snapshot (`added`/`removed`/`changed`), crea la riga
  `SpeedRegistrySnapshot` con `fetchMethod: SCHEDULED_FETCH`.
  **Nessuna chiamata LLM coinvolta** — parsing deterministico di una tabella
  HTML nota, non un compito da affidare a un modello.
- Ogni pratica che consulta il registro per un confronto dispositivo registra
  quale `SpeedRegistrySnapshot` è stato consultato
  (`EnforcementDeviceCheck.registrySnapshotId`) — provenienza opponibile: si
  può sempre rispondere "quale versione del registro MIT è stata usata per
  questa verifica, e quando".
- **Fallback**: se il portale non è raggiungibile programmaticamente o il
  formato della tabella cambia (parsing fallisce), il job termina in
  `FAILED`/`DEAD_LETTER` (stesso meccanismo di retry/backoff già esistente in
  `src/lib/jobs/worker.ts`) e l'ADMIN viene messo in condizione di caricare
  manualmente un file (stesso modello `SpeedRegistrySnapshot`, ma
  `fetchMethod: MANUAL_UPLOAD`, `uploadedById` valorizzato) — stessa forma
  dati, stesso meccanismo di diff, solo l'origine cambia. Nessuna verifica
  automatica di correttezza del file caricato oltre al parsing (mai fidarsi
  ciecamente di un file caricato senza validazione di formato, ma la
  responsabilità del contenuto resta umana in questo percorso).
- **Permessi**: proposto un nuovo permesso granulare
  `enforcement:manage-registry-sync` (solo `ADMIN`, coerente con la
  sensibilità dell'azione — un caricamento manuale errato altererebbe la base
  di confronto per tutte le pratiche) per il caricamento manuale e la
  consultazione dello storico snapshot/diff — aggiunta alla tabella permessi
  del §9.

## 8. Proposta UI

Nel dettaglio pratica: il pannello compare **dopo la sintesi operativa/blocco
"Attenzione richiesta"** (quando presente) e **prima della sezione "Dati
estratti" generica**, **solo** quando `applicability !== NOT_APPLICABLE`. Se
non applicabile: una singola riga compattissima ("Controllo velocità non
applicabile a questa tipologia di verbale."), coerente con l'indicazione del
brief e con il principio già seguito in FASE 8B di non riservare spazio a
sezioni vuote (`docs/UI-PORTING-REPORT.md:96-97`: *"Nessuna anomalia rilevata"
non occupa una card autonoma"*).

Quando applicabile, il pannello include (riusando i componenti già esistenti
dove possibile, non nuovi pattern visivi): stato verifica (badge, stesso
sistema di `Badge` già in uso); identificazione dispositivo e dati tecnici
(stessa griglia a 2 colonne di `ExtractedFieldCell`, parametrizzata su
`EnforcementDeviceField`); documentazione presente/mancante (lista compatta,
stesso stile badge "Mancante"/"Presente" già in uso); disclaimer visibile
**analogo a quello della reference** (obbligatorio, come richiesto dalle note
operative): *"Questo pannello verifica la presenza e la coerenza della
documentazione tecnica disponibile. Non esprime alcuna valutazione sulla
validità della sanzione né sull'esito di un eventuale ricorso."*

Azioni: "Conferma identificazione", "Correggi dispositivo", "Collega
documento", "Richiedi documentazione" (genera bozza — via `EmailDraft` come da
§6), "Segna per verifica tecnica", "Segna per verifica legale", "Conferma
dati" — tutte reali (chiamano un endpoint, non semplici link di scorrimento,
diversamente dal punto 3.3.5 dell'audit UX per le azioni rapide generiche).

La "Prossima azione" del pannello laterale generale (`recommended-action.ts`)
va estesa per includere anche i blocker di questo modulo (es. "Identifica il
dispositivo", "Completa la matricola", "Collega il certificato di taratura",
"Richiedi i documenti mancanti", "Invia a verifica legale") — stessa funzione
già esistente, solo più sorgenti di `blockers` in input, **nessuna nuova
logica di business**, coerente con come funziona oggi per gli altri blocker
(campi mancanti, responsabile assente, ecc.).

## 9. Proposta permessi — richiede una decisione di prodotto

Ruoli reali confermati: `ADMIN, OPERATIONS, ACCOUNTING, COMMERCIAL, READ_ONLY`
(flat, nessun "responsabile" distinto dagli operativi). La proposta del brief
(operatore conferma/corregge; responsabile richiede documenti/avanza; ruolo
competente/admin invia a verifica legale; nessuno invia email senza
approvazione) **non mappa 1:1** sui ruoli esistenti — non esiste oggi un ruolo
"responsabile" separato da `OPERATIONS`.

**Proposta**: estendere i permessi granulari già presenti (`case:read`,
`case:write`, `user:manage`, `settings:manage` — `src/lib/auth/rbac.ts:1-16`)
con tre nuovi permessi dedicati, invece di introdurre nuovi ruoli:

```
"enforcement:confirm"              // confermare/correggere dati e documenti del modulo
"enforcement:request-documents"    // generare/approvare una richiesta documentazione (EmailDraft)
"enforcement:legal-escalate"       // segnare per verifica legale
"enforcement:manage-registry-sync" // caricamento manuale di fallback + consultazione storico snapshot registro MIT (§7bis)
```

Proposta di assegnazione (**da confermare esplicitamente con l'utente, non
implementata**):

| Ruolo | `enforcement:confirm` | `enforcement:request-documents` | `enforcement:legal-escalate` | `enforcement:manage-registry-sync` |
|---|---|---|---|---|
| `ADMIN` | sì | sì | sì | sì |
| `OPERATIONS` | sì | sì | no | no |
| `ACCOUNTING` | no | no | no | no |
| `COMMERCIAL` | no | no | no | no |
| `READ_ONLY` | no | no | no | no |

`enforcement:manage-registry-sync` è limitato ad `ADMIN`: un caricamento
manuale errato del fallback altererebbe la base di confronto usata per
**tutte** le pratiche (non solo una), quindi merita la stessa cautela già
riservata alle azioni amministrative generali (`settings:manage`).

Nessun invio automatico di email in nessun caso (invariante 2/3 di CLAUDE.md,
non negoziabile) — "richiesta documenti" resta sempre una bozza `EmailDraft`
soggetta ad approvazione umana esplicita, mai un invio diretto.

**Perché è "richiede una decisione di prodotto" e non solo tecnica**: la
tabella sopra è una proposta ragionevole ma arbitraria — l'utente potrebbe
voler distinguere ulteriormente `ACCOUNTING`/`COMMERCIAL` (che oggi hanno
comunque `case:write` generico) o introdurre davvero un ruolo "responsabile"
più ampio, che avrebbe conseguenze anche fuori da questo modulo.

## 10. Rischi

1. **Deriva verso conclusioni legali improprie**: mitigato da enum vincolati
   (mai testo libero per gli stati), Zod server-side, e assenza totale di
   regole/fonti legali hardcoded nel codice (a differenza del mock reference,
   si veda §3).
2. **Confusione tra "trovato nel registro" e "sanzione valida"**: ora che il
   registro MIT è una fonte reale integrata (§7bis), il rischio si sposta da
   "fonte inesistente spacciata per verificata" a "risultato del confronto
   interpretato come giudizio di validità". Mitigazione: `registryMatch` è
   tipizzato solo come `MATCH`/`MISMATCH`/`NOT_FOUND`/`NOT_CONSULTED`, mai
   collegato automaticamente a `EnforcementVerificationState` senza revisione
   umana — un `MISMATCH` significa "il dato dichiarato non corrisponde al
   registro consultato in data X", non "la multa è invalida" (potrebbe essere
   un errore di trascrizione, un aggiornamento non ancora registrato, o un
   dispositivo genuinamente non conforme — solo un umano/legale può concludere
   quale). Resta comunque uno stato sempre disponibile (`TO_BE_VERIFIED`) per
   i casi non ancora consultati.
3. **Fragilità dell'integrazione stessa** (nuovo, emerso dalla verifica
   operativa in §7bis): nessuna API/CSV ufficiale, solo scraping di una
   tabella HTML — un cambio di formato del portale rompe il parsing senza
   preavviso. Mitigazione: fallback a caricamento manuale già previsto nel
   design (§7bis), `payloadHash`/`rawStorageKey` conservano l'evidenza grezza
   per ispezione in caso di parsing sospetto, retry/backoff/dead-letter già
   nativi del job queue esistente.
3. **RBAC**: estendere permessi granulari senza nuovi ruoli rischia di
   concedere "richiesta documenti"/"verifica legale" a chi non dovrebbe finché
   la tabella al §9 non è confermata esplicitamente dall'utente.
4. **Eredità dei P0 esistenti**: se il modulo riusa il pattern "conferma" di
   `CaseField` (come proposto) **senza** portare anche il fix di P0 #1
   (`docs/UX-AUDIT-2026-07.md`), erediterebbe lo stesso bug di validazione sul
   nuovo `EnforcementDeviceField`. Stesso discorso per "richiesta documenti" se
   implementata come `EmailDraft`: va ereditato anche il fix di P0 #2.
   **Per questo l'ordine di lavoro proposto (§12) mette Fase B prima di Fase
   E.**
5. **Isolamento tenant non applicabile nel modello attuale**: se in futuro
   l'app diventasse multi-tenant, questo modulo (come tutto il resto)
   andrebbe rivisto — non è un rischio specifico del modulo, ma dell'intera
   architettura, quindi non risolvibile solo qui.

## 11. Cosa NON includere in questa v1 (esplicitamente fuori scope)

- Nessun registro dispositivi riutilizzabile cross-pratica (`EnforcementDevice`
  come entità condivisa) — domanda aperta nel brief, rimandata.
- **Aggiornamento rispetto alla prima stesura**: l'integrazione con il
  registro MIT (`velox.mit.gov.it/dispositivi`) **è ora inclusa in v1** (§7bis),
  su indicazione esplicita dell'utente e dopo verifica che si tratti di una
  fonte reale — non è più esclusa come "banca dati esterna inesistente".
  Restano **esclusi**: qualunque altra fonte esterna oltre a questo unico
  registro (nessuna aggregazione multi-fonte in v1); un motore di regole
  legali versionate (`LegalRuleRecord`, si veda §7); un'API/export ufficiale
  che non esiste (l'integrazione si basa su parsing HTML, con i rischi
  descritti al §7bis/§10).
- Nessun concetto di tenant/organizzazione introdotto solo per questo modulo.
- Nessuna conclusione automatica su approvazione vs omologazione del
  dispositivo, o su qualunque altra distinzione giuridica, senza una decisione
  legale esplicita e una fonte autorevole indicata dall'utente — **incluso il
  confronto con il registro MIT**: un `MISMATCH` non implica automaticamente
  nulla sulla validità della sanzione (si veda §10, rischio #2).
- Nessun nuovo ruolo utente (si propone di estendere permessi, non ruoli — si
  veda §9).

## 12. Ordine di lavoro consigliato

1. **Fase B** — fix dei 3 P0 esistenti (`docs/UX-AUDIT-2026-07.md`), branch
   `fix/p0-validazioni`. Prerequisito per non ereditare gli stessi bug nel
   nuovo modulo.
2. **Fase C** — tuning UX minore del dettaglio pratica (sidebar sticky,
   etichette, cronologia email) — indipendente ma utile prima di aggiungere un
   nuovo pannello alla stessa pagina.
3. **Fase D** — questa specifica, da discutere e approvare esplicitamente.
4. **Fase E** — implementazione, branch `feature/autovelox`, solo dopo
   approvazione: migrazione Prisma (5 modelli — inclusi `SpeedRegistrySnapshot`
   e i 4 enum di dominio più `SpeedRegistryFetchMethod`/
   `EnforcementRegistryMatchState` — vedi §7/§7bis); nuovo `JobType.SYNC_SPEED_DEVICE_REGISTRY`
   con pattern di auto-rischedulazione giornaliera (§7bis); estensione pipeline
   di estrazione/classificazione per popolare `EnforcementDeviceCheck`/
   `EnforcementDeviceField`; nuovo pannello UI nel dettaglio pratica; estensione
   `recommended-action.ts` per i nuovi blocker; nuovi permessi (4, incluso
   `enforcement:manage-registry-sync`) in `src/lib/auth/rbac.ts`; nuove
   `AuditAction` (es. `ENFORCEMENT_DEVICE_CONFIRMED`,
   `ENFORCEMENT_DOCUMENT_LINKED`, `ENFORCEMENT_LEGAL_ESCALATED`,
   `SPEED_REGISTRY_SYNCED`, `SPEED_REGISTRY_MANUAL_UPLOAD`).

## 13. File impattati (stima, solo per Fase E — nessuno toccato in questa sessione)

- `prisma/schema.prisma` — 5 nuovi modelli (inclusi `SpeedRegistrySnapshot`),
  6 nuovi enum, relazioni inverse su `Case`, `ExtractionRun`, `User`,
  `Attachment`; nuova migrazione in `prisma/migrations/`.
- `src/lib/auth/rbac.ts` — 4 nuovi permessi granulari.
- `src/lib/jobs/queue.ts` / `src/generated/prisma` (enum `JobType`) — nuovo
  tipo `SYNC_SPEED_DEVICE_REGISTRY`.
- Nuovo `src/lib/enforcement/registry-sync.ts` (o percorso analogo) —
  download/parsing tabella HTML, calcolo hash/diff, salvataggio snapshot;
  nessuna dipendenza da un provider LLM.
- Nuova route per il caricamento manuale di fallback (es.
  `src/app/api/enforcement/registry-snapshot/route.ts`, protetta da
  `enforcement:manage-registry-sync`).
- `docs/SPEC.md` — nuova sezione dedicata (dopo §10 "Dettaglio pratica" o come
  sotto-sezione di §5 "Modello di dominio"), come richiesto dalle note
  operative se la specifica viene approvata — dovrà includere anche la
  citazione normativa precisa verificata al §7bis.
- `CLAUDE.md` — solo se emergono nuovi invarianti specifici (es. "il modulo
  autovelox non esprime mai una valutazione di validità della sanzione" o "il
  confronto con il registro MIT non implica un giudizio di validità") da
  aggiungere alla lista esistente — da valutare in sede di approvazione, non
  anticipato qui.
- Nuovi file applicativi (pipeline, componenti UI, route API, test) — da
  elencare puntualmente nel piano di implementazione della Fase E, non in
  questa bozza di specifica.

## 14. Piano di test (per la Fase E)

Riprendendo l'elenco del brief (§15), mappato sui pattern di test già
esistenti nel repo (Vitest, `tests/unit`/`tests/integration`/`tests/e2e`,
`fileParallelism: false` per condivisione del DB di test):

- **Unit**: derivazione `EnforcementVerificationState` da conteggi
  campi/documenti mancanti/in conflitto (analogo a `tests/unit/rules/engine.test.ts`);
  mappatura applicabilità da tipo violazione/testo verbale; parsing della
  tabella HTML del registro MIT contro una fixture statica salvata nel repo
  (mai una chiamata di rete reale nei test — coerente con `EMAIL_PROVIDER=mock`/
  `LLM_PROVIDER=mock`, stesso principio "tutto dimostrabile senza dipendenze
  esterne reali" di CLAUDE.md); calcolo `payloadHash`/diff tra due fixture.
- **Integration**: endpoint conferma `EnforcementDeviceField` (campo vuoto
  rifiutato — **con il fix di P0 #1 già applicato e testato**; campo
  valorizzato confermato; audit log scritto); endpoint documenti (collega
  allegato, segna mancante/richiesto); permessi (`enforcement:confirm`/
  `request-documents`/`legal-escalate`/`manage-registry-sync` per ruolo,
  analogo a `tests/unit/rbac.test.ts` + `tests/integration/auth-guard.test.ts`);
  job `SYNC_SPEED_DEVICE_REGISTRY` — auto-rischedulazione con lo stesso
  `idempotencyKey` non crea job duplicati (stesso test-pattern di
  `tests/integration/job-queue.test.ts`); fallback a `MANUAL_UPLOAD` quando il
  parsing programmatico fallisce; `registrySnapshotId` correttamente
  registrato su `EnforcementDeviceCheck` dopo un confronto.
- **E2E** (pattern di `tests/e2e/fine-review-and-draft.test.ts`, il precedente
  più vicino già esistente — multa PEC che raggiunge priorità critica e genera
  una bozza): eccesso di velocità → applicabile, dispositivo identificato dopo
  conferma umana; ZTL → non applicabile, pannello compatto; dispositivo non
  identificabile → stato `TO_BE_IDENTIFIED`; certificato di taratura mancante
  → `DOCUMENTATION_INCOMPLETE`; documenti completi → `DOCUMENTED_VERIFICATION_COMPLETE`;
  dati in conflitto → `DATA_CONFLICT`; dispositivo non presente nello snapshot
  registro consultato → `registryMatch: NOT_FOUND`, mai tradotto
  automaticamente in un giudizio di validità (assert esplicito che nessun
  campo di stato contenga testo libero generato dal modello); richiesta
  documenti genera un `EmailDraft` reale in `PENDING_APPROVAL` (mai inviato);
  READ_ONLY non può confermare/richiedere/segnalare/caricare uno snapshot
  manuale; audit log per ogni transizione, incluse `SPEED_REGISTRY_SYNCED`/
  `SPEED_REGISTRY_MANUAL_UPLOAD`; nessuna conclusione legale automatica
  verificata a livello di assert.
- **Tenant isolation**: esplicitamente **non applicabile** nel modello
  attuale (si veda §2/§11) — non testabile perché il concetto non esiste
  nell'app; da riconsiderare solo se l'architettura diventasse multi-tenant.
