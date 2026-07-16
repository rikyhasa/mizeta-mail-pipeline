# FASE 8 — Porting UI di Mizeta Flow (prompt definitivo)

> Uso: `/clear`, modalità Plan, incollare tutto il blocco sotto.
> Supera le fasi 7B/7C: non è un redesign, è un porting controllato.

---

Leggi integralmente questo prompt prima di modificare qualunque file.

CONTESTO GENERALE
Esistono due versioni dello stesso progetto concettuale:

1. PROGETTO TARGET — BASE TECNICA DA CONSERVARE
   Repository: https://github.com/rikyhasa/mizeta-mail-pipeline
   È il progetto attualmente sviluppato con Claude.
   Questa versione ha una base tecnica molto più completa e affidabile:
   Next.js App Router; TypeScript strict; Prisma e PostgreSQL; autenticazione e
   sessioni server-side; ruoli e permessi; API e route protette; audit log;
   pipeline di classificazione ed estrazione; adapter email e LLM; job queue;
   validazioni; test unitari, di integrazione ed end-to-end; modalità mock
   dichiarata; gestione più prudente e veritiera delle funzionalità non ancora
   implementate.
   Questa è la base applicativa che deve rimanere la fonte di verità per:
   dati; logica di business; sicurezza; permessi; persistenza; audit;
   validazioni; stati; API; processi; test.

2. PROGETTO REFERENCE — INTERFACCIA DA PORTARE
   Repository: https://github.com/rikyhasa/mizeta-flow
   La versione completa si trova attualmente nella PR draft n. 1:
   branch: agent/initial-mvp — PR: https://github.com/rikyhasa/mizeta-flow/pull/1
   Questa versione è stata prodotta con Codex ed è stata provata direttamente
   dall'utente.
   Dal punto di vista tecnico è più vicina a un prototipo: molti dati sono mock
   o hardcoded; alcune azioni sono simulate; alcune funzioni non sono realmente
   persistenti; il database non è sempre la fonte reale della UI; alcuni valori,
   utenti, date e stati sono dimostrativi; alcune azioni sembrano funzionare
   senza avere dietro un flusso completo.
   Tuttavia, dal punto di vista dell'esperienza d'uso, questa versione è
   risultata nettamente più intuitiva, piacevole e naturale.

DECISIONE DI PRODOTTO
"Portare integralmente l'interfaccia e l'esperienza d'uso di Mizeta Flow
all'interno della base tecnica di Mizeta Mail Pipeline."
- UX, composizione visiva e linguaggio grafico: Mizeta Flow;
- dati, logica, sicurezza e comportamenti reali: Mizeta Mail Pipeline.
Mizeta Flow non deve diventare la nuova base tecnica. Deve essere trattata come:
specifica visiva; prototipo UX interattivo; riferimento per layout, densità e
gerarchie; fonte di verità per l'aspetto delle schermate.
Mizeta Mail Pipeline deve restare il progetto principale.

MOTIVAZIONE DEL CAMBIO DI DIREZIONE
Sono già state eseguite diverse fasi di redesign incrementale sul progetto
target (sidebar, palette, token, dashboard, KPI, filtri, tabella, dettaglio,
dati estratti, bozze, coda di revisione, impostazioni, responsive,
accessibilità). Le modifiche hanno prodotto un'interfaccia più ordinata e
coerente. Nonostante questo, il risultato continua a essere percepito come:
troppo standard; troppo simile a un gestionale generico; costruito
prevalentemente attraverso card, bordi e badge; meno immediato; meno piacevole
da usare; meno efficace nella composizione delle schermate.
La diagnosi è che il problema non sia più nei singoli componenti, ma nella
direzione visiva generale. Per questo NON voglio un'altra fase generica di
ritocchi a bordi, spaziature, colori, badge o componenti.
Voglio un porting controllato dell'esperienza Mizeta Flow.

