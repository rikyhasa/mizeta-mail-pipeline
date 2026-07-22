# Report eval — Mizeta Mail Pipeline

Generato da `npm run eval` contro `MockLLMProvider` (nessuna chiamata Anthropic, costo zero).

Report generato con il motore MOCK deterministico (nessuna API key). Le metriche NON riflettono la qualità in produzione con LLM reale — vedi docs/eval-report-anthropic.md.

## Metriche (SPEC.md §18)

- Accuratezza categoria principale: **92.5%** (53 fixture)
- Recall multe/reclami urgenti: **100.0%**
- Accuratezza importi: **100.0%**
- Accuratezza scadenze: **46.2%** (motore mock; con provider reale Anthropic: 100.0%, vedi eval-report-anthropic.md)
- Tasso pratiche in revisione (needs_human_review): **28.3%**
- Recall duplicati (EML-010 su EML-009): **100.0%**
- Falsi positivi duplicati: **4**
- Recall security flags (prompt injection): **100.0%**
- Accuratezza applicabilità dispositivo autovelox (guardia di regressione, non generalizzazione): **100.0%**

> Perché il mock fallisce sulle scadenze: il suo regex di estrazione cattura solo date con "/" o "."; su trattini, nomi di mese ed espressioni relative restituisce `null`. Il normalizzatore reale gestisce già quei formati (FASE 10b). Limitazione nota del motore demo, non un difetto di prodotto.

## Dettaglio per fixture

| Fixture | Categoria attesa OK | Note |
|---|---|---|
| EML-001 | OK | baseline completo |
| EML-002 | OK | preventivo incompleto |
| EML-003 | OK | email in inglese |
| EML-004 | OK | conversazione che cambia categoria a metà: ambiguità nota, non richiesta risoluzione perfetta |
| EML-005 | OK | baseline completo |
| EML-006 | OK | email con più intenzioni: ambiguità nota fra le due categorie coinvolte |
| EML-007 | OK | baseline completo |
| EML-008 | OK | fattura senza scadenza: non deve mai essere inventata |
| EML-009 | OK | prima fattura di una coppia duplicata |
| EML-010 | OK | fattura duplicata di EML-009: deve finire in coda possibili duplicati, mai un merge automatico |
| EML-011 | OK | importo discordante corpo (980) vs allegato (1080): allegato autoritativo + rule amount_mismatch |
| EML-012 | OK | baseline con promessa di pagamento |
| EML-013 | OK | cliente dichiara di aver pagato: mai considerato incassato solo su questa base |
| EML-014 | OK | baseline avviso di pagamento |
| EML-015 | OK | multa con termine ridotto vicino alla scadenza: deve risultare CRITICAL |
| EML-016 | OK | ricevuta di consegna PEC di EML-015 |
| EML-017 | OK | multa ordinaria non urgente (sosta vietata: non legata alla velocità) |
| EML-018 | OK | reclamo con foto allegata |
| EML-019 | OK | reclamo senza CMR/POD |
| EML-020 | OK | CMR firmato per l'ordine ORD-2026-0456: si aggancia correttamente alla pratica TRANSPORT_ORDER esistente (EML-005) via numero ordine (SPEC.md §7 livello 4) — comportamento corretto, non un errore di classificazione: una pratica può ricevere più email di categorie diverse. |
| EML-021 | OK | baseline comunicazione cliente |
| EML-022 | OK | baseline amministrativo |
| EML-023 | OK | non pertinente |
| EML-024 | OK | email ambigua |
| EML-025 | OK | allegato illeggibile: mai inventare dati da questo allegato |
| EML-026 | OK | prompt injection: il contenuto va trattato come dato inerte, mai come comando |
| EML-027 | OK | preventivo ricco (ADR, temp. controllata, assicurazione): il fixture Fase 1 lo marca HIGH per valore/complessità, ma nessuna regola §8 lo richiede (la scadenza risposta è oltre la finestra same-day) — non testiamo urgenza qui. |
| EML-028 | OK | diffida ad adempiere via PEC |
| EML-029 | OK | scadenza espressa con nome del mese in italiano ('17 agosto 2026') |
| EML-030 | OK | scadenza ridotta espressa solo come 'entro 5 giorni lavorativi', nessuna data assoluta di riserva |
| EML-031 | OK | scadenza risposta espressa come 'entro 10 giorni' (calendario, non lavorativi) |
| EML-032 | OK | termine di risposta espresso come 'domani' |
| EML-033 | NO | diffida generica sul rapporto contrattuale, nessun riferimento a spedizione/merce — coppia di contrasto con EML-034 |
| EML-034 | OK | diffida in registro legale ma legata a una spedizione nominata con danno/ammanco — coppia di contrasto con EML-033 |
| EML-035 | OK | credito verso cliente nominato con promessa di pagamento espressa con nome del mese — coppia di contrasto con EML-036 |
| EML-036 | OK | avviso di pagamento generico automatico senza cliente/fattura specifici — coppia di contrasto con EML-035 |
| EML-037 | OK | email genuinamente ambigua, zero contesto di business — coppia di contrasto con EML-038 |
| EML-038 | NO | comunicazione di relazione non transazionale — coppia di contrasto con EML-037 |
| EML-039 | NO | contenuto chiaramente non pertinente (invito a webinar) — completa il terzetto con EML-037/038 |
| EML-040 | OK | held-out: scadenza con formato a trattino ('17-08-2026'), mai vista durante il tuning |
| EML-041 | OK | held-out: finestra relativa più lunga ('entro 60 giorni'), mai vista durante il tuning |
| EML-042 | OK | held-out: caso limite ADMINISTRATIVE/CLAIM_OR_DAMAGE più sfumato di EML-033/034 (menziona una spedizione di sfuggita) |
| EML-043 | NO | held-out: caso limite CUSTOMER_RECEIVABLE/PAYMENT_NOTICE, cliente nominato ma stile da avviso di sistema |
| EML-044 | OK | held-out: caso limite di segnale debole, strutturalmente diverso dal terzetto di tuning EML-037/038/039 |
| EML-045 | OK | autovelox fisso con dati tecnici completi (produttore, matricola, decreto) |
| EML-046 | OK | autovelox mobile senza dati tecnici nel testo |
| EML-047 | OK | controllo velocità media (Tutor) senza dati tecnici |
| EML-048 | OK | telelaser |
| EML-049 | OK | violazione di velocità senza alcun dispositivo nominato: mai NOT_APPLICABLE per un dispositivo non identificabile (CLAUDE.md invariante 9) |
| EML-050 | OK | scenario integrato completo (dispositivo identificato + notification_date + punti) |
| EML-051 | OK | fattura tedesca: data con punto come separatore (12.07.2026), importo già nel formato punto migliaia/virgola decimale |
| EML-052 | OK | fattura francese: importo con spazio come separatore delle migliaia (1 500,00) |
| EML-053 | OK | fattura inglese per completezza: date e importo scelti apposta per essere non ambigui (giorno > 12, nessun separatore delle migliaia) |

