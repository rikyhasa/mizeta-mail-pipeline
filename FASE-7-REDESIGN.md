# FASE 7 — Redesign UX (prompt definitivo)

> Questo prompt sostituisce la versione breve della Fase 7 in PROMPTS-FASI.md.
> Uso: `/clear`, modalità Plan, incollare tutto il blocco sotto.

---

Leggi prima integralmente:
- CLAUDE.md
- docs/SPEC.md, in particolare le sezioni 9, 10 e 19
- i componenti condivisi del design system
- le pagine e i layout attualmente utilizzati da:
  - dashboard
  - elenco pratiche
  - dettaglio pratica
  - coda di revisione
  - impostazioni

CONTESTO DELLA FASE
Questa è la Fase 7 del progetto.
Le fasi precedenti hanno già affrontato o stanno affrontando logica applicativa,
validazioni, flussi delle bozze, organizzazione delle pratiche, coda di revisione,
feedback delle azioni e altri aspetti funzionali.
In questa fase non devi riprogettare il modello dati, cambiare API o riscrivere
la logica di business.
Devi lavorare sull'interfaccia esistente per renderla:
- più chiara;
- più leggibile;
- meno densa;
- più rassicurante;
- più professionale;
- più veloce da usare ogni giorno.
Prima di proporre qualsiasi soluzione, verifica cosa è già stato implementato
nelle fasi precedenti.
Se, per esempio, il dettaglio pratica è già stato suddiviso in tab, la coda di
revisione mostra già il motivo della verifica o la dashboard espone già i filtri
attivi, non annullare queste modifiche: mantienile e migliorane la resa grafica.

UTENTI DI RIFERIMENTO
L'app sarà usata quotidianamente da dipendenti di un'azienda di trasporti e
logistica.
Gli utenti principali:
- hanno indicativamente tra 30 e 60 anni;
- non sono sviluppatori;
- non sono necessariamente esperti di software;
- devono gestire molte email e pratiche;
- devono capire rapidamente cosa richiede attenzione;
- non devono avere paura di commettere errori;
- useranno l'app come strumento operativo principale.
L'interfaccia non deve sembrare una console tecnica o un prototipo per
sviluppatori.
Deve sembrare un gestionale aziendale moderno, stabile, chiaro e affidabile.

OBIETTIVO PRINCIPALE
La domanda a cui ogni schermata deve rispondere è:
"Cosa devo fare adesso?"
In pochi secondi l'utente deve capire:
1. cosa richiede attenzione;
2. cosa è urgente o in scadenza;
3. perché una pratica deve essere controllata;
4. quale sia la prossima azione disponibile;
5. quali operazioni siano già state completate;
6. dove cliccare per approfondire.
La gerarchia delle informazioni è più importante della quantità di dati mostrata.

IDENTITÀ VISIVA AZIENDALE
La webapp deve appartenere visivamente alla stessa famiglia del sito
Mizeta/Zeta Transport.
Palette vincolante:
- arancione brand: #f28a1d
- arancione scuro: #c8680d
- antracite: #202326
- testo principale: #161719
- testo secondario: #5f6873
- sfondo principale: #ffffff
- sfondo secondario: #f4f6f8
- bordi: #dce2e8
- teal secondario: #1f6672
- verde secondario: #4d6b5a
Font:
- Inter
- fallback system-ui
Uso dell'arancione:
L'arancione è il colore del brand, non un colore semantico.
Usalo per:
- azioni primarie;
- voce di navigazione attiva;
- focus e selezioni;
- piccoli accenti visivi;
- collegamenti importanti.
Non usarlo per rappresentare urgenza o rischio.
Per le priorità usa colori semantici distinti:
- rosso per criticità o scadenze superate;
- ambra per priorità alta o scadenza vicina;
- colori neutri per normale e bassa;
- verde per esito positivo o completato.
Ogni stato deve essere comunicato con:
- colore;
- icona;
- etichetta testuale.
Mai con il solo colore.

