import type { CaseCategory, EnforcementCheckApplicability } from "@/generated/prisma/enums";

/**
 * Dataset di valutazione (SPEC.md §18): expected output per ciascuna delle fixture del seed.
 * Le fixture esplicitamente "ambigue" o "che cambiano categoria a metà" hanno
 * `acceptablePrimaryCategories` con più di un valore: il classificatore euristico non deve
 * risolvere perfettamente ogni ambiguità per essere considerato corretto — deve farlo per i
 * casi chiaramente enunciabili (baseline) e comportarsi in modo sicuro sui casi difficili
 * (bassa confidenza -> revisione umana, mai un dato inventato).
 */
export interface EvalExpectation {
  fixtureId: string;
  acceptablePrimaryCategories: CaseCategory[];
  expectedIsUrgent?: boolean;
  expectedNeedsHumanReview?: boolean;
  expectedSecurityFlagsNonEmpty?: boolean;
  expectedPossibleDuplicate?: boolean;
  expectedAmountField?: { fieldKey: string; value: number; toleranceAbsolute?: number };
  expectedDeadlineField?: { fieldKey: string; isoDate: string | null };
  /** Applicabilità attesa del modulo verifica autovelox (docs/SPEC-AUTOVELOX-DRAFT.md §4), solo
   * per fixture FINE_OR_PENALTY: guardia di regressione sui rami di
   * `analyzeEnforcementDeviceHeuristically`, non una misura di generalizzazione (le fixture che
   * la valorizzano sono già scritte per esercitare esattamente quel ramo). */
  expectedApplicability?: EnforcementCheckApplicability;
  isPecReceipt?: boolean;
  notes?: string;
  /** Fixture "held-out" (Fase 5): mai ispezionata né usata per calibrare prompt/normalizzatore
   * durante l'iterazione con `scripts/anthropic-diagnose-fixture.ts` — solo per la misura
   * finale, a controllo di un sovra-adattamento delle regole di confine alle fixture di
   * tuning (docs/evaluation.md §2.4). */
  heldOut?: boolean;
}