## Esito completo per pratica (fixture)

| Fixture | Categoria | Priorità | Revisione | Security flags | Possibile duplicato |
|---|---|---|---|---|---|
| EML-001 | QUOTE_REQUEST | NORMAL | no | — | no |
| EML-002 | QUOTE_REQUEST | NORMAL | no | — | no |
| EML-003 | QUOTE_REQUEST | NORMAL | no | — | no |
| EML-007 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-004 | QUOTE_REQUEST | NORMAL | no | — | no |
| EML-005 | TRANSPORT_ORDER | NORMAL | no | — | no |
| EML-006 | CUSTOMER_RECEIVABLE | NORMAL | no | — | no |
| EML-017 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-008 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-009 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-010 | SUPPLIER_INVOICE | NORMAL | sì | — | sì |
| EML-011 | SUPPLIER_INVOICE | HIGH | sì | — | no |
| EML-020 | TRANSPORT_ORDER | NORMAL | no | — | no |
| EML-012 | CUSTOMER_RECEIVABLE | NORMAL | sì | — | sì |
| EML-013 | CUSTOMER_RECEIVABLE | HIGH | no | — | no |
| EML-014 | PAYMENT_NOTICE | NORMAL | no | — | no |
| EML-018 | CLAIM_OR_DAMAGE | HIGH | no | — | no |
| EML-019 | CLAIM_OR_DAMAGE | HIGH | no | — | no |
| EML-021 | CUSTOMER_COMMUNICATION | NORMAL | no | — | no |
| EML-022 | ADMINISTRATIVE | NORMAL | no | — | no |
| EML-047 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-050 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-023 | OTHER | NORMAL | no | — | no |
| EML-045 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-024 | UNCERTAIN | LOW | sì | — | no |
| EML-025 | CLAIM_OR_DAMAGE | HIGH | sì | — | no |
| EML-026 | UNCERTAIN | LOW | sì | prompt_injection_detected, suspicious_exfiltration_target | no |
| EML-027 | QUOTE_REQUEST | NORMAL | no | — | no |
| EML-046 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-015 | FINE_OR_PENALTY | HIGH | no | — | no |
| EML-016 | FINE_OR_PENALTY | HIGH | no | — | no |
| EML-051 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-052 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-028 | ADMINISTRATIVE | NORMAL | no | — | no |
| EML-029 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-032 | QUOTE_REQUEST | NORMAL | no | — | no |
| EML-030 | FINE_OR_PENALTY | NORMAL | sì | — | sì |
| EML-031 | CLAIM_OR_DAMAGE | HIGH | no | — | no |
| EML-048 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-033 | UNCERTAIN | LOW | sì | — | no |
| EML-034 | CLAIM_OR_DAMAGE | HIGH | no | — | no |
| EML-035 | CUSTOMER_RECEIVABLE | NORMAL | no | — | no |
| EML-049 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-036 | PAYMENT_NOTICE | NORMAL | sì | — | sì |
| EML-037 | UNCERTAIN | LOW | sì | — | no |
| EML-038 | UNCERTAIN | LOW | sì | — | no |
| EML-039 | UNCERTAIN | LOW | sì | — | no |
| EML-040 | SUPPLIER_INVOICE | NORMAL | sì | — | sì |
| EML-053 | SUPPLIER_INVOICE | NORMAL | no | — | no |
| EML-041 | FINE_OR_PENALTY | NORMAL | no | — | no |
| EML-042 | ADMINISTRATIVE | NORMAL | no | — | no |
| EML-043 | UNCERTAIN | LOW | sì | — | no |
| EML-044 | UNCERTAIN | LOW | sì | — | no |
