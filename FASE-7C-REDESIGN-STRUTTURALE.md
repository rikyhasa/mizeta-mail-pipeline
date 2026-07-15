# FASE 7C — Redesign strutturale (seconda passata)

> Sostituisce FASE-7B-RESTYLE.md (non eseguirla separatamente: questo prompt la
> ingloba). Uso: `/clear`, modalità Plan, incollare il blocco sotto.

---

Leggi prima integralmente:
- CLAUDE.md
- FASE-7-REDESIGN.md (principi, linguaggio semplice, accessibilità e criteri di
  accettazione restano tutti validi)
- docs/design-reference-codex.css e docs/design-reference/ (CSS e tre componenti
  di una demo esterna: il suo linguaggio visivo è il riferimento estetico —
  solo riferimento, non copiarne il codice)
- le pagine attuali di dashboard, elenco pratiche, dettaglio pratica, coda di
  revisione e impostazioni

DIAGNOSI — PERCHÉ QUESTA FASE
La Fase 7 ha ordinato l'interfaccia ma non l'ha ancora progettata visivamente:
ha uniformato i componenti senza decidere con forza cosa debba attirare
l'occhio, cosa debba restare secondario e quanto spazio debba occupare ogni
informazione. I problemi di fondo, osservati usando davvero l'app:

1. MICRO-DENSITÀ DENTRO MACRO-VUOTI. Testi, badge e azioni piccoli, dispersi
   orizzontalmente su schermi grandi; card molto più grandi del loro contenuto;
   aree vuote alternate ad aree fitte. L'occhio percorre grandi distanze vuote
   fra piccoli elementi: affatica.
2. BORDER SOUP. Quasi ogni cosa è una card bianca con bordo grigio su fondo
   grigio chiaro, ovunque, con lo stesso peso. L'ordine apparente produce
   nervosismo visivo.
3. GERARCHIA DEBOLE. Intestazioni, tab, filtri, contenuto e pannelli secondari
   hanno quasi lo stesso peso: nulla domina davvero.

Questa fase NON è una rifinitura grafica: è una riprogettazione della
composizione delle schermate, mantenendo intatte API, logica e funzionalità.

REGOLE DI COMPOSIZIONE (valide ovunque)

- Riduci drasticamente il numero di card e bordi (obiettivo: -40/50%). Non ogni
  sezione è una card: separa con spazio, titoli di sezione, sfondi leggermente
  diversi, righe divisorie, cambi tipografici. Le card restano solo per ciò che
  è davvero un'unità autonoma.
- Limita la larghezza dei contenuti testuali e dei form: aree di lettura e
  moduli a max ~900-1000px, non a tutta larghezza. Non tutte le sezioni devono
  riempire lo schermo.
- Scala tipografica netta: titolo pagina 28-32px; titolo sezione 20-22px;
  titolo card/pratica 17-18px; corpo operativo 16px; metadati 14px; microtesti
  solo dove indispensabile. Aumenta anche la dimensione di controlli, icone e
  badge rispetto a oggi.
- Struttura scura: sidebar in antracite (#202326, variante più chiara per
  hover/attivo, indicatore laterale arancione #f28a1d per la voce attiva, brand
  mark con quadratino arancione, footer con avatar/nome/ruolo). È l'elemento
  che dà profondità e identità a tutta l'app.
- Palette: arancione #f28a1d/#c8680d SOLO per brand e azioni, mai per urgenza;
  semantici per priorità (rosso critico, ambra alto, neutri, verde positivo);
  teal #1f6672 per informazioni neutre; antracite per struttura. Font Inter.
- Ogni riga/elemento cliccabile deve sembrarlo: hover evidente, cursore,
  freccia coerente (o su tutte le righe o su nessuna), altezza adeguata.
- Mostra complessità solo dove serve (progressive disclosure): ciò che è a
  posto si mostra compatto, ciò che è problematico si mostra espanso.

INTERVENTI PER SCHERMATA

DASHBOARD
- Primo livello: MASSIMO TRE blocchi operativi grandi — "Da fare oggi",
  "Scadute", "Da verificare" — con numero grande, prima scadenza o dettaglio
  utile, e azione diretta ("Apri la lista"). Peso visivo dominante.
- Secondo livello: fascia compatta unica (stile "stats strip": una barra
  orizzontale divisa da separatori, NON card separate) con le voci restanti:
  scadenze 7 giorni, preventivi da rispondere, reclami urgenti, multe urgenti.
- Elimina la sezione ambigua "Panoramica" sopra i filtri: o contiene dati
  davvero panoramici o si chiama "Elenco pratiche".
- Filtri: da pannello a TOOLBAR compatta sopra la tabella (ricerca + 3-4 select
  + "Altri filtri" che apre drawer/popover). Chip dei filtri attivi visibili
  sotto la toolbar solo quando presenti. Mantieni le funzioni esistenti.
- Tabella: righe più alte e leggibili, titolo con più peso, icone e badge più
  grandi, hover chiaro, freccia coerente.

