# FASE 10 — Lettura degli allegati (prerequisito casella vera)

> Uso: `/clear`, modalità Plan, incollare il blocco sotto. Da eseguire prima
> del collegamento della casella reale; sequenza consigliata: dopo la Fase E
> (modulo autovelox), che in mock funziona già con le fixture.
> Contesto: oggi la pipeline è progettata per usare il testo degli allegati
> (ATTACHMENT_CONTENT, fonti con pagina/estratto, regola "allegato
> autoritativo"), ma non esiste alcun estrattore: con la posta reale gli
> allegati risulterebbero tutti illeggibili. Buona parte delle informazioni
> operative di Mizeta sta negli allegati: questa fase è critica.

---

Leggi CLAUDE.md e docs/SPEC.md. Obiettivo: trasformare gli allegati reali in
testo utilizzabile dalla pipeline, con provenienza per pagina, costi sotto
controllo e sicurezza invariata.

STRATEGIA A TRE LIVELLI (in ordine di costo)

1. DATI STRUTTURATI — parser dedicati, zero LLM:
   - Fattura elettronica XML (FatturaPA) e .p7m (busta firmata: estrai l'XML
     dalla firma senza verificarla crittograficamente in v1, documentalo):
     campi esatti (fornitore, P.IVA, numero, date, importi, IBAN) mappati
     direttamente sui CaseField con confidenza 1.0 e source_type dedicato.
   - postacert.eml (busta PEC): già gestita dallo scheletro PEC — riusa.
2. PDF DIGITALI — estrazione testo locale (libreria: proponi tu, es.
   pdf-parse/pdfjs; verifica manutenzione e licenza), con numero di pagina
   preservato per source_page. Gratis, nessuna chiamata esterna.
3. SCANSIONI E IMMAGINI — visione del modello via LLMProvider (Anthropic
   supporta PDF/immagini in input): usata SOLO quando il livello 2 produce
   testo assente o scarso (euristica di densità configurabile) o per formati
   immagine (jpg/png/webp/heic). Output: testo per pagina. La chiamata visione
   include le stesse istruzioni di sicurezza anti-injection della pipeline
   (il contenuto è dato non affidabile, delimitato, mai istruzioni).

PERSISTENZA E RIUSO
- Estendi il modello: testo estratto per allegato (testo per pagina, metodo di
  estrazione structured|local_text|vision, data, conteggio pagine, costo se
  visione) — proponi se campo su Attachment o tabella dedicata.
- Cache per contentHash (campo già esistente): stesso file già estratto in
  passato = riuso, nessuna nuova estrazione. Vale anche per fatture duplicate.
- isReadable diventa l'esito reale dell'estrazione (false solo dopo che tutti
  i livelli applicabili hanno fallito), con motivo registrato.

INTEGRAZIONE PIPELINE
- L'estrazione del testo avviene nel job di ingestione, PRIMA della
  classificazione: il run LLM riceve gli ATTACHMENT_CONTENT già popolati.
- Nessuna esecuzione di contenuti: solo parsing. Limiti configurabili: max
  dimensione file, max pagine per documento (default ragionevole, es. 20),
  timeout per estrazione. Oltre i limiti: allegato parzialmente estratto con
  nota, mai bloccare l'intera email.
- Metriche in osservabilità: allegati processati per metodo, fallimenti,
  costo visione cumulato, pagine per documento.

COSTI (visione)
- Solo scansioni/foto passano dal modello; stima ~1-2k token/pagina.
- Budget: parametro configurabile di spesa giornaliera per la visione nelle
  Impostazioni; superato il budget, gli allegati restano in coda con stato
  "estrazione rinviata" e alert, mai persi silenziosamente.

SICUREZZA
- Gli allegati restano contenuto non affidabile: nessuna macro, nessuna
  esecuzione, parser con limiti. Il testo estratto entra nel contesto del
  modello SOLO dentro i delimitatori esistenti. I test di prompt injection
  vanno estesi con injection dentro un allegato (testo e visione).

TEST
PDF digitale multi-pagina con source_page corretto; PDF scansionato → percorso
visione (mockato nei test, reale nell'eval); immagine foto reclamo; XML
FatturaPA → campi esatti senza LLM; .p7m → estrazione XML dalla busta; file
corrotto → isReadable false con motivo; file oltre i limiti → estrazione
parziale; contentHash identico → nessuna seconda estrazione; injection in
allegato → flag di sicurezza; budget visione esaurito → stato rinviato.
Estendi il dataset eval con 5+ fixture di allegati realistici e misura
l'accuratezza dell'estrazione campi da allegato (era il punto forte promesso
dalla spec: "importo discordante, allegato autoritativo").

MULTILINGUA (l'analisi della mail è una delle fasi più delicate: prudenza prima di tutto)
- La classificazione è già indipendente dalla lingua (fixture inglese al 100%):
  qui si tratta di renderla robusta sui FORMATI locali, nel normalizzatore
  deterministico, senza toccare il comportamento sulle email italiane.
- Regole di normalizzazione date: la lingua dell'email decide il formato di
  default (italiano → sempre giorno/mese, il formato USA non viene mai
  considerato; inglese → possibile mese/giorno). Casi auto-risolventi (un
  valore > 12) risolti deterministicamente. Casi davvero ambigui (es.
  "07/06/2026" in email inglese): MAI indovinare → needs_human_review con
  entrambe le interpretazioni mostrate all'operatore ("7 giugno o 6 luglio?").
- Importi: gestire separatori invertiti ("1,500.00" vs "1.500,00") con la
  stessa logica guidata dalla lingua; ambiguità reale → revisione umana.
- Bozze di risposta: generate nella lingua dell'email del mittente, con la
  lingua rilevata mostrata all'operatore accanto alla bozza.
- Dataset eval: aggiungi 4-5 fixture in inglese, tedesco e francese con date
  in formato locale (incluso USA mese/giorno ambiguo e non), importi con
  separatori invertiti, e una fixture ambigua che DEVE finire in revisione.
  Misura che nessuna fixture italiana esistente cambi esito.

MOCK MODE
Invariata: le fixture continuano a fornire testo pronto; il percorso di
estrazione reale deve essere testabile con file di esempio locali senza
API key (livelli 1-2) e con provider visione mockato (livello 3).

Al termine: typecheck, lint, test, eval; aggiorna docs/SPEC.md e
docs/email-integration.md; riepilogo con costi stimati per volume tipico
(es. 50 email/giorno con 1,5 allegati medi); commit per tappe.

NOTA (FASE 11, punto A1): la dimensione eval "applicabilità dispositivo
autovelox" (verbale senza segnali riconoscibili → `TO_BE_IDENTIFIED`, mai
`NOT_APPLICABLE`) è coperta oggi solo da un test unitario
(`tests/unit/llm/mock-analyze-enforcement-device.test.ts`). Costruire qui,
insieme all'estensione del dataset già prevista in questa fase (fixture
multilingua, allegati), una vera dimensione eval dedicata: nuova fixture seed
+ campo `expectedApplicability` in `eval/dataset.ts` + metrica in
`eval/metrics.ts` + verifica che `run-pipeline-eval.ts` invochi davvero il
passaggio di analisi dispositivo (oggi copre solo classificazione/estrazione).
