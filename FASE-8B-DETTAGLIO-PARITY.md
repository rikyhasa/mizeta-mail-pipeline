# FASE 8B — Parità visiva del dettaglio pratica (una volta per tutte)

> Uso: `/clear`, modalità Plan, incollare il blocco sotto.
> Lavora ESCLUSIVAMENTE sul dettaglio pratica. Non toccare altre schermate.

---

Leggi prima: CLAUDE.md, FASE-8-UI-PORTING.md (invarianti e decisione palette),
docs/UI-PORTING-PLAN.md, e il codice della reference in .reference/mizeta-flow
(in particolare src/app/globals.css e src/components/case-detail.tsx del branch
agent/initial-mvp).

DIAGNOSI — PERCHÉ QUESTA FASE ESISTE
Il passaggio alla pagina unica è corretto, ma il dettaglio pratica NON ha
raggiunto la reference. Il motivo metodologico, da correggere in questa fase:
finora il porting è stato verificato solo a livello strutturale (DOM, ordine
sezioni), mai visivamente, e le sezioni sono state costruite riusando i
componenti del target (Card, Button, con i loro padding/ombre/tipografia)
invece delle misure esatte della reference. Il risultato usa il layout della
reference ma il linguaggio visuale precedente: molte card bianche impilate
tutte uguali; informazioni secondarie troppo prominenti; azioni laterali tutte
con lo stesso peso; dati operativi importanti troppo in basso; gerarchia
tipografica debole; la pagina sembra una pila di moduli amministrativi.

Questa fase è VISUAL AND USABILITY PARITY, non un altro redesign creativo.

OBIETTIVO
Quando le due pagine sono aperte affiancate alla stessa risoluzione, il
dettaglio target deve risultare immediatamente riconoscibile come la stessa
esperienza della reference, pur usando dati, endpoint, permessi e validazioni
reali del target.
Non basta mantenere pagina unica, colonna laterale e palette. Devi portare:
densità; proporzioni; ordine delle informazioni; numero ridotto di card;
gerarchia; composizione; tipografia; posizione delle azioni; uso dello spazio;
ritmo verticale.

METODO OBBLIGATORIO — CICLO VISIVO (la novità che cura la causa)
1. Installa Playwright come devDependency se non presente (solo per verifica,
   non tocca l'app) e crea uno script scripts/ui-compare.ts che:
   - avvia la reference (da .reference/mizeta-flow) su una porta libera e il
     target su un'altra (MAI toccare processi sulla porta 3000: è una demo in
     uso in ufficio);
   - apre lo stesso tipo di pratica su entrambe;
   - cattura screenshot full-page e above-the-fold a viewport 1440x900 e
     1920x1080, salvandoli in docs/screenshots/.
2. GUARDA gli screenshot (leggili come immagini) prima di scrivere qualunque
   CSS: elenca le differenze concrete che vedi (posizioni, larghezze, altezza
   sopra la piega, numero di card, densità, tipografia, pannello laterale).
3. Implementa le correzioni.
4. Ricattura, riguarda, itera. Massimo 5 iterazioni: a ogni iterazione annota
   in docs/UI-PORTING-REPORT.md cosa hai visto e cosa hai corretto.
5. Vietato dichiarare la fase conclusa senza la coppia di screenshot finale
   nel report.

MISURE, NON INTERPRETAZIONI
I valori di padding, font-size, line-height, radius, ombre, larghezze di
colonna, altezze dei controlli e spaziatura tra sezioni vanno LETTI dal CSS
della reference (globals.css) e riprodotti, non approssimati con i default dei
componenti del target. Dove i componenti condivisi del target (Card, Button,
Badge...) hanno valori diversi dalla reference, NON usarli per questa pagina:
crea componenti dedicati (WorkPanel, AttentionSummary, RecommendedAction,
ContextPanel o simili). È esplicitamente permesso rimuovere Card, usare sezioni
aperte con divisori e ridefinire la struttura della pagina.