PRINCIPIO FONDAMENTALE
Non prendere soltanto "ispirazione" da Mizeta Flow. Non creare una terza
interpretazione grafica. Non mischiare liberamente il design attuale del target
con quello di Mizeta Flow.
L'obiettivo è riprodurre con alta fedeltà: struttura delle schermate;
proporzioni; allineamenti; gerarchia; densità; sidebar; topbar; navigazione;
titoli; KPI; tabelle; pannelli; layout del dettaglio; uso dello spazio;
microinterazioni; comportamento responsive; sensazione generale d'uso.
La UI di Mizeta Flow è la fonte di verità visiva iniziale. Le ottimizzazioni
ulteriori verranno effettuate solo dopo aver completato il porting.

PALETTE — DECISIONE VINCOLANTE (unica deviazione ammessa dalla reference)
Riproduci la palette di Mizeta Flow (navy compreso) con UNA sostituzione:
ovunque la reference usa il suo arancione (#e56b2f e varianti), usa l'arancione
brand Zeta Transport #f28a1d (hover/scuro #c8680d), adattando le tinte derivate
(sfondi soft, focus ring) di conseguenza. Il navy della reference è accettato
come colore strutturale di questa direzione. Font: Inter, non Arial.
Questa decisione prevale, per questa fase, sul vincolo "antracite" delle fasi
precedenti: documenta la deviazione in docs/UI-PORTING-PLAN.md.

NON COPIARE LA LOGICA MOCK
Separa con estrema attenzione forma visiva e comportamento applicativo.
Elementi di Mizeta Flow da NON copiare letteralmente: nome hardcoded "Elena
Bianchi"; data fissa del 14 luglio 2026; orari fissi; KPI calcolati su array
mock; "Mock connesso · ora" hardcoded; pulsanti che simulano sincronizzazioni;
azioni che aggiornano solo lo stato del browser; controlli senza vera
persistenza; dati demo usati come sorgente della UI.
Sostituiscili con: utente autenticato reale; data corrente; timezone
Europe/Rome; query Prisma; view model applicativi; stato reale del provider;
API esistenti; persistenza reale; permessi; audit log; feedback degli errori;
controlli disabilitati quando una funzione non è implementata.

VERIDICITÀ DELLE FUNZIONI
Una funzione non deve sembrare attiva se non lo è realmente. In particolare:
non fingere che un'email venga inviata; non fingere che Microsoft 365 sia
collegato; non fingere che una sincronizzazione sia avvenuta; non fingere che
un'impostazione produca effetti se non è applicata; non fingere che un
documento sia stato generato se la generazione non esiste; non presentare un
mock come integrazione reale; non aggirare validazioni, permessi o audit per
imitare il prototipo.
Se un elemento della UI di Mizeta Flow rappresenta una funzione non ancora
implementata nel target: 1) mantieni, quando utile, posizione e struttura
visiva; 2) mostrala disabilitata o chiaramente etichettata; 3) usa un testo
concreto come "Non ancora disponibile"; 4) documenta la differenza; 5) non
introdurre una falsa simulazione solo per ottenere parità visiva.

INVARIANTI DA CONSERVARE
Prima di lavorare leggi: CLAUDE.md; docs/SPEC.md; docs/architecture.md;
docs/data-model.md; docs/security.md; docs/ai-pipeline.md;
docs/email-integration.md; docs/dod-report.md; tutti i documenti che descrivono
invarianti e limiti.
Mantieni integralmente: permessi RBAC; autenticazione; protezione delle route;
validazione server-side; audit delle azioni; separazione tra provider mock e
reali; bozze soggette ad approvazione; nessun invio automatico non autorizzato;
nessuna scrittura ERP non prevista; nessuna esecuzione di allegati o macro;
nessuna funzione presentata come reale quando è solo mock; invarianti del
modello dati.
È consentito: creare view model; aggiungere query di lettura; restituire dati
aggiuntivi alle pagine; cambiare la composizione server/client; rifattorizzare
componenti; modificare la struttura delle pagine; cambiare il design system;
aggiungere componenti specifici; riorganizzare layout e navigazione; modificare
URL e sincronizzazione dei filtri, se compatibile; aggiungere API di sola
lettura quando strettamente necessarie; adattare endpoint esistenti senza
cambiarne il significato.
Non è consentito: rimuovere controlli di sicurezza; bypassare permessi;
eliminare audit log; cambiare il significato degli stati; degradare la
persistenza a stato locale; sostituire query reali con dati mock; copiare le
scorciatoie dimostrative del prototipo.

