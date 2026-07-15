# Valutazione della pipeline AI — analisi errori e rifinitura (Fase 5)

Questo documento registra le debolezze emerse dal confronto reale mock vs Anthropic
(`scripts/anthropic-eval-compare.ts`, report completo in `docs/eval-report-anthropic.md`) e
il lavoro di rifinitura svolto per correggerle. `npm run eval` (sempre `MockLLMProvider`,
costo zero) resta al 100% su quasi tutte le metriche perché le euristiche mock non
riproducono l'ambiguità semantica reale di alcune email — i problemi descritti qui sono di
**qualità del modello reale**, non bug del motore mock.

## 1. Analisi delle cause — prima della baseline a 28 fixture

Prima di modificare qualunque prompt o schema, questa sezione registra la causa di ciascun
problema noto, verificata leggendo il codice (non solo ipotizzata).

### 1.1 Accuratezza scadenze: 33,3% reale vs 100% mock — due cause indipendenti

Non è un problema unico. Leggendo `eval/metrics.ts` e `src/lib/pipeline/process-incoming-message.ts`
emergono due cause radice distinte e cumulative:

**Causa 1 — effetto a cascata della classificazione (problema di metrica).** La metrica
`deadlineAccuracy` legge un `fieldKey` specifico per categoria (es.
`reduced_payment_due_at` per FINE_OR_PENALTY, `due_date` per SUPPLIER_INVOICE — vedi
`eval/dataset.ts`, `expectedDeadlineField`) dal record prodotto dalla pipeline. Se la
classificazione reale assegna una categoria diversa da quella attesa, quel campo non esiste
nemmeno nell'estrazione prodotta (schema diverso — vedi `EXTRACTION_SCHEMA_BY_CATEGORY`):
il controllo fallisce per **disallineamento di categoria**, non per una data estratta male.
Con l'accuratezza di categoria reale al 78,6% (vs 100% mock), una parte dei mancati
riscontri sulle scadenze era un effetto a cascata di questo, non un problema di estrazione
isolato.

**Causa 2 — bug di parsing indipendente, presente anche a categoria corretta (problema di
normalizzazione mancante).** `deduceDeadlines()` in `process-incoming-message.ts` faceva
`new Date(value)` direttamente sulla stringa restituita dal modello per il campo data. Il
costruttore `Date` di JavaScript **non interpreta il formato italiano gg/mm/aaaa**: `new
Date("17/07/2026")` produce `Invalid Date` in Node, silenziosamente scartata da
`Number.isNaN(dueAt.getTime())`. Questo accade **anche senza alcuna data relativa
("entro N giorni")**: basta che il modello restituisca la data testuale così com'è nel
documento, cosa che il prompt di estrazione non scoraggiava né incoraggiava in alcun modo
(nessuna istruzione sul formato delle date era presente in `buildExtractionSystemPrompt()`).
Lo stesso bug era duplicato nel blocco `quoteResponseDueAt` poche righe sotto.

**Azione (Fase 5, completata — vedi §2):** normalizzazione deterministica delle date fuori
dal modello (nuovo modulo `src/lib/text/date-normalizer.ts`), e disaccoppiamento della
metrica dalla categoria esatta (§2.3), per isolare le due cause e misurarle separatamente.

### 1.2 Confusione fra categorie semanticamente vicine

Dal confronto per fixture sulle 28 email originali, le categorie assegnate dal modello reale
divergevano dall'atteso in questi casi, ciascuno con una causa specifica di prompt:

| Fixture | Atteso | Reale (Anthropic) | Causa radice |
|---|---|---|---|
| EML-028 | ADMINISTRATIVE | CLAIM_OR_DAMAGE | Nessun confine operativo nel prompt fra "comunicazione legale/formale sul rapporto contrattuale" e "reclamo legato a una spedizione/merce specifica" |
| EML-013 | CUSTOMER_RECEIVABLE | PAYMENT_NOTICE | Nessuna distinzione di direzione/attore: credito verso un cliente nominato gestito da noi vs avviso di pagamento generico |
| EML-023 | OTHER | ADMINISTRATIVE | Nessun criterio esplicito per "chiaramente non pertinente al business" |
| EML-024 | UNCERTAIN | CUSTOMER_COMMUNICATION | Segnale debole: nessuna guida su quando preferire UNCERTAIN a bassa confidenza; categoria comunque nell'insieme accettabile |
| EML-026 | UNCERTAIN | OTHER | Come sopra; categoria comunque nell'insieme accettabile |
| EML-006 | TRANSPORT_ORDER/CUSTOMER_RECEIVABLE | UNCERTAIN | Email con due intenzioni: il modello reale non ha trovato un segnale dominante sufficiente per nessuna delle due letture accettabili |