export const EVAL_DATASET: EvalExpectation[] = [
  { fixtureId: "EML-001", acceptablePrimaryCategories: ["QUOTE_REQUEST"], expectedNeedsHumanReview: false, notes: "baseline completo" },
  { fixtureId: "EML-002", acceptablePrimaryCategories: ["QUOTE_REQUEST"], expectedNeedsHumanReview: true, notes: "preventivo incompleto" },
  { fixtureId: "EML-003", acceptablePrimaryCategories: ["QUOTE_REQUEST"], notes: "email in inglese" },
  {
    fixtureId: "EML-004",
    acceptablePrimaryCategories: ["QUOTE_REQUEST", "TRANSPORT_ORDER"],
    notes: "conversazione che cambia categoria a metà: ambiguità nota, non richiesta risoluzione perfetta",
  },
  { fixtureId: "EML-005", acceptablePrimaryCategories: ["TRANSPORT_ORDER"], expectedNeedsHumanReview: false, notes: "baseline completo" },
  {
    fixtureId: "EML-006",
    acceptablePrimaryCategories: ["TRANSPORT_ORDER", "CUSTOMER_RECEIVABLE"],
    notes: "email con più intenzioni: ambiguità nota fra le due categorie coinvolte",
  },
  {
    fixtureId: "EML-007",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedNeedsHumanReview: false,
    expectedAmountField: { fieldKey: "amount_total", value: 1464, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "due_date", isoDate: "2026-07-28" },
    notes: "baseline completo",
  },
  {
    fixtureId: "EML-008",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedDeadlineField: { fieldKey: "due_date", isoDate: null },
    notes: "fattura senza scadenza: non deve mai essere inventata",
  },
  { fixtureId: "EML-009", acceptablePrimaryCategories: ["SUPPLIER_INVOICE"], notes: "prima fattura di una coppia duplicata" },
  {
    fixtureId: "EML-010",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedNeedsHumanReview: true,
    expectedPossibleDuplicate: true,
    notes: "fattura duplicata di EML-009: deve finire in coda possibili duplicati, mai un merge automatico",
  },
  {
    fixtureId: "EML-011",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedIsUrgent: true,
    expectedNeedsHumanReview: true,
    expectedAmountField: { fieldKey: "amount_total", value: 1080, toleranceAbsolute: 1 },
    notes: "importo discordante corpo (980) vs allegato (1080): allegato autoritativo + rule amount_mismatch",
  },
  { fixtureId: "EML-012", acceptablePrimaryCategories: ["CUSTOMER_RECEIVABLE"], notes: "baseline con promessa di pagamento" },
  {
    fixtureId: "EML-013",
    acceptablePrimaryCategories: ["CUSTOMER_RECEIVABLE"],
    expectedNeedsHumanReview: true,
    notes: "cliente dichiara di aver pagato: mai considerato incassato solo su questa base",
  },
  { fixtureId: "EML-014", acceptablePrimaryCategories: ["PAYMENT_NOTICE"], notes: "baseline avviso di pagamento" },
  {
    fixtureId: "EML-015",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedIsUrgent: true,
    expectedAmountField: { fieldKey: "reduced_amount", value: 121, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "reduced_payment_due_at", isoDate: "2026-07-17" },
    notes: "multa con termine ridotto vicino alla scadenza: deve risultare CRITICAL",
  },
  { fixtureId: "EML-016", acceptablePrimaryCategories: ["FINE_OR_PENALTY"], isPecReceipt: true, notes: "ricevuta di consegna PEC di EML-015" },
  {
    fixtureId: "EML-017",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedIsUrgent: false,
    expectedApplicability: "NOT_APPLICABLE",
    notes: "multa ordinaria non urgente (sosta vietata: non legata alla velocità)",
  },
  {
    fixtureId: "EML-018",
    acceptablePrimaryCategories: ["CLAIM_OR_DAMAGE"],
    expectedIsUrgent: true,
    expectedAmountField: { fieldKey: "requested_amount", value: 450, toleranceAbsolute: 1 },
    notes: "reclamo con foto allegata",
  },
  { fixtureId: "EML-019", acceptablePrimaryCategories: ["CLAIM_OR_DAMAGE"], notes: "reclamo senza CMR/POD" },
  {
    fixtureId: "EML-020",
    acceptablePrimaryCategories: ["TRANSPORT_DOCUMENT", "TRANSPORT_ORDER"],
    notes:
      "CMR firmato per l'ordine ORD-2026-0456: si aggancia correttamente alla pratica TRANSPORT_ORDER " +
      "esistente (EML-005) via numero ordine (SPEC.md §7 livello 4) — comportamento corretto, non un " +
      "errore di classificazione: una pratica può ricevere più email di categorie diverse.",
  },
  { fixtureId: "EML-021", acceptablePrimaryCategories: ["CUSTOMER_COMMUNICATION"], notes: "baseline comunicazione cliente" },
  { fixtureId: "EML-022", acceptablePrimaryCategories: ["ADMINISTRATIVE"], notes: "baseline amministrativo" },
  { fixtureId: "EML-023", acceptablePrimaryCategories: ["OTHER"], notes: "non pertinente" },
  {
    fixtureId: "EML-024",
    acceptablePrimaryCategories: ["UNCERTAIN", "OTHER", "CUSTOMER_COMMUNICATION"],
    expectedNeedsHumanReview: true,
    notes: "email ambigua",
  },
  {
    fixtureId: "EML-025",
    acceptablePrimaryCategories: ["CLAIM_OR_DAMAGE"],
    expectedNeedsHumanReview: true,
    notes: "allegato illeggibile: mai inventare dati da questo allegato",
  },
  {
    fixtureId: "EML-026",
    acceptablePrimaryCategories: ["ADMINISTRATIVE", "UNCERTAIN"],
    expectedNeedsHumanReview: true,
    expectedSecurityFlagsNonEmpty: true,
    notes: "prompt injection: il contenuto va trattato come dato inerte, mai come comando",
  },
  {
    fixtureId: "EML-027",
    acceptablePrimaryCategories: ["QUOTE_REQUEST"],
    notes:
      "preventivo ricco (ADR, temp. controllata, assicurazione): il fixture Fase 1 lo marca HIGH per valore/complessità, " +
      "ma nessuna regola §8 lo richiede (la scadenza risposta è oltre la finestra same-day) — non testiamo urgenza qui.",
  },
  { fixtureId: "EML-028", acceptablePrimaryCategories: ["ADMINISTRATIVE"], expectedNeedsHumanReview: true, notes: "diffida ad adempiere via PEC" },

  // --- Fase 5: fixture aggiuntive su scadenze/date e confini di categoria (docs/evaluation.md).
  // Set di tuning (EML-029..EML-039): usate liberamente durante l'iterazione con
  // scripts/anthropic-diagnose-fixture.ts, mai un run completo per calibrarle. ---
  {
    fixtureId: "EML-029",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedAmountField: { fieldKey: "amount_total", value: 1220, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "due_date", isoDate: "2026-08-17" },
    notes: "scadenza espressa con nome del mese in italiano ('17 agosto 2026')",
  },
  {
    fixtureId: "EML-030",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedAmountField: { fieldKey: "reduced_amount", value: 90, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "reduced_payment_due_at", isoDate: "2026-07-20" },
    notes: "scadenza ridotta espressa solo come 'entro 5 giorni lavorativi', nessuna data assoluta di riserva",
  },
  {
    fixtureId: "EML-031",
    acceptablePrimaryCategories: ["CLAIM_OR_DAMAGE"],
    expectedDeadlineField: { fieldKey: "response_due_at", isoDate: "2026-07-23" },
    notes: "scadenza risposta espressa come 'entro 10 giorni' (calendario, non lavorativi)",
  },
  {
    fixtureId: "EML-032",
    acceptablePrimaryCategories: ["QUOTE_REQUEST"],
    expectedDeadlineField: { fieldKey: "response_due_at", isoDate: "2026-07-14" },
    notes: "termine di risposta espresso come 'domani'",
  },
  {
    fixtureId: "EML-033",
    acceptablePrimaryCategories: ["ADMINISTRATIVE"],
    expectedNeedsHumanReview: true,
    notes: "diffida generica sul rapporto contrattuale, nessun riferimento a spedizione/merce — coppia di contrasto con EML-034",
  },
  {
    fixtureId: "EML-034",
    acceptablePrimaryCategories: ["CLAIM_OR_DAMAGE"],
    expectedNeedsHumanReview: true,
    notes: "diffida in registro legale ma legata a una spedizione nominata con danno/ammanco — coppia di contrasto con EML-033",
  },
  {
    fixtureId: "EML-035",
    acceptablePrimaryCategories: ["CUSTOMER_RECEIVABLE"],
    expectedDeadlineField: { fieldKey: "payment_promise_date", isoDate: "2026-08-05" },
    notes: "credito verso cliente nominato con promessa di pagamento espressa con nome del mese — coppia di contrasto con EML-036",
  },
  {
    fixtureId: "EML-036",
    acceptablePrimaryCategories: ["PAYMENT_NOTICE"],
    notes: "avviso di pagamento generico automatico senza cliente/fattura specifici — coppia di contrasto con EML-035",
  },
  {
    fixtureId: "EML-037",
    acceptablePrimaryCategories: ["UNCERTAIN", "OTHER", "CUSTOMER_COMMUNICATION"],
    expectedNeedsHumanReview: true,
    notes: "email genuinamente ambigua, zero contesto di business — coppia di contrasto con EML-038",
  },
  {
    fixtureId: "EML-038",
    acceptablePrimaryCategories: ["CUSTOMER_COMMUNICATION"],
    notes: "comunicazione di relazione non transazionale — coppia di contrasto con EML-037",
  },
  {
    fixtureId: "EML-039",
    acceptablePrimaryCategories: ["OTHER"],
    notes: "contenuto chiaramente non pertinente (invito a webinar) — completa il terzetto con EML-037/038",
  },

  // --- Held-out (EML-040..EML-044): mai ispezionate durante il tuning, solo per la misura finale. ---
  {
    fixtureId: "EML-040",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedAmountField: { fieldKey: "amount_total", value: 1098, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "due_date", isoDate: "2026-08-17" },
    heldOut: true,
    notes: "held-out: scadenza con formato a trattino ('17-08-2026'), mai vista durante il tuning",
  },
  {
    fixtureId: "EML-041",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedDeadlineField: { fieldKey: "appeal_due_at", isoDate: "2026-09-13" },
    heldOut: true,
    notes: "held-out: finestra relativa più lunga ('entro 60 giorni'), mai vista durante il tuning",
  },
  {
    fixtureId: "EML-042",
    acceptablePrimaryCategories: ["ADMINISTRATIVE"],
    expectedNeedsHumanReview: true,
    heldOut: true,
    notes: "held-out: caso limite ADMINISTRATIVE/CLAIM_OR_DAMAGE più sfumato di EML-033/034 (menziona una spedizione di sfuggita)",
  },
  {
    fixtureId: "EML-043",
    acceptablePrimaryCategories: ["CUSTOMER_RECEIVABLE"],
    heldOut: true,
    notes: "held-out: caso limite CUSTOMER_RECEIVABLE/PAYMENT_NOTICE, cliente nominato ma stile da avviso di sistema",
  },
  {
    fixtureId: "EML-044",
    acceptablePrimaryCategories: ["UNCERTAIN", "OTHER", "CUSTOMER_COMMUNICATION"],
    expectedNeedsHumanReview: true,
    heldOut: true,
    notes: "held-out: caso limite di segnale debole, strutturalmente diverso dal terzetto di tuning EML-037/038/039",
  },

  // --- Scenari modulo autovelox (EML-045..EML-050, FASE E Tappa 7 / FASE 10b): coprono i rami
  // principali di analyzeEnforcementDeviceHeuristically. Guardia di regressione sui rami già
  // esercitati dalle fixture (expectedApplicability), non una misura di generalizzazione. ---
  {
    fixtureId: "EML-045",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedApplicability: "SPEED_CAMERA_FIXED",
    notes: "autovelox fisso con dati tecnici completi (produttore, matricola, decreto)",
  },
  {
    fixtureId: "EML-046",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedApplicability: "SPEED_CAMERA_MOBILE",
    notes: "autovelox mobile senza dati tecnici nel testo",
  },
  {
    fixtureId: "EML-047",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedApplicability: "AVERAGE_SPEED_CONTROL",
    notes: "controllo velocità media (Tutor) senza dati tecnici",
  },
  {
    fixtureId: "EML-048",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedApplicability: "TELELASER",
    notes: "telelaser",
  },
  {
    fixtureId: "EML-049",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedApplicability: "TO_BE_IDENTIFIED",
    notes: "violazione di velocità senza alcun dispositivo nominato: mai NOT_APPLICABLE per un dispositivo non identificabile (CLAUDE.md invariante 9)",
  },
  {
    fixtureId: "EML-050",
    acceptablePrimaryCategories: ["FINE_OR_PENALTY"],
    expectedApplicability: "SPEED_CAMERA_FIXED",
    notes: "scenario integrato completo (dispositivo identificato + notification_date + punti)",
  },

  // --- Fixture multilingua (EML-051..053, FASE 10b): normalizzatore date/importi deterministico
  // su fatture fornitore in tedesco, francese e inglese — vedi prisma/seed-data/emails.ts per il
  // dettaglio di cosa ciascuna verifica. ---
  {
    fixtureId: "EML-051",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedAmountField: { fieldKey: "amount_total", value: 2450, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "due_date", isoDate: "2026-07-26" },
    notes: "fattura tedesca: data con punto come separatore (12.07.2026), importo già nel formato punto migliaia/virgola decimale",
  },
  {
    fixtureId: "EML-052",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedAmountField: { fieldKey: "amount_total", value: 1500, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "due_date", isoDate: "2026-07-26" },
    notes: "fattura francese: importo con spazio come separatore delle migliaia (1 500,00)",
  },
  {
    fixtureId: "EML-053",
    acceptablePrimaryCategories: ["SUPPLIER_INVOICE"],
    expectedAmountField: { fieldKey: "amount_total", value: 1500, toleranceAbsolute: 1 },
    expectedDeadlineField: { fieldKey: "due_date", isoDate: "2026-07-29" },
    notes: "fattura inglese per completezza: date e importo scelti apposta per essere non ambigui (giorno > 12, nessun separatore delle migliaia)",
  },
];