METODO DI LAVORO
Non iniziare con una sostituzione massiva dei file. Lavora in modo controllato.

FASE 0 — SICUREZZA E ANALISI
1. Verifica lo stato Git del progetto target.
2. Verifica che build, typecheck, lint e test siano puliti prima delle modifiche.
3. Crea una branch dedicata: ui/mizeta-flow-port.
4. Non modificare il repository Mizeta Flow.
5. Clona Mizeta Flow in sola lettura FUORI dall'albero del progetto target
   oppure in una cartella locale esclusa da git (es. .reference/mizeta-flow,
   aggiunta a .gitignore): non deve mai finire nei commit del target.
6. Fai il checkout del branch agent/initial-mvp e annota lo SHA esatto del
   commit usato come riferimento in docs/UI-PORTING-PLAN.md (riproducibilità).
7. Analizza entrambe le codebase.
8. Crea una mappa completa tra schermate e comportamenti.
Prima di implementare, crea docs/UI-PORTING-PLAN.md con una matrice con almeno
queste colonne: schermata/componente Mizeta Flow; file di origine; schermata o
componente target; dati mock usati nella reference; fonte dati reale nel
target; API o server action reale; permessi richiesti; audit richiesto;
differenze funzionali; decisione di implementazione; rischi; stato del porting.
Esempio:
| UI reference | Dato mock | Fonte reale | Azione reale |
|---|---|---|---|
| KPI "Da gestire oggi" | mockCases | query dashboard Prisma | filtro dashboard |
| Nome utente | Elena Bianchi | sessione autenticata | nessuna |
| Sincronizza posta | simulazione | provider email/job queue | azione solo se disponibile |
| Riga pratica | array locale | CaseListItem/ViewModel | apertura dettaglio |
| Approva bozza | stato locale | EmailDraft + API protetta | validazione + audit |

FASE 1 — AUDIT DELLA FEDELTÀ VISIVA
Documenta gli elementi principali da riprodurre: larghezza e comportamento
della sidebar; topbar; ricerca globale; palette navy/arancione (con la
sostituzione brand di cui sopra); tipografia; dimensioni; spaziatura; griglia;
KPI; quadro operativo; pannelli; tabella; filtri; dettaglio a due colonne;
pannello laterale sticky; timeline; dati estratti; allegati; bozze; report;
audit; impostazioni; login; responsive.
Analizza anche: src/app/globals.css; src/components/app-shell.tsx;
src/components/cases-table.tsx; src/components/case-detail.tsx; tutte le pagine
di Mizeta Flow.
Non limitarti a copiare i colori: devi capire la composizione complessiva.

FASE 2 — PILOTA OBBLIGATORIO
Non portare tutta l'app in una sola volta. La prima vertical slice include:
1. shell generale; 2. sidebar; 3. topbar; 4. dashboard; 5. elenco pratiche.
Completa dal punto di vista: visivo; funzionale; responsive; accessibilità;
dati reali; filtri; navigazione; permessi; stati vuoti; loading; errori.
La dashboard deve riprodurre il più fedelmente possibile Mizeta Flow:
intestazione con saluto e contesto; azione principale; KPI; quadro operativo;
sezione pratiche da lavorare; tabella; toolbar; densità; proporzioni; layout.
Ma deve usare: sessione reale; data reale; query reali; filtri reali; route
reali; dati reali della modalità mock persistita; stato provider reale.
Dopo la vertical slice: screenshot; descrivi le differenze inevitabili;
typecheck, lint, test e build; FERMATI; attendi la mia approvazione prima di
proseguire. Non continuare automaticamente con il resto dell'app.