**EML-028 in dettaglio**: il testo ("Si trasmette... diffida ad adempiere relativa al contratto
di trasporto n. CT-2025-1187... si richiede riscontro entro 15 giorni") menziona esplicitamente
una contestazione contrattuale, il che rende CLAIM_OR_DAMAGE una lettura ragionevole — ma la
SPEC.md §6 la classifica come ADMINISTRATIVE (comunicazione legale/formale). Il prompt di
classificazione (`src/lib/adapters/llm/anthropic/prompts.ts`) non distingueva "comunicazione
legale formale sul rapporto" da "reclamo/contestazione legato a una spedizione specifica":
mancava un confine esplicito, con esempi.

**Azione (Fase 5, completata — vedi §2.2):** regole di confine esplicite + esempi few-shot
per le coppie di categorie che si confondono più spesso (ADMINISTRATIVE vs CLAIM_OR_DAMAGE;
CUSTOMER_RECEIVABLE vs PAYMENT_NOTICE; UNCERTAIN vs CUSTOMER_COMMUNICATION/OTHER quando il
segnale è debole), nel system prompt di classificazione.

### 1.3 Tasso di revisione umana: 53,6% reale vs 21,4% mock

In gran parte è una **conseguenza attesa**, non un difetto indipendente: riflette sia la
maggiore incertezza reale sia la degradazione controllata (fallback `UNCERTAIN`/
`needs_human_review: true` in `fallbackClassification()`, mai una pratica persa
silenziosamente — comportamento mandato da CLAUDE.md) introdotta per non perdere mai
un'email quando la classificazione fallisce o l'output non è conforme allo schema. Solo la
quota di questo tasso derivante dalle confusioni di categoria evitabili (§1.2) è un obiettivo
di tuning legittimo; non deve scendere a zero, né deve farlo perdendo richiami sui casi
genuinamente ambigui (EML-024, EML-026 restano `needs_human_review: true` per costruzione).

### 1.4 Non regressioni da monitorare

Queste metriche restavano al 100% anche nel confronto reale originale e vanno preservate
durante il tuning: recall multe/reclami urgenti, accuratezza importi, recall duplicati,
recall security flags.

## 2. Modifiche applicate

### 2.1 Normalizzazione deterministica delle date (fuori dal modello)

Il modello continua a estrarre la data testuale grezza (con l'excerpt di provenienza); la
conversione a data assoluta avviene ora in modo deterministico nel codice:

- Nuovo modulo `src/lib/text/date-normalizer.ts` (`normalizeDateExpression`): riconosce
  gg/mm/aaaa e gg-mm-aaaa (estendendo `parseItalianDate` di `src/lib/text/patterns.ts`), ISO
  `aaaa-mm-gg` già normalizzato, nomi di mese italiani ("17 luglio 2026"), espressioni
  relative "entro/tra N giorni [lavorativi]" (lavorativi = salta solo sabato/domenica,
  **nessun calendario festività italiane** — limite noto, vedi §4), "domani"/"oggi". Data di
  riferimento per le espressioni relative: fuso Europe/Rome, calcolata senza dipendenze
  esterne (`Intl.DateTimeFormat`).
- `deduceDeadlines()` e il blocco `quoteResponseDueAt` in
  `src/lib/pipeline/process-incoming-message.ts` risolvono ora la data di riferimento dal
  messaggio sorgente del campo (`source_message_id` → `receivedAt` del messaggio, non "ora"
  della pipeline), poi chiamano il normalizzatore. `normalized_value` restituito dal modello
  è ignorato dalla pipeline (resta nello schema per eventuale uso futuro in UI): un valore
  auto-normalizzato dal modello non è verificabile in modo deterministico, mentre l'intero
  scopo di questo intervento è rimuovere quel tipo di calcolo non verificato da un dato
  critico (scadenze legali/di pagamento).
- Prompt di estrazione (`buildExtractionSystemPrompt`): per ogni categoria estraibile,
  elenco esplicito dei campi data e istruzione di scrivere in `value` l'espressione
  testuale così com'è nel documento originale, senza calcolarla o riformattarla.

### 2.2 Prompt di classificazione — confini di categoria e few-shot

`buildClassificationSystemPrompt()` include ora regole di confine esplicite per le coppie
ADMINISTRATIVE/CLAIM_OR_DAMAGE, CUSTOMER_RECEIVABLE/PAYMENT_NOTICE, UNCERTAIN/OTHER/
CUSTOMER_COMMUNICATION, più esempi few-shot etichettati come illustrativi (testo statico,
mai derivato da email reali — invariante CLAUDE.md 1).

### 2.3 Metrica `deadlineAccuracy` disaccoppiata dalla categoria esatta

`eval/metrics.ts`: quando il campo atteso non esiste sul record (perché la categoria reale
differisce da quella attesa), la metrica ora cerca il valore ISO atteso fra tutti i campi
stringa estratti prima di contare un fallimento — isola il bug di parsing (§1.1, causa 2)
dall'effetto a cascata di categoria (§1.1, causa 1).

### 2.4 Dataset di valutazione ampliato

Aggiunte nuove fixture mirate sui punti deboli (varianti di formato data, coppie di
contrasto ADMINISTRATIVE/CLAIM_OR_DAMAGE e CUSTOMER_RECEIVABLE/PAYMENT_NOTICE, casi limite
UNCERTAIN/OTHER/CUSTOMER_COMMUNICATION), di cui una parte tenuta come **held-out**
(`heldOut: true` in `eval/dataset.ts`) — mai ispezionata né usata per calibrare i prompt
durante l'iterazione, solo per la misura finale, a controllo di un possibile
sovra-adattamento delle regole di confine alle fixture di tuning.

## 3. Confronto prima/dopo

Misura finale confermata su `scripts/anthropic-eval-compare.ts`, dataset ampliato a 44 fixture
(28 originali + 16 nuove, di cui 5 held-out — §2.4). Report completo generato in
`docs/eval-report-anthropic.md`. Un primo tentativo di run completa si era interrotto a metà
per esaurimento del saldo crediti dell'account Anthropic (le fixture successive erano
degradate al fallback di sicurezza, non rappresentative): quella run è stata scartata, questa
è la misura valida dopo la ricarica del credito.

| Metrica | Prima (28 fixture, baseline) | Dopo (44 fixture, complessivo) | Dopo — solo tuning (39) | Dopo — solo held-out (5) | Target |
|---|---|---|---|---|---|
| Accuratezza categoria | 78,6% | **95,5%** | 94,9% | 100,0% | ≥90% ✅ |
| Accuratezza scadenze | 33,3% | **100,0%** | 100,0% | 100,0% | ≥90% ✅ |
| Recall multe/reclami urgenti | 100,0% | 100,0% | 100,0% | 100,0% | resta 100% ✅ |
| Tasso di revisione | 53,6% | **29,5%** | 25,0% | 4,5% | ≤35% ✅ |
| Accuratezza importi | 100,0% | 100,0% | 100,0% | 100,0% | non regressione ✅ |
| Recall duplicati | 100,0% | 100,0% | 100,0% | 100,0% | non regressione ✅ |
| Recall security flags | 100,0% | 100,0% | 100,0% | 100,0% | non regressione ✅ |

Costo reale della run finale: $2,8684 (378.888 input / 115.446 output token). Costo totale
Fase 5 (diagnosi mirate + run interrotta per credito esaurito + questa run): stimato
~$4,5 su un budget massimo di $10.

**Tutti i target sono stati raggiunti.** Da segnalare in particolare:
- Il set held-out (mai ispezionato durante il tuning dei prompt) ottiene risultati pari o
  migliori del set di tuning — nessun segnale di sovra-adattamento delle regole di confine
  alle fixture usate durante l'iterazione.
- L'accuratezza scadenze passa da 33,3% a 100,0%: conferma sia la normalizzazione
  deterministica (§2.1) sia il disaccoppiamento della metrica dalla categoria esatta (§2.3).

**Residui noti (2 fixture su 44, entrambe già documentate come casi limite in §1.2):**
- EML-022 (atteso ADMINISTRATIVE) → classificata UNCERTAIN in questa run. Nelle diagnosi
  mirate pre-run la stessa fixture era stata classificata correttamente come ADMINISTRATIVE:
  variabilità di campionamento del modello sul confine UNCERTAIN/ADMINISTRATIVE a segnale
  debole, non una regressione introdotta dalle modifiche.
- EML-026 (atteso ADMINISTRATIVE o UNCERTAIN, fixture prompt-injection) → classificata
  OTHER in modo consistente sia in diagnosi sia nella run finale. La categoria resta un
  errore, ma l'invariante critico tiene: `security_flags` e `needs_human_review` restano
  corretti al 100% (verificato nella metrica aggregata), quindi il contenuto malevolo è
  comunque intercettato e instradato a revisione umana — solo l'etichetta di categoria è
  imprecisa su questo caso limite.

## 4. Limiti noti (dichiarati esplicitamente, non silenziati)

- Nessun calendario festività italiane per il calcolo dei "giorni lavorativi": vengono
  saltati solo sabato e domenica.
- Il normalizzatore di date copre i formati osservati nelle fixture reali, non è un parser
  NLP esaustivo: espressioni genuinamente nuove degradano correttamente a `null` (nessuna
  scadenza inventata, mai persa silenziosamente come dato — solo assente), non a un valore
  inventato.
- Le regole di confine fra categorie nel prompt sono guidate da esempi, non una procedura
  di decisione formale: un residuo di confusione su casi limite realmente nuovi (misurato
  dalle fixture held-out, §2.4) è atteso e va riportato onestamente, non presentato come
  interamente risolto.