PROBLEMI PUNTUALI DA RISOLVERE
1. Troppe card uguali impilate.
2. "Scadenze" occupa una card intera per una sola riga.
3. "Anomalie e controlli" occupa una card anche quando è vuota.
4. "Collega o separa pratica" appare prima dei dati estratti ed è troppo
   prominente.
5. Il primo dato mancante appare troppo in basso.
6. Non esiste una chiara prossima azione consigliata.
7. "Segna completata" è primaria anche quando esistono dati mancanti, revisione
   necessaria, responsabile assente o altri blocchi.
8. I pulsanti laterali hanno tutti la stessa gerarchia.
9. Il pannello Contesto è troppo vuoto.
10. Tipografia e controlli piccoli e generici.
11. In "Sintesi operativa" Stato e Responsabile sono select da modulo sempre
    visibili: mostrali come label maiuscola piccola + valore bold (meta-grid
    della reference), editabili al clic.

COMPOSIZIONE VINCOLANTE — AREA PRINCIPALE (ordine)
1. testata pratica;
2. sintesi operativa e metadati (scadenza principale integrata qui);
3. blocco "Attenzione richiesta" SOLO quando esistono problemi (dati mancanti,
   anomalie, revisione richiesta, importi discordanti) — sopra la piega;
4. dati estratti (griglia compatta per i dati affidabili, evidenza solo sui
   problematici, editing inline);
5. email e allegati;
6. bozza attiva;
7. attività e commenti;
8. documenti generati;
9. relazioni tra pratiche ("Collega o separa" qui, in accordion "Relazioni e
   altre operazioni" — mai prima dei dati estratti);
10. registro attività.
Niente grandi contenitori vuoti: le sezioni senza contenuto si nascondono o si
riducono a una riga. "Nessuna anomalia rilevata" non occupa una card autonoma.

PANNELLO LATERALE STICKY — diviso chiaramente in:
1. Prossima azione (una sola, derivata dallo stato REALE della pratica:
   completa dati mancanti / verifica classificazione / assegna responsabile /
   controlla anomalia / approva bozza / completa pratica);
2. Azioni rapide (secondarie, peso visivo minore);
3. Documenti;
4. Chiusura ("Segna completata" NON primaria quando la pratica non è pronta;
   se esistono blocchi, pulsante disabilitato con il motivo visibile, non
   affidarti all'errore dopo il clic);
5. Contesto (solo informazioni utili e disponibili: cliente/ente, mittente,
   casella di origine, reparto, data ricezione, ultima attività,
   veicolo/targa/conducente, categorie secondarie, stato revisione).
La logica della "prossima azione" deve derivare da dati e stati già esistenti:
nessuna nuova logica di business, solo presentazione.

PALETTE E STILE
Vale la decisione della FASE 8: navy e composizione della reference, arancione
brand #f28a1d (hover #c8680d) al posto dell'arancione della reference, font
Inter. Riferimento vincolante per: larghezza sidebar; topbar; larghezza colonna
laterale; padding pagina; raggio contenitori; ombre; dimensioni tipografiche;
altezza controlli; griglia dati; densità righe; timeline; azioni.

INVARIANTI
Mantieni integralmente: dati reali; query Prisma; API; RBAC; audit;
validazioni; persistenza; trasparenza mock; accessibilità (focus visibile,
tastiera, aria, contrasto). Non copiare dati o comportamenti mock della
reference. Nessuna nuova migrazione.

CHIUSURA
Al termine: typecheck; lint; test; e2e disponibili; build. Commit piccoli.
Poi FERMATI e presenta: screenshot reference vs target affiancati; differenze
residue e perché sono inevitabili; file modificati; test eseguiti.
Non procedere ad altre schermate senza approvazione.

CRITERI DI ACCETTAZIONE — la fase NON è conclusa se:
- la pagina sembra ancora una pila di card;
- il dato mancante resta sotto sezioni vuote o secondarie;
- "Segna completata" domina quando la pratica non è pronta;
- il pannello laterale è una lista indifferenziata di pulsanti;
- reference e target risultano ancora due design chiaramente diversi;
- è stata copiata solo la palette;
- la composizione precedente è stata preservata per inerzia;
- manca il confronto screenshot finale nel report.
