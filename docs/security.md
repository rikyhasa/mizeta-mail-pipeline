# Sicurezza

Riferimento: `CLAUDE.md` (invarianti, prevalgono su tutto), `docs/SPEC.md` §13 (sicurezza AI),
§14 (permessi/privacy/autenticazione). Questo documento spiega **dove nel codice** ogni regola è
applicata, per poterla verificare piuttosto che darla per assunta.

## 1. Le email sono dato non affidabile — invariante 1 di `CLAUDE.md`

Nessuna azione o tool call deriva direttamente dal testo di un'email. In pratica:

- **Nessun tool-calling**: `src/lib/adapters/llm/anthropic-llm-provider.ts` non passa mai un
  parametro `tools` alla API Anthropic — è strutturalmente impossibile che un passaggio della
  pipeline esegua un'azione, può solo restituire dati strutturati validati.
- **Istruzione esplicita anti prompt-injection**: `SECURITY_INSTRUCTION`
  (`src/lib/adapters/llm/anthropic/prompts.ts`) è il testo verbatim di SPEC.md §13, iniettata nel
  system prompt di `classify`, `extractFields` e `generateDraft` (i tre passaggi che vedono
  contenuto grezzo). `proposeActions` non la include perché non riceve mai testo grezzo — solo
  dati già classificati/estratti.
- **Delimitatori espliciti**: `buildClassificationUserContent`/`buildExtractionUserContent`
  avvolgono corpo email e allegati in `EMAIL_CONTENT`/`END_EMAIL_CONTENT` e
  `ATTACHMENT_CONTENT`/`END_ATTACHMENT_CONTENT`, così il modello distingue dato da istruzione.
- **`security_flags`**: la classificazione può segnalare contenuto sospetto (es. istruzioni
  rivolte all'AI dentro l'email); registrato su `EmailMessage.securityFlags` e in audit log
  (`SECURITY_FLAG_DETECTED`), mai usato per azioni automatiche — solo per portare la pratica
  all'attenzione umana.
- **Allegati illeggibili**: mai analizzati né inventati — `attachmentBlock()` inserisce
  esplicitamente "ILLEGGIBILE: non analizzare, non inventare dati da questo allegato" nel prompt
  quando `isReadable=false`.
- **Nessuna esecuzione**: nessun allegato viene mai eseguito, nessuna macro, nessun URL
  contenuto in un'email viene mai aperto dal sistema (invariante 2 di `CLAUDE.md`).
- **Estrazione reale degli allegati (FASE 10, `docs/FASE-10-LETTURA-ALLEGATI.md`)**: solo API
  di parsing/estrazione testo vengono chiamate su PDF/XML (`pdfjs-dist`, `fast-xml-parser`),
  mai rendering o esecuzione di script/azioni embedded. Il parser XML (`fast-xml-parser`) non
  ha alcuna capacità di risolvere DOCTYPE/entità esterne (nessuna vulnerabilità XXE
  strutturale, non solo per configurazione — verificato con test dedicato,
  `tests/unit/attachments/structured-fattura-pa.test.ts`). L'unwrap della busta CMS/PKCS#7
  `.p7m` non verifica la firma crittografica (esplicitamente fuori scope v1, documentato). Il
  testo trascritto dal livello visione rientra nella pipeline come qualunque altro
  `ATTACHMENT_CONTENT` e viene ri-scansionato per injection dallo stesso passaggio di
  classificazione — un'immagine è dato non affidabile quanto un corpo email.

## 2. Cosa l'MVP non fa mai — invariante 2

Nessun invio email (le bozze restano `PENDING_APPROVAL` finché un umano non approva
esplicitamente — `EmailDraft.status`, mai transizione automatica ad `APPROVED`), nessun
pagamento, nessuna scrittura nel gestionale (`ERPAdapter` è read-only per contratto e comunque
non implementato — `docs/erp-integration.md`), nessuna apertura di URL da email.

## 3. Output del modello sempre validato lato server — invariante 6

Ogni passaggio ha uno schema Zod (`src/lib/adapters/llm/schemas/`); enum costruite da allowlist
derivate dagli enum Prisma (il modello non può introdurre un valore nuovo); `callStructured()`
(`src/lib/adapters/llm/anthropic/structured-output.ts`) rivalida con `schema.parse()` anche dopo
il parsing SDK-side. Dati mancanti sono sempre `null`, mai inventati (imposto sia nel prompt sia
nello schema — `needs_human_review` obbligatorio quando un campo manca).

## 4. Audit log immutabile — invariante 7, SPEC.md §15