STILE GENERALE
Lo stile deve essere:
- pulito;
- luminoso;
- professionale;
- sobrio;
- moderno ma non "tech startup";
- molto leggibile;
- con spazio bianco sufficiente;
- con angoli leggermente arrotondati;
- con ombre morbide e poco invasive;
- con una gerarchia visiva evidente.
Evita:
- gradienti decorativi;
- colori eccessivamente saturi;
- animazioni inutili;
- glassmorphism;
- card annidate dentro altre card senza motivo;
- ombre pesanti;
- interfacce troppo "giocose";
- emoji come icone operative;
- densità tipica di un pannello tecnico.

PRINCIPI VINCOLANTI

1. GERARCHIA PRIMA DI TUTTO
Gli elementi urgenti devono dominare visivamente.
Le informazioni secondarie devono avere meno peso o poter essere aperte su
richiesta.
Non assegnare la stessa importanza grafica a:
- urgenze;
- statistiche;
- importi;
- pratiche aperte;
- dati informativi;
- configurazioni tecniche.

2. PROGRESSIVE DISCLOSURE
Mostra inizialmente soltanto ciò che serve per decidere o agire.
Dettagli, colonne aggiuntive e filtri avanzati devono essere disponibili, ma non
aperti tutti contemporaneamente.

3. LEGGIBILITÀ
Usa:
- almeno 16 px per il testo operativo principale;
- interlinea sufficiente;
- contrasto elevato;
- spaziatura generosa;
- aree cliccabili di almeno 44 px;
- titoli chiaramente distinguibili;
- label sempre visibili sugli input.
Non sacrificare la leggibilità per mostrare più informazioni nello stesso spazio.

4. LINGUAGGIO SEMPLICE
Preferisci etichette concrete come:
- Da fare oggi
- Scadute
- Da verificare
- In attesa
- Completa i dati
- Crea risposta
Evita nella vista operativa termini come:
- confidence;
- pipeline;
- provider;
- dead-letter;
- mock;
- token;
- payload;
- fase tecnica.
Questi termini possono rimanere esclusivamente nelle impostazioni tecniche.

5. COERENZA
La stessa categoria deve avere sempre:
- stessa icona;
- stesso colore;
- stessa etichetta.
La stessa azione deve trovarsi, per quanto possibile, nella stessa posizione.
I pulsanti devono avere una gerarchia coerente:
- primario;
- secondario;
- terziario;
- distruttivo.

6. ACCESSIBILITÀ
L'interfaccia deve essere completamente utilizzabile da tastiera.
Prevedi:
- focus visibile;
- ordine di tabulazione corretto;
- label associate ai campi;
- contrasto sufficiente;
- stato hover e stato focus distinti;
- icone accompagnate da testo o aria-label;
- nessuna informazione trasmessa unicamente dal colore.

FASTIDI CONCRETI OSSERVATI NELL'USO ATTUALE
Questi problemi sono stati osservati navigando realmente nell'app e devono
guidare le proposte di design.

DASHBOARD
La dashboard attuale appare troppo densa.
Sono presenti molti KPI con peso visivo simile, anche quando rappresentano
informazioni di importanza diversa.
Questo rende difficile capire immediatamente:
- cosa sia urgente;
- cosa richieda un'azione;
- cosa sia soltanto una statistica.
Non deve sembrare che ogni numero abbia la stessa priorità.
La parte iniziale dovrebbe privilegiare pochi indicatori operativi, per esempio:
- Da gestire oggi
- Scadute
- Urgenze
- Importi in scadenza
- Da verificare
Le informazioni meno operative possono stare in una sezione secondaria come
"Panoramica", eventualmente comprimibile.
Evita ridondanze tra indicatori concettualmente simili, come:
- preventivi da rispondere e preventivi aperti;
- reclami urgenti e reclami aperti;
- multe urgenti e multe aperte.