CRITERIO DEL PILOTA
Il pilota non è approvato se il risultato: è solo vagamente ispirato a Mizeta
Flow; conserva la vecchia composizione del target; mescola i due design senza
una scelta chiara; usa ancora principalmente la struttura grafica precedente;
copia il CSS ma non le proporzioni; riproduce i KPI ma non la sensazione d'uso;
usa dati mock hardcoded; rompe filtri, permessi o persistenza; mostra funzioni
false.

FASE 3 — PORTING PER SCHERMATE COMPLETE (dopo approvazione del pilota)
Ordine: 1. dettaglio pratica; 2. posta acquisita / email e allegati; 3. coda di
revisione; 4. bozze e documenti; 5. report; 6. registro attività;
7. impostazioni; 8. login; 9. responsive completo; 10. rifinitura finale.
Ogni fase è una vertical slice completa. Non lavorare per micro-elementi
isolati (prima tutti i badge, poi tutti i pulsanti...): lavora per schermate
complete, così ogni pagina ha una composizione coerente.

DETTAGLIO PRATICA
Il dettaglio di Mizeta Flow è uno dei riferimenti più importanti. Deve
diventare un vero workspace, mantenendo: contenuto principale; pannello
laterale; riepilogo; metadati; dati estratti; timeline; allegati; warning;
azioni contestuali; responsabile; scadenze; bozze.
Collega ogni elemento a: modello Prisma; endpoint reale; audit log; permessi;
validazioni. Non copiare i campi mock che non corrispondono al dominio reale.
Quando i due modelli differiscono: mantieni la composizione visiva; adatta il
contenuto; documenta la differenza.

CODA DI REVISIONE
Il target contiene già una coda di revisione più solida dal punto di vista
funzionale. Non perdere: motivazioni della revisione; distinzione tra
duplicati, dati mancanti, anomalie e bassa confidenza; confronto pratiche;
azioni reali; audit; permessi.
Porta la coda nel linguaggio visuale di Mizeta Flow, ma conserva le capacità
funzionali più avanzate del target.

IMPOSTAZIONI
Mantieni: separazione tra configurazioni operative e tecniche; controlli non
attivi realmente disabilitati; salvataggio reale; feedback modifiche non
salvate; permessi ADMIN; chiarezza sui provider mock.
Porta lo stile e la composizione di Mizeta Flow senza rendere meno chiari i
limiti delle funzioni.

DESIGN SYSTEM
Non sei obbligato a mantenere il design system attuale se impedisce la fedeltà.
Puoi: sostituire token; modificare Card, Button, Badge, Tabs, Field; creare
nuovi primitivi; eliminare componenti non più utili; introdurre componenti
specifici per le schermate.
Evita però di copiare tutto il CSS globale di Mizeta Flow senza rifattorizzarlo.
Il risultato finale deve mantenere: coerenza; riuso; TypeScript; accessibilità;
manutenibilità. Il CSS di Mizeta Flow può essere usato come riferimento
iniziale, ma deve essere integrato correttamente nell'architettura del target.

FEDELTÀ VISIVA
Da valutare su: proporzioni; spazi; densità; gerarchia; contrasto; larghezze;
altezza delle righe; grandezza dei testi; distribuzione delle informazioni;
allineamento; posizione delle azioni; comportamento sticky; responsive.
Non basta avere stesso navy, stesso arancione, stessa sidebar, stesse icone:
la schermata deve produrre una sensazione d'uso molto simile.

ACCESSIBILITÀ
Mantieni o migliora: navigazione da tastiera; focus visibile; label associate;
semantica delle tabelle; aria-label; contrasto; target cliccabili; responsive;
screen reader; nessuna informazione affidata solo al colore.
Non sacrificare accessibilità per la parità visiva.

VIEW MODEL
Quando la UI reference richiede dati in una forma diversa da Prisma, crea view
model dedicati. Esempio:
type DashboardWorkItem = {
  id: string;
  reference: string;
  title: string;
  category: CaseCategory;
  priority: CasePriority;
  deadline: string | null;
  customerOrSupplierName: string | null;
  requiresReview: boolean;
  actionLabel: string;
};
Non accoppiare i componenti visuali direttamente a strutture Prisma complesse
se un view model rende il porting più pulito.

