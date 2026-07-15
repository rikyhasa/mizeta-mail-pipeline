# Prompt di fase per Claude Code

## Come usare questo kit

La cartella è già pronta: `CLAUDE.md` nella radice e `docs/SPEC.md` al loro posto.

1. Apri il terminale in questa cartella e lancia `claude`.
2. Incolla i prompt qui sotto **uno alla volta**, ognuno in una sessione nuova
   (`/clear` fra una fase e l'altra). Parti dalla Fase 1: essendo una cartella nuova,
   la Fase 0 non serve — di' a Claude di procedere come webapp standalone.
3. Fra una fase e l'altra: avvia l'app, verifica di persona, correggi con follow-up
   nella stessa sessione prima di passare oltre.

Consiglio: per le fasi 1-3 usa la modalità Plan di Claude Code (Shift+Tab) e approva il
piano prima che scriva codice.

---

## FASE 0 — Assessment (salta se parti da cartella vuota: di' a Claude di procedere come webapp standalone)

```
Leggi CLAUDE.md e docs/SPEC.md, in particolare la sezione 2 (Decisione architetturale).

Esegui la Fase 0: ispeziona l'intero repository, identifica framework, database,
autenticazione e punti di estensione del gestionale, e scrivi
docs/architecture-assessment.md con: conclusioni, decisione modulo-vs-standalone
motivata secondo la regola della spec, elenco delle assunzioni, rischi, e piano di
implementazione per le fasi 1-5.

Non scrivere codice di prodotto in questa fase. Se qualcosa è ambiguo, fai domande
prima di decidere.
```

## FASE 1 — Fondamenta

```
Leggi CLAUDE.md e docs/SPEC.md (sezioni 3, 4, 5, 14).

Esegui la Fase 1: scaffold del progetto secondo lo stack in CLAUDE.md; schema Prisma
con tutte le entità della sezione 5 e relative migrazioni; autenticazione con sessioni
server-side e i 5 ruoli (nessuna registrazione pubblica); MailProviderAdapter con
implementazione mock completa; LLMProvider con implementazione mock; seed con le 25+
email sintetiche e i casi difficili della sezione 4; una pagina lista pratiche minimale
per verificare che il flusso email→pratica funzioni; test base; docker-compose per
Postgres; .env.example.

Al termine: typecheck, lint, test; riepilogo file; elenco di ciò che è simulato.
```

## FASE 2 — Pipeline AI

```
Leggi CLAUDE.md e docs/SPEC.md (sezioni 6, 7, 8, 13, 18).

Esegui la Fase 2: pipeline in tre passaggi separati (classificazione, estrazione,
proposta azioni) con Structured Outputs validati da Zod; schemi di estrazione per le 6
categorie prioritarie della sezione 6; ogni campo con fonte, confidenza e
needs_human_review; regole di associazione email→pratica nell'ordine della sezione 7
con coda "possibili duplicati"; motore di regole deterministico della sezione 8 con
soglie configurabili; protezioni anti prompt-injection della sezione 13; dataset eval
con expected output e comando npm run eval con report.

Implementa prima tutto contro LLM_PROVIDER=mock, poi aggiungi il provider reale
configurabile. Al termine: typecheck, lint, test, eval; riepilogo file; elenco di ciò
che è simulato.
```

## FASE 3 — Dashboard e pratiche

```
Leggi CLAUDE.md e docs/SPEC.md (sezioni 9, 10, 11, 16, 19).

Esegui la Fase 3: dashboard a tre fasce con alert, KPI e tabella filtrabile (sezione 9);
pagina/drawer di dettaglio pratica con tutti i dati, le fonti cliccabili e le azioni
della sezione 10; generazione bozze email (mai invio, sezione 11); coda di revisione per
duplicati e bassa confidenza; pagina Impostazioni (sezione 16); requisiti UX della
sezione 19, tutto in italiano.

Verifica il tutto in modalità mock con i dati seed. Al termine: typecheck, lint, test;
riepilogo file; elenco di ciò che è simulato.
```

## FASE 4 — Email reale e documenti

```
Leggi CLAUDE.md e docs/SPEC.md (sezioni 3, 12, 15, 17).

Esegui la Fase 4: adapter microsoft365 con Microsoft Graph (change notifications +
delta query per il recovery, rinnovo subscription, sync iniziale limitata); scheletro
documentato dell'adapter pec_imap con la gestione delle ricevute PEC descritta nella
sezione 3; job queue con retry, backoff e dead-letter queue; idempotenza e
deduplicazione; audit log della sezione 15; osservabilità della sezione 17; template
HTML→PDF della sezione 12 (almeno scheda preventivo, dossier reclamo e scheda multa).

Nessuna credenziale reale: l'adapter M365 deve essere testabile con mock delle risposte
Graph. Al termine: typecheck, lint, test; riepilogo file; elenco di ciò che è simulato.
```

## FASE 5 — Rifinitura e chiusura

```
Leggi CLAUDE.md e docs/SPEC.md (sezioni 19, 20, 21, 22).

Esegui la Fase 5: rifinitura UX; completamento audit e osservabilità; tutta la
documentazione della sezione 20 con README passo-passo; test end-to-end dei flussi
principali in mock; poi verifica ogni voce della Definition of Done (sezione 22) una per
una e produci docs/dod-report.md con lo stato di ciascuna voce, indicando chiaramente
cosa è completo, cosa è simulato e cosa manca.
```

---

## FASE 6 — Tuning dei prompt AI (precisione)

```
Leggi CLAUDE.md, docs/SPEC.md (sezioni 6, 18), docs/evaluation.md e
docs/eval-report-anthropic.md.

Obiettivo: ridurre drasticamente il margine di errore della pipeline AI con il
provider Anthropic reale, partendo dai known issues documentati (estrazione
scadenze al 33%, EML-028 misclassificata, tasso revisione 53,6%).

Metodo, in questo ordine:

1. Analisi degli errori: per ogni fixture sbagliata nel report Anthropic, spiega
   la causa (prompt ambiguo, schema poco chiaro, normalizzazione mancante) prima
   di toccare qualunque cosa.
2. Scadenze: valuta se spostare la normalizzazione delle date fuori dal modello —
   il modello estrae la data testuale grezza con l'excerpt, il codice la converte
   (parser deterministico, formati italiani, fuso Europe/Rome, date relative tipo
   "entro 5 giorni" risolte rispetto alla data della email). Le regole
   deterministiche sono più affidabili del modello: preferiscile dove possibile.
3. Prompt: aggiungi definizioni operative per le categorie confuse (es. diffida
   ad adempiere = ADMINISTRATIVE se richiesta formale generica, CLAIM_OR_DAMAGE
   solo se legata a merce/spedizione) e 2-3 esempi few-shot per i casi limite.
4. Amplia il dataset eval: almeno 15 nuove fixture mirate sui punti deboli
   (varianti di scadenze in formati diversi, diffide, email miste), di cui almeno
   5 tenute come held-out set per controllare di non star sovra-adattando i
   prompt al dataset esistente.
5. Misura: baseline Anthropic → modifiche → nuova eval Anthropic. Usa lo script
   di diagnosi mirata sulle singole fixture durante l'iterazione (costa
   centesimi) e l'eval completa solo per la misura finale. Budget massimo per
   l'intera fase: 10 dollari di API. Chiedimi conferma prima di ogni run completa.

Target: accuratezza categoria ≥ 90%, accuratezza scadenze ≥ 90%, recall multe e
reclami urgenti che resta 100%, tasso revisione ≤ 35% senza perdere richiami sui
casi ambigui veri. Aggiorna docs/evaluation.md e docs/eval-report-anthropic.md
con il confronto prima/dopo.

Al termine: typecheck, lint, test, eval mock invariata; riepilogo; cosa resta debole.
```

## FASE 7 — Redesign UX (utenti 30-60 anni, non tecnici)

```
Leggi CLAUDE.md e docs/SPEC.md (sezioni 9, 10, 19).

Obiettivo: rendere l'interfaccia più intuitiva e piacevole per utenti dai 30 ai
60 anni, non tecnici, che la useranno ogni giorno come strumento di lavoro
principale. Oggi la dashboard è funzionale ma densa.

Principi vincolanti:

1. Gerarchia prima di tutto: la domanda a cui la dashboard risponde è "cosa devo
   fare ORA?". Gli alert urgenti devono dominare la pagina; tutto il resto è
   secondario e può stare dietro un clic.
2. Progressive disclosure: vista di default con poche colonne essenziali (tipo,
   titolo, cliente, scadenza, priorità); colonne aggiuntive attivabili. Filtri
   avanzati chiusi di default.
3. Leggibilità: font più grande dello standard (minimo 16px per il corpo), alto
   contrasto, spaziatura generosa, aree cliccabili ampie (minimo 44px). Mai
   informazione veicolata dal solo colore: sempre icona + etichetta.
4. Linguaggio: etichette in italiano semplice e concreto ("Da fare oggi", non
   "Alert critici"). Niente gergo tecnico: nascondere termini come confidence,
   pipeline, provider dalla vista operativa (restano in Impostazioni).
5. Stati vuoti incoraggianti e chiari ("Nessuna pratica urgente: tutto sotto
   controllo") e conferme visibili dopo ogni azione (toast).
6. Coerenza: un colore e un'icona fissi per categoria in tutta l'app; stessa
   posizione per le stesse azioni in ogni pagina.
7. Accessibilità completa da tastiera e focus visibile.

Identità visiva aziendale (dal sito Mizeta/Zeta Transport — da rispettare):

- Palette: arancione brand #f28a1d (scuro #c8680d), antracite #202326, testo
  #161719, testo secondario #5f6873, sfondi #ffffff e #f4f6f8, bordi #dce2e8,
  accenti secondari teal #1f6672 e verde #4d6b5a.
- Font: Inter, con fallback system-ui.
- Uso dell'arancione: è il colore del brand, non un colore semantico. Usalo per
  azioni primarie, elementi attivi, accenti di navigazione. NON usarlo per gli
  stati di priorità/urgenza: lì servono colori semantici distinti (rosso per
  critico, ambra per alto, grigio per normale/basso), sempre accompagnati da
  icona ed etichetta, altrimenti si confondono col brand.
- Stile generale del sito: pulito, chiaro, professionale, molto spazio bianco,
  angoli arrotondati, ombre morbide. La webapp deve sembrare della stessa
  famiglia.

Metodo: prima proponi 2-3 direzioni di design descritte a parole (layout,
palette, densità) e aspetta la mia scelta. Poi implementa la direzione scelta su
dashboard, dettaglio pratica, coda revisione e impostazioni. Non toccare la
logica di business né le API. Verifica ogni pagina in modalità mock.

Al termine: typecheck, lint, test; riepilogo; elenco delle scelte di design fatte.
```

Consiglio per la Fase 7: prima di lanciarla, scrivi nel prompt anche 3-4
fastidi concreti che hai notato tu usando l'app (es. "troppe colonne", "non
capisco dove cliccare per confermare un campo"). Il feedback reale di chi la
userà vale più di qualunque principio.

---

## Post-MVP (idee da NON dare a Claude Code ora)

- Adapter PEC completo con polling IMAP schedulato.
- Invio reale delle bozze approvate (con doppia conferma).
- Generazione PowerPoint automatica (stile Riello: report clienti, gare, business
  review) tramite GeneratedDocumentService.
- Integrazione in scrittura col gestionale via ERPAdapter.
- Verifica automatica degli incassi contro l'estratto conto.
