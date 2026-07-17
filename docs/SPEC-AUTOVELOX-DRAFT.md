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
| P2 Estrazione | Nuovo `EnforcementDeviceField` (stessa forma di `CaseField`, vedi §7), popolato da un run tracciato analogo a `ExtractionRun`. |
| P3 Valutazione preliminare | Funzione deterministica pura (niente LLM per la valutazione, solo per l'estrazione) — analoga a `rules.ts` della reference ma **senza** costanti legali hardcoded: deriva `EnforcementVerificationState` solo da conteggi di campi/documenti mancanti/in conflitto, mai da una data o un decreto specifico scritto nel codice. |
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
- **Niente equivalente di `LegalRuleRecord`/`SpeedRegistrySnapshot` della
  reference in v1**: per costruzione (§13 del brief) non esiste ancora una
  fonte esterna reale da interrogare — introdurre un modello per una fonte
  che non esiste sarebbe overengineering. Se in futuro si integrasse un
  registro esterno reale, andrà introdotto allora, con provenienza/hash/data
  di consultazione esplicite (stesso principio di `SpeedRegistrySnapshot`
  della reference, adattato).

Migrazione Prisma singola, additiva (nessun `ALTER` su tabelle esistenti oltre
alle nuove relazioni inverse su `Case`/`ExtractionRun`/`User`/`Attachment`).

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
"enforcement:confirm"           // confermare/correggere dati e documenti del modulo
"enforcement:request-documents" // generare/approvare una richiesta documentazione (EmailDraft)
"enforcement:legal-escalate"    // segnare per verifica legale
```

Proposta di assegnazione (**da confermare esplicitamente con l'utente, non
implementata**):

| Ruolo | `enforcement:confirm` | `enforcement:request-documents` | `enforcement:legal-escalate` |
|---|---|---|---|
| `ADMIN` | sì | sì | sì |
| `OPERATIONS` | sì | sì | no |
| `ACCOUNTING` | no | no | no |
| `COMMERCIAL` | no | no | no |
| `READ_ONLY` | no | no | no |

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
2. **Fonti esterne inesistenti percepite come verificate**: mitigato da uno
   stato sempre disponibile (`TO_BE_VERIFIED`) e dal fatto che, per costruzione
   (§13 del brief), la v1 non integra alcuna banca dati esterna reale — solo
   verbale, email, allegati, documenti caricati, dati confermati
   dall'operatore.
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
- Nessuna integrazione con una banca dati esterna reale (MIT o altro) — non ne
  esiste una interrogabile automaticamente, per esplicita cautela del brief.
- Nessun concetto di tenant/organizzazione introdotto solo per questo modulo.
- Nessuna conclusione automatica su approvazione vs omologazione del
  dispositivo, o su qualunque altra distinzione giuridica, senza una decisione
  legale esplicita e una fonte autorevole indicata dall'utente.
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
   approvazione: migrazione Prisma (3 modelli + 2 enum di dominio +
   `EnforcementCheckApplicability`/`EnforcementVerificationState`/
   `EnforcementDocumentType`/`EnforcementDocumentStatus`); estensione pipeline
   di estrazione/classificazione per popolare `EnforcementDeviceCheck`/
   `EnforcementDeviceField`; nuovo pannello UI nel dettaglio pratica; estensione
   `recommended-action.ts` per i nuovi blocker; nuovi permessi in
   `src/lib/auth/rbac.ts`; nuove `AuditAction` (es. `ENFORCEMENT_DEVICE_CONFIRMED`,
   `ENFORCEMENT_DOCUMENT_LINKED`, `ENFORCEMENT_LEGAL_ESCALATED`).

## 13. File impattati (stima, solo per Fase E — nessuno toccato in questa sessione)

- `prisma/schema.prisma` — 3 nuovi modelli, 4 nuovi enum, relazioni inverse su
  `Case`, `ExtractionRun`, `User`, `Attachment`; nuova migrazione in
  `prisma/migrations/`.
- `src/lib/auth/rbac.ts` — 3 nuovi permessi granulari.
- `docs/SPEC.md` — nuova sezione dedicata (dopo §10 "Dettaglio pratica" o come
  sotto-sezione di §5 "Modello di dominio"), come richiesto dalle note
  operative se la specifica viene approvata.
- `CLAUDE.md` — solo se emergono nuovi invarianti specifici (es. "il modulo
  autovelox non esprime mai una valutazione di validità della sanzione") da
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
  mappatura applicabilità da tipo violazione/testo verbale.
- **Integration**: endpoint conferma `EnforcementDeviceField` (campo vuoto
  rifiutato — **con il fix di P0 #1 già applicato e testato**; campo
  valorizzato confermato; audit log scritto); endpoint documenti (collega
  allegato, segna mancante/richiesto); permessi (`enforcement:confirm`/
  `request-documents`/`legal-escalate` per ruolo, analogo a
  `tests/unit/rbac.test.ts` + `tests/integration/auth-guard.test.ts`).
- **E2E** (pattern di `tests/e2e/fine-review-and-draft.test.ts`, il precedente
  più vicino già esistente — multa PEC che raggiunge priorità critica e genera
  una bozza): eccesso di velocità → applicabile, dispositivo identificato dopo
  conferma umana; ZTL → non applicabile, pannello compatto; dispositivo non
  identificabile → stato `TO_BE_IDENTIFIED`; certificato di taratura mancante
  → `DOCUMENTATION_INCOMPLETE`; documenti completi → `DOCUMENTED_VERIFICATION_COMPLETE`;
  dati in conflitto → `DATA_CONFLICT`; richiesta documenti genera un
  `EmailDraft` reale in `PENDING_APPROVAL` (mai inviato); READ_ONLY non può
  confermare/richiedere/segnalare; audit log per ogni transizione; nessuna
  conclusione legale automatica verificata a livello di assert (nessun testo
  libero generato dal modello nei campi di stato).
- **Tenant isolation**: esplicitamente **non applicabile** nel modello
  attuale (si veda §2/§11) — non testabile perché il concetto non esiste
  nell'app; da riconsiderare solo se l'architettura diventasse multi-tenant.