DETTAGLIO PRATICA
- Ristruttura la testata: riga 1 breadcrumb compatto (PRT-xxxx · categoria);
  riga 2 titolo grande; sotto, fascia strutturata di metadati (stato, priorità,
  scadenza, responsabile) leggibile a colpo d'occhio; azioni in alto a destra
  ("Crea risposta" + menu "Altre azioni"). La descrizione lunga va sotto, come
  contenuto secondario. Niente card-dentro-card.
- Gerarchia delle azioni: l'azione più prominente deve essere quella sensata
  per lo stato attuale (usa i suggerimenti/stato già esistenti, senza nuova
  logica). "Completa pratica" NON deve dominare quando la pratica è da
  verificare o incompleta: spostala nel menu o rendila primaria solo quando la
  pratica è pronta.
- Tab: più presenza (testo più grande, attivo con sfondo tenue + indicatore
  spesso), in barra sticky.

DATI ESTRATTI
- Tre presentazioni diverse a seconda dello stato del dato:
  1) affidabile/confermato → compatto: label piccola, valore bold, spunta;
     modifica al clic sul valore o icona discreta. NIENTE pulsante "Conferma"
     ripetuto su ogni riga.
  2) mancante/dubbio/in conflitto → espanso ed evidente, con azione esplicita
     ("Inserisci cliente", "Risolvi conflitto").
  3) tutti gli altri → via di mezzo sobria.
- Layout a 2 colonne di campi (griglia compatta con separatori sottili, label
  micro in maiuscolo, valore bold) dentro larghezza contenuta, non righe
  singole a tutta larghezza.

BOZZE E DOCUMENTI
- Una sola bozza attiva, aperta e ben distinta (anteprima chiara, azioni fisse
  in alto). Le bozze precedenti in cronologia compatta (accordion/righe:
  "Bozza 2 — scartata — 15/07/2026"), non una sequenza di card ripetute.

CODA DI REVISIONE
- Trasformala in SPLIT-VIEW: colonna sinistra con lista compatta (titolo,
  priorità, motivo principale — un solo badge, il motivo come frase normale);
  colonna destra con il dettaglio dell'elemento selezionato (motivazioni, dati
  problematici, anteprima, azioni). L'utente lavora la coda senza entrare e
  uscire dalle pratiche. Usa SOLO le API esistenti; se un dato non è
  disponibile dagli endpoint attuali, mostra un link "Apri pratica" invece di
  inventare endpoint nuovi.
- Riduci i badge per riga: uno di priorità al massimo; rosso solo per anomalie
  davvero critiche.
- Su schermi piccoli la split-view degrada a lista + navigazione.

IMPOSTAZIONI
- Da 7 tab orizzontali a NAVIGAZIONE SECONDARIA VERTICALE (menu a sinistra
  dentro la pagina, contenuto a destra).
- Form a massimo 2 colonne. Ogni impostazione: titolo breve, descrizione di una
  riga, campo con unità di misura, eventuale esempio.
- Input e select con stile coerente col design system (altezza, bordo, focus,
  padding, icona, stato disabilitato): niente aspetto predefinito del browser.
- Le sezioni non attive: sfondo attenuato, campi realmente disabilitati, badge
  "Non ancora attivo" in alto, spiegazione. Mai campi che sembrano modificabili
  senza effetto.

LOGIN
- Due colonne: pannello sinistro antracite con messaggio di prodotto e
  decorazione geometrica discreta (cerchio arancione a bassa opacità), form
  pulito a destra.

VINCOLI
- Non modificare logica di business, API, modello dati, migrazioni.
- Non regredire le funzionalità della Fase 7 (chip filtri rimovibili,
  personalizza colonne, motivi nella coda, barra modifiche non salvate, stati
  vuoti, toast, focus visibile, ≥44px cliccabile, mai solo colore).
- Modalità mock sempre funzionante.
- Traduci il linguaggio visivo del riferimento nei token/componenti condivisi:
  non copiare file dalla design-reference.

METODO
Tappe, ognuna chiusa con typecheck, lint, test, verifica visiva con browser
headless (screenshot desktop 1920, laptop 1440, mobile) e commit git:
1. token, scala tipografica, sidebar scura, topbar, login;
2. dashboard (3 blocchi + stats strip + toolbar filtri);
3. elenco pratiche e testata + tab del dettaglio pratica;
4. dati estratti e bozze;
5. coda di revisione split-view;
6. impostazioni + passaggio finale di coerenza, responsive, accessibilità.

AUTOVALUTAZIONE FINALE (obbligatoria)
Al termine, per ogni criterio dai un giudizio onesto (ok / parziale / mancato)
con una riga di motivazione:
- al primo sguardo la dashboard dice cosa fare ORA (3 blocchi dominanti);
- i bordi/card sono visibilmente ridotti, le sezioni respirano;
- nessuna schermata ha micro-testo disperso in macro-vuoti;
- la testata del dettaglio si legge in 3 secondi;
- i dati affidabili sono compatti, solo i problematici sono evidenti;
- la coda si lavora dalla split-view senza aprire ogni pratica;
- le impostazioni hanno navigazione verticale e form a max 2 colonne;
- la scala tipografica ha livelli chiaramente distinti;
- l'app ha una struttura scura riconoscibile e un'identità, non sembra un
  pannello amministrativo generico.