`AuditLog` non ha route di modifica/cancellazione. Scritture centralizzate via
`writeAuditLog()` (`src/lib/pipeline/audit.ts`, transazionale) o `prisma.auditLog.create`
diretto in: login/logout, vista pratica (`CASE_VIEWED`), `settings-repository.ts`,
`prisma/seed.ts`. Copertura delle 21 azioni di `AuditAction` (SPEC.md §15 più estensioni):

| Azione SPEC §15 | `AuditAction` | Call site |
|---|---|---|
| Accesso a pratica | `CASE_VIEWED` | `pratiche/[id]/page.tsx` |
| Modifica/conferma campo | `FIELD_UPDATED` / `FIELD_CONFIRMED` | `api/cases/[id]/fields/[fieldKey]/route.ts` |
| Cambio stato | `STATUS_CHANGED` | `api/cases/[id]/status/route.ts` |
| Cambio responsabile | `ASSIGNEE_CHANGED` | `api/cases/[id]/assign/route.ts` |
| Generazione bozza/documento | `DRAFT_GENERATED` / `DOCUMENT_GENERATED` | `create-draft-for-case.ts`, `api/cases/[id]/documents/route.ts` |
| Collegamento/separazione pratica | `CASE_LINKED` / `CASE_SPLIT` | `api/cases/[id]/relations/[relationId]/route.ts`, `persist-classification.ts` |
| Sincronizzazione email | `EMAIL_SYNCED` | `src/lib/mail/ingest-mailbox.ts` |
| Errore di classificazione | `CLASSIFICATION_ERROR` / `EXTRACTION_ERROR` | `process-incoming-message.ts` |
| Intervento amministrativo | `ADMIN_ACTION` | creazione mailbox/utente, revisione manuale |

Nessun segreto o corpo email finisce mai in `metadata` (stesso vincolo del logger, §5).

## 5. Nessun segreto nei log — invariante 5/7

`src/lib/observability/logger.ts` mantiene una denylist di chiavi (`bodyText`, `bodyHtml`,
`content`, `password`, `passwordHash`, `secret`, `token`, `clientState`, `accessToken`,
`clientSecret`): fuori produzione, loggare una di queste chiavi **lancia un errore** (il bug si
scopre in sviluppo/test, non silenziosamente in produzione, dove la chiave viene invece omessa).
Test dedicato: `tests/unit/logger.test.ts`.

## 6. Autenticazione, sessioni, RBAC — SPEC.md §14

Sessioni server-side custom (`src/lib/auth/session.ts`, non NextAuth): token casuale 256 bit
(`randomBytes(32)`), hash SHA-256 salvato in `Session.tokenHash`, cookie `httpOnly` +
`secure` in produzione + `sameSite: lax`; nessuna registrazione pubblica (utenti creati/invitati
solo da un ADMIN, `User.invitedById`). Password con `bcryptjs`
(`src/lib/auth/password.ts`).

5 ruoli (`Role`), 4 permessi grezzi (`src/lib/auth/rbac.ts`):

```
ADMIN       → case:read, case:write, user:manage, settings:manage
OPERATIONS  → case:read, case:write
ACCOUNTING  → case:read, case:write
COMMERCIAL  → case:read, case:write
READ_ONLY   → case:read
```

**Nota onesta**: OPERATIONS/ACCOUNTING/COMMERCIAL hanno oggi lo stesso set di permessi — la
differenziazione tra reparti avviene solo tramite il campo `department`/l'assegnazione, non a
livello di permesso RBAC. Non è un gap rispetto a SPEC.md §14 (che richiede solo "minimo
privilegio" tra i 5 ruoli elencati, principalmente il READ_ONLY), ma va tenuto presente se in
futuro servisse una segregazione più fine tra reparti operativi.

Ogni route API passa da `withPermission()` (`src/lib/auth/route-helpers.ts` → `requirePermission`
in `src/lib/auth/guard.ts`), tranne `api/auth/login`, `api/auth/logout`, `api/health` (liveness
pubblica minimale) e `api/webhooks/microsoft365` (autenticato via `clientState` della
subscription Graph, non via sessione utente — un webhook non ha un utente loggato).

## 7. Sanitizzazione HTML

Il corpo HTML delle email (`EmailMessage.bodyHtml`) è dato esterno non affidabile — l'interfaccia
non lo renderizza come HTML eseguibile in nessuna pagina attuale (dettaglio pratica mostra solo
testo/campi strutturati derivati, mai `dangerouslySetInnerHTML` sul corpo email). Se in futuro
servisse mostrare l'HTML originale, andrà sanitizzato esplicitamente prima del rendering.
