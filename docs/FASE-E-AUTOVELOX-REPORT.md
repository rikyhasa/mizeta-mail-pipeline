# FASE E — Modulo verifica autovelox + indicatore ricorso: report finale

Riferimento: `docs/SPEC.md` §10bis (versione consolidata), `docs/SPEC-AUTOVELOX-DRAFT.md`
(bozza completa approvata, §1-16), `CLAUDE.md` invariante 9. Branch `feature/autovelox`,
tappe 0-7, commit `3622319`…`f9f7ca6`. Ogni voce di questo report è stata verificata
leggendo il codice reale o eseguendo i test al termine della Tappa 7, non a memoria.

## 1. Cosa è stato costruito

Un modulo che, per le pratiche di categoria `FINE_OR_PENALTY`, identifica il tipo di
dispositivo di rilevamento della velocità, ne verifica i dati tecnici e la documentazione
di supporto contro un registro esterno consultabile (MIT), e affianca un indicatore
operativo — mai un giudizio — sulla convenienza di proporre un ricorso. Otto tappe:

| Tappa | Contenuto | Commit |
|---|---|---|
| 0 | Aggiornamento `docs/SPEC.md` (§10bis) e `CLAUDE.md` (invariante 9) con la specifica approvata | `3622319` |
| 1 | Fondamenta dati: 5 nuovi modelli Prisma, 9 nuovi enum, estensione `RuleSettings`, permessi granulari | `9ef1831` |
| 2 | Calcolo puro dell'indicatore ricorso (due assi + combinazione → indicazione) | `61ebaf8` |
| 3 | Pannello UI indicatore ricorso + endpoint di registrazione decisione | `cb2d84e` |
| 4 | Passaggio LLM di analisi dispositivo (mock + Anthropic), persistenza | `707c12f` |
| 5 | Sync giornaliero registro MIT (job auto-rischedulante) + fallback manuale | `73bfbc6` |
| 6 | Pannello UI "Verifica autovelox" + 6 endpoint azione + blocker/CTA | `fdfc8d5` |
| 7 | Seed sintetico (6 scenari) + verifica end-to-end + fix `notification_date`/`points` | `f9f7ca6` |