FILTRI
Quando un KPI applica un filtro, oggi non è sempre evidente che la lista sia
stata filtrata.
Il filtro non deve rimanere nascosto nello stato della pagina.
Deve essere visibile tramite chip o riepilogo, per esempio:
- Reclami
- Priorità urgente
- Scadenza oggi
Ogni chip deve poter essere rimosso singolarmente.
Deve essere presente anche un'azione chiara:
"Rimuovi tutti i filtri"
I filtri avanzati devono essere chiusi di default.
Le date devono spiegare a cosa si riferiscono, per esempio:
- Data ricezione email
- Data scadenza
- Data creazione pratica
Non usare semplicemente "Data da" e "Data a" senza contesto.

TABELLA DELLE PRATICHE
La tabella contiene molte informazioni e richiede troppo sforzo per essere
scansionata.
La vista predefinita deve mostrare soltanto le colonne essenziali, indicativamente:
- tipo;
- titolo o oggetto;
- cliente;
- scadenza;
- priorità;
- stato.
Le colonne aggiuntive devono poter essere attivate tramite un controllo
"Personalizza colonne".
Non duplicare la stessa informazione in più punti della stessa riga.
Per esempio, se "Da verificare" è già indicato nella colonna Stato, non deve
essere ripetuto anche sotto il titolo senza una ragione precisa.
Le righe cliccabili devono sembrare chiaramente cliccabili attraverso:
- hover;
- cambio dello sfondo;
- cursore;
- eventuale indicatore laterale o freccia discreta.
Sostituisci gli emoji delle categorie con icone coerenti provenienti da un'unica
libreria.
Le icone non devono cambiare aspetto tra sistemi operativi.

DETTAGLIO PRATICA
Il dettaglio pratica è la schermata più importante dell'app.
In precedenza richiedeva molto scroll e mostrava troppe sezioni e azioni
ripetute.
Verifica la struttura attuale dopo le fasi precedenti.
Se sono già presenti tab o una nuova organizzazione, mantienile.
Il redesign deve rendere evidente:
- identificativo della pratica;
- categoria;
- stato;
- priorità;
- responsabile;
- scadenza;
- prossima azione.
L'intestazione della pratica deve avere un peso visivo forte e rimanere
riconoscibile anche durante la navigazione.
Le azioni principali devono essere chiaramente distinte dalle azioni secondarie.
Azioni come:
- Assegna
- Cambia stato
- Crea risposta
- Completa pratica
devono essere facili da trovare e non disperse in punti diversi della pagina.
Evita un enorme pulsante isolato "Segna completata" a fondo pagina.

DATI ESTRATTI
La gestione dei dati estratti appariva visivamente molto ripetitiva.
Ogni campo mostrava contemporaneamente:
- valore;
- confidenza;
- fonte;
- conferma;
- modifica;
- salvataggio.
Questo rende la pagina pesante e difficile da leggere.
La vista normale deve privilegiare il valore.
Azioni e metadati devono comparire quando servono:
- modifica al clic;
- dettagli della fonte in popover o pannello;
- confidenza meno prominente per i campi affidabili;
- evidenza forte solo per dati mancanti, dubbi o in conflitto.
Non ripetere "Vedi email di origine" sotto ogni campo.
Usa un'icona o un'azione discreta e coerente.
I formati devono essere leggibili da un utente normale:
- 03/07/2026 invece di date ISO;
- Sì/No invece di true/false;
- € 450,00 invece di 450;
- 55% invece di 0,55.

CODA DI REVISIONE
La coda di revisione deve rendere immediatamente chiaro perché un elemento si
trovi lì.
In passato la sezione "Bassa confidenza / da verificare" conteneva anche elementi
con confidenza molto alta.
Questo è semanticamente confuso.
Distingui graficamente i motivi della revisione:
- classificazione incerta;
- dati mancanti;
- pratica non verificata;
- possibile duplicato;
- anomalia;
- scadenza critica.
Ogni card o riga deve rispondere a:
"Perché devo controllare questa pratica?"
Mostra quindi una frase concreta, per esempio:
- Manca il numero fattura
- Categoria proposta con confidenza 58%
- Possibile duplicato della pratica PRT-2026-0009
- Importo diverso tra email e allegato
Le azioni devono essere esplicite.
Evita pulsanti generici come:
- Conferma
- Verifica
Preferisci:
- Conferma categoria
- Completa i dati
- Riclassifica
- Unisci le pratiche
- Mantieni separate
I duplicati devono essere facili da confrontare visivamente, preferibilmente con
un confronto affiancato o una sintesi delle differenze.

