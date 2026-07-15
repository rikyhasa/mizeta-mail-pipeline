# Confronto eval — Mock vs Anthropic reale

Modello: `claude-sonnet-5`. Generato da `scripts/anthropic-eval-compare.ts` (NON riproducibile a costo zero).

Token totali: 378888 input / 115446 output — Costo reale: **$2.8684**

## Metriche — complessivo (44 fixture)

| Metrica | Mock | Anthropic |
|---|---|---|
| Accuratezza categoria | 90.9% | 95.5% |
| Recall multe/reclami urgenti | 100.0% | 100.0% |
| Accuratezza importi | 100.0% | 100.0% |
| Accuratezza scadenze | 30.0% | 100.0% |
| Tasso revisione | 31.8% | 29.5% |
| Recall duplicati | 100.0% | 100.0% |
| Recall security flags | 100.0% | 100.0% |

## Metriche — solo tuning (39 fixture, usate durante l'iterazione)

| Metrica | Mock | Anthropic |
|---|---|---|
| Accuratezza categoria | 92.3% | 94.9% |
| Recall multe/reclami urgenti | 100.0% | 100.0% |
| Accuratezza importi | 100.0% | 100.0% |
| Accuratezza scadenze | 37.5% | 100.0% |
| Tasso revisione | 25.0% | 25.0% |
| Recall duplicati | 100.0% | 100.0% |
| Recall security flags | 100.0% | 100.0% |


> Fixture held-out (5): EML-040, EML-041, EML-042, EML-043, EML-044 — mai ispezionate né usate per calibrare prompt/normalizzatore durante il tuning (docs/evaluation.md §2.4).
## Metriche — solo held-out (5 fixture)

| Metrica | Mock | Anthropic |
|---|---|---|
| Accuratezza categoria | 80.0% | 100.0% |
| Recall multe/reclami urgenti | 100.0% | 100.0% |
| Accuratezza importi | 100.0% | 100.0% |
| Accuratezza scadenze | 0.0% | 100.0% |
| Tasso revisione | 6.8% | 4.5% |
| Recall duplicati | 100.0% | 100.0% |
| Recall security flags | 100.0% | 100.0% |

## Confronto per fixture

| Fixture | Mock categoria/priorità | Anthropic categoria/priorità | Categoria concorde |
|---|---|---|---|
| EML-001 | QUOTE_REQUEST / NORMAL | QUOTE_REQUEST / NORMAL | sì |
| EML-002 | QUOTE_REQUEST / NORMAL | QUOTE_REQUEST / NORMAL | sì |
| EML-003 | QUOTE_REQUEST / NORMAL | QUOTE_REQUEST / NORMAL | sì |
| EML-004 | QUOTE_REQUEST / NORMAL | QUOTE_REQUEST / HIGH | sì |
| EML-005 | TRANSPORT_ORDER / NORMAL | TRANSPORT_ORDER / NORMAL | sì |
| EML-006 | CUSTOMER_RECEIVABLE / NORMAL | TRANSPORT_ORDER / NORMAL | no |
| EML-007 | SUPPLIER_INVOICE / NORMAL | SUPPLIER_INVOICE / NORMAL | sì |
| EML-008 | SUPPLIER_INVOICE / NORMAL | SUPPLIER_INVOICE / NORMAL | sì |
| EML-009 | SUPPLIER_INVOICE / NORMAL | SUPPLIER_INVOICE / NORMAL | sì |
| EML-010 | SUPPLIER_INVOICE / NORMAL | SUPPLIER_INVOICE / NORMAL | sì |
| EML-011 | SUPPLIER_INVOICE / HIGH | SUPPLIER_INVOICE / HIGH | sì |
| EML-012 | CUSTOMER_RECEIVABLE / NORMAL | CUSTOMER_RECEIVABLE / NORMAL | sì |
| EML-013 | CUSTOMER_RECEIVABLE / HIGH | CUSTOMER_RECEIVABLE / HIGH | sì |
| EML-014 | PAYMENT_NOTICE / NORMAL | PAYMENT_NOTICE / NORMAL | sì |
| EML-015 | FINE_OR_PENALTY / HIGH | FINE_OR_PENALTY / HIGH | sì |
| EML-016 | FINE_OR_PENALTY / HIGH | FINE_OR_PENALTY / HIGH | sì |
| EML-017 | FINE_OR_PENALTY / NORMAL | FINE_OR_PENALTY / HIGH | sì |
| EML-018 | CLAIM_OR_DAMAGE / HIGH | CLAIM_OR_DAMAGE / HIGH | sì |
| EML-019 | CLAIM_OR_DAMAGE / HIGH | CLAIM_OR_DAMAGE / HIGH | sì |
| EML-020 | TRANSPORT_ORDER / NORMAL | TRANSPORT_ORDER / NORMAL | sì |
| EML-021 | CUSTOMER_COMMUNICATION / NORMAL | CUSTOMER_COMMUNICATION / LOW | sì |
| EML-022 | ADMINISTRATIVE / NORMAL | UNCERTAIN / NORMAL | no |
| EML-023 | OTHER / NORMAL | OTHER / LOW | sì |
| EML-024 | UNCERTAIN / LOW | CUSTOMER_COMMUNICATION / LOW | no |
| EML-025 | CLAIM_OR_DAMAGE / HIGH | CLAIM_OR_DAMAGE / HIGH | sì |
| EML-026 | UNCERTAIN / LOW | OTHER / HIGH | no |
| EML-027 | QUOTE_REQUEST / NORMAL | QUOTE_REQUEST / HIGH | sì |
| EML-028 | ADMINISTRATIVE / NORMAL | ADMINISTRATIVE / HIGH | sì |
| EML-029 | SUPPLIER_INVOICE / NORMAL | SUPPLIER_INVOICE / NORMAL | sì |
| EML-030 | FINE_OR_PENALTY / NORMAL | FINE_OR_PENALTY / HIGH | sì |
| EML-031 | CLAIM_OR_DAMAGE / HIGH | CLAIM_OR_DAMAGE / HIGH | sì |
| EML-032 | QUOTE_REQUEST / NORMAL | QUOTE_REQUEST / CRITICAL | sì |
| EML-033 | UNCERTAIN / LOW | ADMINISTRATIVE / HIGH | no |
| EML-034 | CLAIM_OR_DAMAGE / HIGH | CLAIM_OR_DAMAGE / HIGH | sì |
| EML-035 | CUSTOMER_RECEIVABLE / NORMAL | CUSTOMER_RECEIVABLE / NORMAL | sì |
| EML-036 | PAYMENT_NOTICE / NORMAL | PAYMENT_NOTICE / NORMAL | sì |
| EML-037 | UNCERTAIN / LOW | CUSTOMER_COMMUNICATION / NORMAL | no |
| EML-038 | UNCERTAIN / LOW | CUSTOMER_COMMUNICATION / LOW | no |
| EML-039 | UNCERTAIN / LOW | OTHER / LOW | no |
| EML-040 | SUPPLIER_INVOICE / NORMAL | SUPPLIER_INVOICE / NORMAL | sì |
| EML-041 | FINE_OR_PENALTY / NORMAL | FINE_OR_PENALTY / HIGH | sì |
| EML-042 | ADMINISTRATIVE / NORMAL | ADMINISTRATIVE / HIGH | sì |
| EML-043 | UNCERTAIN / LOW | CUSTOMER_RECEIVABLE / NORMAL | no |
| EML-044 | UNCERTAIN / LOW | CUSTOMER_COMMUNICATION / LOW | no |
