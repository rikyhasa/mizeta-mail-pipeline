# Modello dati

Riferimento: `docs/SPEC.md` §5. Fonte di verità: `prisma/schema.prisma`. Questo documento
spiega le relazioni e gli invarianti che non sono ovvi dal solo schema.

## 1. Entità principali e relazioni

```
MailboxConnection 1—* EmailThread 1—* EmailMessage *—1 Case
                                          |
                                          *— Attachment
Case 1—* CaseField, CaseDeadline, Task, Comment, CaseRelation,
         ClassificationRun, ExtractionRun, ActionProposalRun,
         EmailDraft, GeneratedDocument, AuditLog
Case *—1 Customer / Supplier (opzionali)
Case 1—* ShipmentReference, InvoiceReference (opzionali, collegamento a Vehicle/Driver)
```

**La pratica (`Case`) è separata dall'email (`EmailMessage`)**: più email (anche di thread
diversi) possono appartenere alla stessa pratica (`EmailMessage.caseId`); una pratica nasce
dalla prima email che la genera e viene arricchita da quelle successive tramite il motore di
associazione (`docs/ai-pipeline.md` §3, SPEC.md §7).

## 2. Provenienza dei dati estratti — `CaseField`

Ogni campo estratto (`CaseField`) porta con sé `value`, `normalizedValue`, `confidence`,
`sourceType` (`EMAIL_BODY | EMAIL_SUBJECT | ATTACHMENT | MANUAL | SYSTEM`),
`sourceMessageId`/`sourceAttachmentId`/`sourcePage`/`sourceExcerpt` (per aprire la fonte in un
clic in UI) e `needsHumanReview`. `confirmedById`/`confirmedAt` sono valorizzati solo da
un'azione umana esplicita (`FIELD_CONFIRMED`), mai dalla pipeline. Un dato mancante è sempre
`value: null`, mai un valore inventato (invariante 6 di `CLAUDE.md`).

## 3. Enum e stati

- `CaseCategory` (12 valori, SPEC.md §5) — `UNCERTAIN` è l'esito quando la confidenza di
  classificazione è sotto soglia (`RuleSettings.classificationConfidenceThreshold`).
- `CaseStatus` (8 valori) — il motore di regole può solo portare a `NEEDS_REVIEW`, mai
  regredire una pratica a `NEW` (vedi `src/lib/rules/engine.ts`).
- `CasePriority` (4 valori, ordine `LOW < NORMAL < HIGH < CRITICAL`) — le regole possono solo
  escalare, mai declassare (stesso file).
- `AuditAction` (21 valori) — copre ogni azione elencata in SPEC.md §15; vedi
  `docs/security.md` §4 per l'elenco completo con i call site.
- `FieldSourceType`, `DeadlineKind`, `TaskStatus`, `CaseRelationKind/Status`,
  `EmailDraftStatus`, `JobType/Status`, `GeneratedDocumentType/Format`: enum chiuse, allowlist
  per il modello AI dove pertinente (mai un nuovo enum creato dal modello).

## 4. Run della pipeline AI — `ClassificationRun` / `ExtractionRun` / `ActionProposalRun`

Ogni chiamata a un passaggio della pipeline AI (SPEC.md §6) crea una riga con
`llmProvider`, `model`, `status` (`RunStatus`), `resultJson` (l'output strutturato grezzo),
`inputTokens`/`outputTokens`/`costUsd` ed eventuale `errorMessage`. Sono la fonte per le
metriche di costo/errore in `docs/ai-pipeline.md` e per lo snapshot di osservabilità
(`src/lib/observability/metrics.ts`) — nessuna tabella di metriche separata.

## 5. Audit log — immutabilità

`AuditLog` non ha né `updatedAt` né alcuna route `PATCH`/`DELETE`: le righe si scrivono solo
tramite `writeAuditLog()` (`src/lib/pipeline/audit.ts`) o `prisma.auditLog.create` diretto nei
pochi call site elencati in `docs/security.md`. `metadata` (Json) non contiene mai segreti o
corpo email (stesso vincolo del logger, vedi `docs/privacy-checklist.md`).

## 6. Duplicati e pratiche correlate — `CaseRelation`

`kind` distingue `DUPLICATE_CANDIDATE` da `RELATED`; `status` parte sempre da `PENDING` e
richiede una revisione umana esplicita (`reviewedById`/`reviewedAt`) per diventare
`CONFIRMED`/`REJECTED` — nessun merge automatico di due pratiche, coerente con SPEC.md §7
("Mai unire automaticamente due pratiche con confidenza insufficiente").

## 7. `RuleSettings` — configurazione a riga singola

Una sola riga (`key: "default"`, upsert automatico se assente) contiene tutte le soglie
configurabili da Impostazioni (SPEC.md §16): soglia di confidenza, soglie di auto-link/possibile
duplicato, ore critiche per scadenze, soglia importo reclamo, tolleranza importi discordanti,
categorie abilitate, reparto default per categoria, retention (email/allegati/audit log),
pattern mittenti esclusi. **Nota**: i campi di retention e `excludedSenderPatterns` sono
persistiti e modificabili dall'interfaccia, ma nessun job di pulizia o filtro di ingestione li
applica ancora — vedi `docs/privacy-checklist.md` §3 e `docs/dod-report.md`.

## 8. Entità di business (`Customer`, `Supplier`, `Vehicle`, `Driver`, `ShipmentReference`,
`InvoiceReference`)

Popolate dalla pipeline di estrazione quando i dati sono presenti nell'email (mai inventate).
`Supplier.iban` alimenta la regola `iban-mismatch` (SPEC.md §8). `InvoiceReference` ha un
autoriferimento `possibleDuplicateOf` usato dalla regola `possible-duplicate` per le fatture
fornitore.