IMPOSTAZIONI
La pagina Impostazioni è molto lunga e mescola:
- configurazioni operative;
- utenti;
- categorie;
- modelli;
- connessioni;
- monitoraggio;
- informazioni tecniche.
La navigazione deve essere suddivisa tramite menu laterale o tab.
Possibili sezioni:
1. Connessioni email
2. Automazione e soglie
3. Categorie e assegnazioni
4. Utenti e ruoli
5. Modelli di risposta
6. Monitoraggio
7. Informazioni tecniche
Le impostazioni più comuni devono essere facili da trovare.
Le informazioni per sviluppatori devono essere visivamente separate.
Un controllo non ancora funzionante non deve sembrare operativo.
Usa:
- stato disabilitato;
- badge "Non ancora attivo";
- descrizione chiara.
Non mostrare un normale input modificabile se il valore non produce alcun
effetto reale.
Quando sono presenti modifiche non salvate, prevedi una barra sticky o un
feedback sempre visibile con:
- Modifiche non salvate
- Annulla
- Salva impostazioni
Il pulsante di salvataggio non deve trovarsi soltanto dopo un lunghissimo scroll.

FEEDBACK E STATI VUOTI
Mantieni o migliora i feedback implementati nelle fasi precedenti.
Ogni azione deve produrre una conferma visibile.
Gli stati vuoti devono essere chiari e rassicuranti.
Esempi:
- Nessuna pratica urgente: tutto sotto controllo
- Nessuna pratica corrisponde ai filtri selezionati
- Non ci sono elementi da verificare
- Nessuna scadenza prevista per oggi
Quando un filtro non produce risultati, mostra anche:
"Rimuovi filtri"
Non mostrare soltanto una tabella vuota.

RESPONSIVE
Verifica almeno:
- desktop grande;
- laptop;
- tablet;
- mobile.
L'app verrà usata soprattutto da desktop e laptop, ma non deve rompersi su
schermi piccoli.
Su viewport ridotti:
- la sidebar può diventare drawer;
- le azioni principali devono restare accessibili;
- i tab devono poter scorrere;
- le tabelle devono avere una strategia responsive chiara;
- non devono comparire scroll orizzontali inutili;
- i modali non devono uscire dallo schermo;
- le aree cliccabili devono rimanere sufficientemente grandi.

METODO DI LAVORO OBBLIGATORIO
Non implementare immediatamente.
Questa prima esecuzione deve servire a:
1. analizzare l'interfaccia attuale;
2. verificare cosa è già stato modificato nelle fasi precedenti;
3. individuare i componenti condivisi;
4. proporre 2 o 3 direzioni di design alternative;
5. aspettare la mia scelta.
Per ogni direzione descrivi concretamente:
- nome della direzione;
- struttura della dashboard;
- disposizione della navigazione;
- densità delle informazioni;
- stile delle card;
- stile delle tabelle;
- utilizzo della palette;
- gerarchia tipografica;
- trattamento delle priorità;
- trattamento delle azioni principali;
- approccio al dettaglio pratica;
- approccio alla coda di revisione;
- approccio alle impostazioni;
- comportamento responsive;
- vantaggi;
- svantaggi;
- utenti per cui è più adatta.
Le proposte non devono essere variazioni quasi identiche.
Devono rappresentare alternative reali, per esempio:
- una direzione più operativa e compatta;
- una direzione più ariosa e guidata;
- una direzione intermedia e modulare.
Indica anche quale direzione consiglieresti e perché, ma non scegliere al posto
mio.

FERMATI DOPO LE PROPOSTE
Dopo aver descritto le 2-3 direzioni:
- non modificare file;
- non scrivere codice;
- non creare componenti;
- non cambiare CSS;
- non avviare l'implementazione.
Aspetta la mia scelta esplicita.