**Dimensione**: 76 file toccati, ~6.500 righe (codice + test + doc), rispetto al punto di
partenza (`dd1479b`, prima dell'audit FASE 9).

## 2. Checklist rispetto alla specifica approvata

Stato: **Completo** (funziona come richiesto, verificabile), **Simulato** (esiste con una
limitazione nota e documentata), **Mancante** (non esiste).

### 2.1 Modulo verifica autovelox (§4-§10 di SPEC-AUTOVELOX-DRAFT.md)

- **Identificazione dispositivo — Completo.** `EnforcementCheckApplicability` (7 valori),
  passaggio LLM dedicato (`analyzeEnforcementDevice`, mai un'unica chiamata con
  l'estrazione principale), euristica mock reale (pattern matching genuino, verificato con
  13 unit test su tutti i rami: fisso/mobile/tutor/telelaser/non applicabile/da
  identificare), implementazione Anthropic con lo stesso `SECURITY_INSTRUCTION`
  anti-prompt-injection delle altre chiamate.
- **Dati tecnici del dispositivo — Completo.** `EnforcementDeviceField` (stessa forma di
  `CaseField`: valore/fonte/confidenza/conferma), riusa l'infrastruttura di
  conferma/correzione già esistente (stesso componente `ExtractedFieldCell`, generalizzato
  con un `endpointBase` opzionale invece di duplicato).
- **Documentazione tecnica presente/mancante — Completo.** `EnforcementDocumentCheck`,
  5 tipi documento (allowlist), calcolati "a lettura" (nessuna riga creata eagerly dalla
  pipeline, solo al primo collegamento/richiesta) — azione "Collega documento" (solo
  allegati già presenti nella pratica, mai un upload diretto) e "Richiedi documentazione"
  (bozza `EmailDraft` deterministica, mai un invio automatico).
- **Confronto con il registro MIT — Simulato.** `EnforcementRegistryMatchState` esiste
  (MATCH/MISMATCH/NOT_FOUND/NOT_CONSULTED) e il pannello lo mostra correttamente, ma
  **nessuna logica di confronto automatico** fra `EnforcementDeviceField` e l'ultimo
  `SpeedRegistrySnapshot` è mai stata costruita: ogni controllo resta permanentemente
  `NOT_CONSULTED`. Non richiesto esplicitamente in nessuna tappa — un confronto
  dispositivo-per-dispositivo strutturato è una funzionalità a sé, non solo un campo del
  pannello.
- **Pannello UI — Completo.** "Verifica autovelox" nel dettaglio pratica, posizionato
  dopo la sintesi operativa e prima dei dati estratti generici, solo per `FINE_OR_PENALTY`;
  riga compatta "non applicabile" quando `applicability === NOT_APPLICABLE` o nessun
  controllo esiste — nessuna card vuota. Disclaimer obbligatorio e sempre visibile
  (invariante 9).
- **7 azioni reali (§8) — Completo.** Conferma identificazione / Correggi dispositivo
  (stesso endpoint, `PATCH .../enforcement/check`) · Conferma dati (per campo, stesso
  pattern di `CaseField`) · Collega documento · Richiedi documentazione · Segna per
  verifica tecnica · Segna per verifica legale — tutte chiamano un endpoint reale, mai un
  link di scorrimento; permesso verificato **lato server** in ogni endpoint (mai solo
  nascosto in UI), audit log per ciascuna.
- **Blocker "Prossima azione" — Completo.** 3 nuovi `CaseBlockerKind`
  (`enforcement_identify`/`enforcement_missing_fields`/`enforcement_missing_docs`), stessa
  fonte di verità già usata da `ClosurePanel`/`PATCH /api/cases/[id]/status`, nessuna nuova
  logica di business.
- **Registro MIT: sync + fallback — Completo.** Job `SYNC_SPEED_DEVICE_REGISTRY`
  auto-rischedulante (+24h), parsing HTML deterministico (mai LLM), diff
  added/removed/changed, niente snapshot duplicato quando l'hash non cambia. Fallback
  manuale via endpoint dedicato (`enforcement:manage-registry-sync`, solo ADMIN).
  **Simulato**: il fetcher reale (`SPEED_REGISTRY_FETCHER=real`) non è mai stato esercitato
  contro `velox.mit.gov.it` in questa sessione — nessuna chiamata di rete effettuata
  durante lo sviluppo; l'euristica di paginazione è generica e andrà validata al primo
  utilizzo reale.

### 2.2 Indicatore ricorso (§15 di SPEC-AUTOVELOX-DRAFT.md, §10bis di SPEC.md)

- **Calcolo a due assi — Completo.** `calculateAppealIndicator` (funzione pura, 15 unit
  test, validata contro i 3 esempi lavorati della specifica): asse documentale +
  asse economico, sempre mostrati separatamente, mai un unico numero composito.
- **Termini GdP/Prefetto — Completo** (era **rotto fino alla Tappa 7**: `notification_date`
  non esisteva nello schema di estrazione né nell'euristica, nonostante fosse già
  etichettato e consumato dal calcolatore — nessuna pratica reale poteva mai popolarlo.
  Corretto in Tappa 7, verificato con aritmetica reale end-to-end).
- **Peso punti patente per autista professionale — Completo** (stesso discorso: `points`
  era nello schema ma l'euristica lo restituiva sempre vuoto — corretto in Tappa 7).
  `driver_professional_cqc` resta — per esplicita richiesta dell'utente in Tappa 2 — **mai**
  estratto o dedotto dal modello: solo inseribile/confermabile da un operatore. Nessun
  endpoint dedicato esiste ancora per farlo (stesso gap segnalato per la documentazione
  autovelox in Tappa 3): nel seed dimostrativo è confermato direttamente via script,
  mai tramite un percorso UI reale.
- **Asse documentale — Simulato.** `deriveGenericDocumentaryStrength()` restituisce
  sempre `NONE` (nessun segnale reale collegato): un gap noto, segnalato esplicitamente
  fin dalla Tappa 3 e mai sostituito in nessuna tappa successiva. Effetto pratico: anche
  con un asse economico "Favorevole", l'indicazione finale resta "Nessun elemento
  rilevante" per priorità della tabella di combinazione (comportamento corretto per
  design dato lo stato attuale del dato, ma il segnale sottostante non è mai reale).
- **Pannello UI + decisione operatore — Completo.** Due badge assi separati, scomposizione
  sempre visibile (mai un'etichetta senza il suo "perché"), disclaimer obbligatorio,
  azione di registrazione decisione (`PATCH /api/cases/[id]/appeal-decision`, permesso
  `case:write` — non `enforcement:*`, applicabile anche a multe senza modulo autovelox).
- **Blocker "Valuta il ricorso" (§15.7) — Mancante, per scelta esplicita.** Il brief lo
  proponeva come opt-in/conservativo; non implementato in v1 per evitare un CTA
  potenzialmente invadente su pratiche a bassa priorità (deciso in Tappa 6, motivato nel
  commit).

### 2.3 Permessi (§9, §15.8)

`src/lib/auth/rbac.ts` — 4 nuovi permessi granulari, nessun nuovo ruolo:

| Permesso | ADMIN | OPERATIONS | ACCOUNTING | COMMERCIAL | READ_ONLY |
|---|---|---|---|---|---|
| `enforcement:confirm` | sì | sì | no | no | no |
| `enforcement:request-documents` | sì | sì | no | no | no |
| `enforcement:legal-escalate` | sì | no | no | no | no |
| `enforcement:manage-registry-sync` | sì | no | no | no | no |

Verificato lato server in ogni endpoint (test di integrazione dedicati per i gate 403).

## 3. Dati e schema

5 nuovi modelli (`EnforcementDeviceCheck`, `EnforcementDeviceField`,
`EnforcementDocumentCheck`, `SpeedRegistrySnapshot`, `AppealDecision`), 10 nuovi enum,
3 migrazioni additive (nessun `ALTER`/`DROP` su tabelle esistenti oltre alle relazioni
inverse). `RuleSettings` esteso con 9 parametri economici per l'indicatore ricorso — i
default sono stime proposte dal brief, **mai verificate dall'utente** (`appealCostParamsVerifiedAt`
resta `null`): da tarare dalle Impostazioni con l'uso reale, come da approvazione originaria.

## 4. Verifica

- `npm run typecheck && npm run lint && npm run test && npm run build`: tutti puliti
  a fine Tappa 7. **337/337 test** (56 file). Un singolo test di timing pre-esistente
  (`tests/integration/job-queue.test.ts`, non toccato da questa FASE) resta
  occasionalmente flaky se eseguito nella suite completa — confermato non correlato,
  passa 100% in isolamento, comportamento già presente prima della FASE E.
- Copertura: unit test su ogni funzione pura (calcolo indicatore, scadenze, parsing
  registro MIT, diff, euristiche); integration test su ogni endpoint nuovo via
  orchestratore/handler reale (mai il persist layer direttamente), inclusi i gate di
  permesso per ruolo e la scrittura dell'audit log.
- Verifica visiva (Chrome) alla fine di ogni tappa con UI reale (Tappa 3, 6, 7): pannelli,
  azioni, stati vuoti, blocker — tutti confermati dal vivo su pratiche reali del seed.
- Database locale resettato e riseedato due volte in Tappa 7 (azione irreversibile,
  eseguita solo con consenso esplicito dell'utente in entrambi i casi) per verificare che
  i 6 nuovi scenari producessero `EnforcementDeviceCheck` corretti.

## 5. Simulato o incompleto — riepilogo consolidato

1. Confronto automatico registro MIT ↔ dispositivo: mai costruito, `registryMatch` resta
   sempre `NOT_CONSULTED`.
2. Asse documentale dell'indicatore ricorso: fallback generico sempre `NONE`, nessun
   segnale reale collegato (es. dai documenti tecnici presenti/mancanti).
3. Fetcher reale del registro MIT: implementato ma mai esercitato contro il portale vero;
   euristica di paginazione generica da validare al primo uso.
4. Nessun percorso UI per: creare manualmente un `EnforcementDeviceCheck` quando la
   pipeline non ne ha mai generato uno (es. analisi fallita o mai eseguita); confermare
   `driver_professional_cqc` (nessun endpoint dedicato, solo un possibile futuro
   collegamento all'anagrafica autisti, come già previsto dalla specifica).
5. Parametri economici dell'indicatore ricorso (`appealInternalHandlingCost`,
   `appealLicensePointValueEquivalent`, ecc.): stime di default mai confermate
   dall'utente in Impostazioni.
6. Storico snapshot/diff del registro MIT: nessuna UI di consultazione (solo dati in DB) —
   prevista esplicitamente per una tappa futura, mai in scope di FASE E.

## 6. Possibili prossimi passi (non decisi, solo segnalati)

- Costruire il confronto strutturato registro↔dispositivo (punto 1) e collegarlo a
  `EnforcementRegistryMatchState`, con gli stessi vincoli di linguaggio prudente già
  rispettati ovunque (mai una conclusione di validità).
- Dare un segnale reale all'asse documentale dell'indicatore ricorso (punto 2), es.
  derivato da `EnforcementDocumentCheck`/`missing_documents`.
- Endpoint dedicato per confermare `driver_professional_cqc` dal dettaglio pratica
  (chiude lo stesso gap segnalato tre volte in questa FASE).
- UI di consultazione storico registro MIT in Impostazioni.
- Taratura dei parametri economici dell'indicatore ricorso con l'uso reale, come
  esplicitamente riservato dall'utente in fase di approvazione.

Nessuno di questi punti è bloccante per l'uso del modulo così com'è: ogni limitazione è
documentata, mai nascosta, e il comportamento in loro assenza è sempre il più prudente
(dato mancante onesto, mai un'invenzione).

## 7. FASE 11 — correzioni logiche + gerarchia UI + provenienza

Aggiornamento successivo a questo report (branch `fix/autovelox-logic` → `feature/autovelox-slice`,
dopo il troncone A/B/C che ha già chiuso i punti 1 e 2 della sezione 6 sopra — il confronto
registro↔dispositivo e il segnale reale sull'asse documentale esistono da allora, questo report
non li aggiorna retroattivamente). Dettaglio completo in `docs/SPEC-AUTOVELOX-DRAFT.md` §16.

**5 bug logici confermati e corretti** (branch `fix/autovelox-logic`, 5 commit separati,
docs/SPEC-AUTOVELOX-DRAFT.md §16.1): assenza di segnali che produceva `NOT_APPLICABLE`
invece di `TO_BE_IDENTIFIED`; matcher registro che poteva dichiarare `MATCH` ignorando una
matricola incompatibile nel fallback per decreto; scadenze di ricorso calcolate da una data
di notifica mai verificata come confermata (ora sempre visibili ma marcate provvisorie);
etichetta "Assenti" mostrata anche per elementi documentali non ancora valutati; collegamento
documenti che preselezionava il primo allegato senza possibilità di scollegare.

**Ricomposizione UI a 3 livelli** (branch `feature/autovelox-slice`,
docs/SPEC-AUTOVELOX-DRAFT.md §16.2): il pannello "Verifica autovelox" apriva entrambe le
sezioni Identificazione/Documentazione ogni volta che c'erano problemi in entrambe.
Ricomposto in Livello 1 (sempre visibile, sola lettura, una sola azione reale), Livello 2
(espandibile, mai più di una sezione aperta di default, campi già confermati compressi),
Livello 3 (provenienza). Controlli interattivi visibili di default nel pannello, misurati dal
vivo sulla pratica seed più problematica (EML-046, `SPEED_CAMERA_MOBILE`, nessun dato tecnico
nel testo):

| Stato | Controlli visibili di default |
|---|---|
| Prima (entrambe le sezioni sempre aperte, stima da confronto con la reference) | ~37-47 |
| EML-046 dopo (7 campi problematici, nessun documento collegato) | 10 |
| case-050 dopo match registro (5 documenti mancanti, sezione documenti aperta) | 11 |
| case-050 completo (registro `MATCH` + tutti i documenti collegati, nessun blocker) | 0 |

Tutti e 6 gli stati richiesti (non identificato, identificato senza registro, match,
mismatch, documentazione incompleta, completo) verificati dal vivo nel dev server via Chrome;
match/mismatch/completo richiedono uno snapshot registro non presente nel seed statico,
prodotto per la sola verifica con `recordManualSpeedRegistryUpload`/
`matchAndPersistDeviceRegistryMatch` già esistenti (nessun nuovo percorso di codice, nessuna
modifica permanente al seed).

**Pannello provenienza** (docs/SPEC-AUTOVELOX-DRAFT.md §16.3): `FieldSourceInfo` sostituito
da `FieldProvenancePanel` — stesso pattern chiuso di default, ma ora mostra pagina, estratto
evidenziato, confidenza, stato di revisione, chi/quando ha confermato (dati già nello schema,
mai propagati fino al componente). Riusabile identicamente per `CaseField` generici, non solo
per l'autovelox.

**Simulato/rimandato di questa fase**: dimensione eval "applicabilità dispositivo" (solo test
unitario qui, fixture seed dedicata rimandata alla FASE 10 insieme all'estensione del dataset
già prevista lì); "metodo di estrazione" nel pannello provenienza usa `sourceType` come proxy,
nessun campo schema dedicato aggiunto.
