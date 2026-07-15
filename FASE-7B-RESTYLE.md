# FASE 7B — Restyle su riferimento visivo (prompt)

> Uso: `/clear`, modalità Plan, incollare il blocco sotto.
> Prerequisito: `docs/design-reference-codex.css` è già nel repo (CSS di una demo
> il cui aspetto visivo è il riferimento da raggiungere).

---

Leggi prima integralmente:
- CLAUDE.md
- FASE-7-REDESIGN.md (i principi, i fastidi concreti e i criteri di accettazione
  restano tutti validi)
- docs/design-reference-codex.css — è il CSS completo di una demo il cui aspetto
  visivo mi convince molto più del restyle attuale. Studialo con attenzione:
  layout, componenti, proporzioni, spaziature, tipografia, micro-dettagli.
- docs/design-reference/ — contiene anche tre componenti della stessa demo
  (app-shell.tsx, cases-table.tsx, case-detail.tsx): mostrano come le classi
  del CSS si combinano nel markup reale. Solo riferimento, non copiarli.

CONTESTO
La Fase 7 ha già sistemato struttura e funzionalità dell'interfaccia (chip dei
filtri, personalizza colonne, tab nelle impostazioni, coda di revisione con
motivo, azioni raggruppate, componenti condivisi): NON regredire nulla di tutto
questo. Il problema rimasto è il linguaggio visivo: l'app non ha ancora
l'aspetto di un gestionale enterprise maturo. La demo di riferimento ce l'ha.

OBIETTIVO
Portare il linguaggio visivo della demo di riferimento dentro l'app esistente,
mantenendo tutte le funzionalità e i miglioramenti attuali.

ELEMENTI DA REPLICARE DALLA DEMO (vedi design-reference-codex.css):
- Shell a due colonne con SIDEBAR SCURA sticky: brand mark in alto, voci di
  navigazione con icona, voce attiva evidenziata con sfondo più chiaro e barra
  laterale in accento arancione (inset box-shadow), footer sidebar con avatar
  utente e ruolo.
- TOPBAR bianca sticky: campo di ricerca globale, indicatore di stato
  sincronizzazione a pillola ("pill" verde con pallino), azioni utente.
- Intestazione di pagina con EYEBROW arancione in maiuscolo sopra il titolo,
  titolo grande con letter-spacing negativo, sottotitolo in colore attenuato.
- CARD METRICHE: bordo superiore colorato di 3px SOLO per le card di alert,
  icona in un quadratino con sfondo tenue, valore grande e bold, etichetta
  piccola sotto. Le statistiche secondarie in una "stats strip" unica
  orizzontale divisa da bordi, non in card separate.
- TABELLA in un "panel" con bordo e radius: intestazioni micro in maiuscolo con
  letter-spacing e sfondo leggermente diverso, righe con hover delicato, cella
  tipo con icona in quadratino, link pratica bold che diventa arancione in hover.
- Badge di priorità/stato a pillola con sfondo tenue + testo scuro dello stesso
  tono (mai colori pieni saturi).
- DETTAGLIO PRATICA a due colonne: contenuto principale a sinistra, colonna
  laterale sticky a destra con azioni impilate a tutta larghezza e metadati.
- Griglia dei campi estratti compatta a 2 colonne con separatori sottili,
  label micro in maiuscolo, valore bold.
- Timeline verticale con pallini connessi da una linea per la cronologia.
- LOGIN a due colonne: pannello visuale scuro con copy e decorazione geometrica
  (cerchio arancione trasparente), form a destra.
- Ombre quasi impercettibili (0 1px 2px), radius 8-12px, densità controllata.

PALETTE — VINCOLANTE
La base sono i colori del logo Zeta Transport: arancione, bianco, nero/antracite.
- Sidebar e superfici scure: antracite #202326 (variante più chiara per hover e
  voce attiva, es. #2c3236) — NON il navy della demo.
- Accento brand: arancione #f28a1d (scuro #c8680d per hover) — NON l'arancione
  della demo.
- Sfondi: #ffffff e #f4f6f8; bordi #dce2e8; testo #161719 / #5f6873.
- Altri colori sono ammessi solo se usati con un senso preciso e in modo
  parsimonioso: semantici per le priorità (rosso critico, ambra alto, neutro
  normale/basso, verde completato/positivo), teal #1f6672 eventualmente per
  elementi informativi secondari. Motivare ogni uso non ovvio.
- L'arancione resta colore di brand e azione, MAI di urgenza.
- Font: Inter (già nel progetto), NON Arial della demo.

METODO
Lavora a tappe, e alla fine di OGNI tappa: typecheck, lint, test, verifica
visiva con server dev e browser headless (screenshot desktop + mobile), commit
git descrittivo.
1. Token globali e shell (sidebar scura, topbar, intestazioni pagina);
2. Dashboard (card alert, stats strip);
3. Elenco pratiche (panel, tabella, badge);
4. Dettaglio pratica (due colonne, sidebar sticky azioni, campi, timeline);
5. Coda di revisione e impostazioni (stesso linguaggio, nessuna regressione
   funzionale);
6. Login e passaggio finale di coerenza + responsive + accessibilità.

VINCOLI
- Non modificare logica di business, API, modello dati, testi funzionali.
- Non regredire le funzionalità UX della Fase 7 (chip filtri rimovibili,
  personalizza colonne, tab impostazioni, motivi nella coda di revisione,
  barra "modifiche non salvate", stati vuoti, toast).
- Mantieni focus visibile, contrasto AA, aree cliccabili ≥ 44px, testo
  operativo ≥ 16px dove già stabilito (la demo usa testi più piccoli: sui
  testi vince la Fase 7, sullo stile vince la demo).
- Non copiare letteralmente il file CSS della demo dentro l'app: traduci il
  linguaggio visivo nei componenti e token condivisi esistenti.
- Tutti i criteri di accettazione di FASE-7-REDESIGN.md restano validi.

Alla fine: riepilogo delle scelte, confronto prima/dopo per schermata,
limiti rimasti.