RICERCA GLOBALE
La topbar di Mizeta Flow contiene una ricerca globale. Non lasciarla come input
decorativo. Deve: funzionare realmente; cercare almeno riferimento, titolo,
cliente, fornitore, ordine o fattura; portare a risultati comprensibili; essere
accessibile; avere stato vuoto; non simulare risultati.
Se l'implementazione completa richiede troppo lavoro per il pilota: documenta
la limitazione; implementa almeno il collegamento alla ricerca pratiche; non
lasciarla finta.

STATO PROVIDER E SINCRONIZZAZIONE
Il badge "Mock connesso · ora" non deve essere hardcoded. Deve riflettere:
modalità mock; provider configurato; ultima sincronizzazione disponibile; stato
reale della mailbox, quando esiste.
Il pulsante di sincronizzazione deve: chiamare un'azione reale, quando
disponibile; rispettare permessi; generare feedback; essere disabilitato quando
non disponibile; non simulare una sincronizzazione.

TEST E VERIFICHE
Dopo ogni vertical slice: typecheck; lint; test; test end-to-end disponibili;
build di produzione.
Verifica anche: ADMIN; utente non amministratore; READ_ONLY; modalità mock;
dati presenti; dati assenti; errori; loading; stati vuoti; desktop; laptop;
tablet; mobile; tastiera.
Non modificare i test per nascondere regressioni. Aggiorna i test soltanto
quando il comportamento atteso cambia in modo intenzionale e documentato.

SCREENSHOT E CONFRONTO
Per ogni pagina portata: 1) avvia entrambe le versioni; 2) acquisisci
screenshot alle stesse dimensioni; 3) confronta layout, spaziatura, densità,
allineamenti, gerarchia; 4) documenta le differenze.
Crea docs/UI-PORTING-REPORT.md e aggiornalo progressivamente con: pagina;
stato; screenshot reference; screenshot target; differenze; motivazione;
decisioni; test eseguiti.

COMMIT
Commit piccoli e leggibili. Esempio:
1. chore: add UI porting plan
2. refactor: prepare dashboard view models
3. feat: port Mizeta Flow app shell
4. feat: port dashboard composition
5. feat: port cases table and filters
6. test: cover dashboard port
7. docs: update UI porting report
Non creare un unico commit enorme per l'intero porting.

COSA NON DEVI FARE
Non riscrivere tutto da zero. Non sostituire il backend Claude con quello
Codex. Non importare direttamente i mock come sorgente dati. Non mantenere dati
hardcoded. Non aggiungere funzioni simulate. Non rimuovere validazioni per
imitare il prototipo. Non eliminare funzioni più avanzate già presenti nel
target. Non limitarti a una nuova skin. Non iniziare un altro redesign
creativo. Non reinterpretare liberamente la reference. Non proseguire oltre il
pilota senza approvazione.

OUTPUT RICHIESTO PRIMA DI IMPLEMENTARE
Per questa prima esecuzione:
1. analizza entrambi i repository;
2. verifica branch e stato dei test;
3. crea o descrivi la struttura di UI-PORTING-PLAN.md;
4. presenta la matrice iniziale;
5. individua le differenze tra modelli dati;
6. individua le funzioni finte o mock della reference;
7. individua le funzioni più evolute del target da conservare;
8. proponi i file che modificherai nel pilota;
9. proponi la sequenza dei commit;
10. indica i rischi;
11. fermati.
Non modificare ancora l'applicazione finché non avrò approvato il piano.

RISULTATO FINALE ATTESO
Alla fine del progetto, l'utente deve poter aprire Mizeta Mail Pipeline e avere
la sensazione di usare Mizeta Flow: stessa chiarezza; stessa immediatezza;
stessa composizione; stessa piacevolezza; stessa facilità nel capire dove
cliccare; stessa efficacia nelle attività quotidiane.
Ma sotto l'interfaccia devono continuare a esserci: dati reali; persistenza;
permessi; audit; sicurezza; validazioni; pipeline; test; trasparenza sui mock;
nessuna funzione falsa.

Inizia ora esclusivamente con l'analisi e il piano del porting.
Non implementare ancora.