FASE DI IMPLEMENTAZIONE SUCCESSIVA
Soltanto dopo la mia scelta, implementa la direzione selezionata su:
- shell generale e navigazione;
- dashboard;
- elenco pratiche;
- dettaglio pratica;
- coda di revisione;
- impostazioni.

Implementa a tappe, in questo ordine, e alla fine di OGNI tappa esegui
typecheck, lint, test, una verifica visiva delle pagine toccate con il server
dev attivo (browser headless, come nelle fasi precedenti) e un commit git con
messaggio descrittivo prima di passare alla tappa successiva:
1. design token e componenti condivisi + shell generale e navigazione;
2. dashboard;
3. elenco pratiche e dettaglio pratica;
4. coda di revisione;
5. impostazioni;
6. passaggio finale di coerenza, responsive e accessibilità su tutte le pagine.

Se il design system non è sufficientemente coerente, crea o consolida token e
componenti condivisi per:
- colori;
- tipografia;
- spaziature;
- bordi;
- ombre;
- badge;
- pulsanti;
- input;
- card;
- tabelle;
- tab;
- modali;
- toast;
- stati vuoti;
- skeleton;
- focus.
Non duplicare lo stesso stile in più componenti.

VINCOLI TECNICI
- Non modificare la logica di business.
- Non modificare le API.
- Non cambiare il modello dati.
- Non introdurre migrazioni.
- Non eliminare funzionalità.
- Non simulare funzioni inesistenti.
- Non modificare il significato degli stati.
- Non rompere la modalità mock.
- Non aggiungere dipendenze pesanti senza una necessità concreta.
- Mantieni TypeScript rigoroso.
- Riutilizza i componenti esistenti quando sono validi.
- Sostituisci o rifattorizza i componenti soltanto quando migliora davvero
  coerenza e manutenibilità.

VERIFICA VISIVA
Dopo l'implementazione della direzione scelta:
- controlla tutte le pagine in modalità mock;
- verifica almeno uno stato popolato e uno stato vuoto;
- verifica filtri attivi e filtri chiusi;
- verifica priorità critica, alta, normale e bassa;
- verifica pratica con dati mancanti;
- verifica pratica completa;
- verifica elemento della coda di revisione;
- verifica possibile duplicato;
- verifica impostazioni con modifiche non salvate;
- verifica desktop, laptop e mobile;
- controlla hover, focus, disabled, loading ed error state.

TEST FINALI
Esegui:
- typecheck;
- lint;
- test disponibili;
- build di produzione.
Correggi tutti gli errori introdotti.

OUTPUT FINALE DOPO L'IMPLEMENTAZIONE
Fornisci:
1. riepilogo delle modifiche;
2. direzione di design implementata;
3. principali scelte di gerarchia visiva;
4. componenti condivisi creati o modificati;
5. file principali modificati;
6. verifiche responsive effettuate;
7. controlli di accessibilità effettuati;
8. test eseguiti;
9. eventuali limiti rimasti;
10. screenshot o descrizione delle principali schermate aggiornate, se il tuo
    ambiente lo consente.

CRITERI DI ACCETTAZIONE
Il redesign non è completato se:
- la dashboard continua a mostrare troppi KPI con lo stesso peso;
- non si capisce cosa richieda un'azione immediata;
- i filtri attivi rimangono poco visibili;
- la tabella mostra troppe colonne di default;
- le righe cliccabili non sembrano cliccabili;
- vengono ancora utilizzati emoji come icone operative;
- il dettaglio pratica continua a sembrare una lunga sequenza di blocchi uguali;
- le azioni principali sono difficili da trovare;
- la coda di revisione non spiega il motivo della verifica;
- le impostazioni rimangono un unico lunghissimo scroll;
- controlli non funzionanti sembrano attivi;
- testi e controlli sono troppo piccoli;
- l'arancione viene confuso con il colore dell'urgenza;
- il focus da tastiera non è visibile;
- l'interfaccia continua a sembrare un MVP tecnico anziché un gestionale
  aziendale professionale.

Inizia ora con l'analisi dell'interfaccia attuale e proponi 2-3 direzioni di
design. Non implementare nulla finché non avrò scelto.
