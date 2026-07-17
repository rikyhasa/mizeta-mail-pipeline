import type {
  AppealDecisionKind,
  AppealDocumentaryStrength,
  AppealEconomicConvenience,
  AppealIndication,
  AuditAction,
  CaseCategory,
  CasePriority,
  CaseRelationKind,
  CaseRelationStatus,
  CaseStatus,
  DeadlineKind,
  Department,
  EmailDraftStatus,
  EnforcementCheckApplicability,
  EnforcementDocumentStatus,
  EnforcementDocumentType,
  EnforcementRegistryMatchState,
  EnforcementVerificationState,
  FieldSourceType,
  GeneratedDocumentType,
  Role,
  TaskStatus,
} from "@/generated/prisma/enums";

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  QUOTE_REQUEST: "Richiesta preventivo",
  TRANSPORT_ORDER: "Ordine di trasporto",
  SUPPLIER_INVOICE: "Fattura fornitore",
  CUSTOMER_RECEIVABLE: "Credito cliente",
  PAYMENT_NOTICE: "Avviso di pagamento",
  FINE_OR_PENALTY: "Multa",
  CLAIM_OR_DAMAGE: "Reclamo o danno",
  TRANSPORT_DOCUMENT: "Documento di trasporto",
  CUSTOMER_COMMUNICATION: "Comunicazione cliente",
  ADMINISTRATIVE: "Amministrativo",
  OTHER: "Altro",
  UNCERTAIN: "Da classificare",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "Nuova",
  NEEDS_REVIEW: "Da verificare",
  ASSIGNED: "Assegnata",
  IN_PROGRESS: "In lavorazione",
  WAITING_CUSTOMER: "In attesa del cliente",
  WAITING_INTERNAL: "In attesa interna",
  COMPLETED: "Completata",
  ARCHIVED: "Archiviata",
};

export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = {
  CRITICAL: "Critica",
  HIGH: "Alta",
  NORMAL: "Normale",
  LOW: "Bassa",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Amministratore",
  OPERATIONS: "Operativo",
  ACCOUNTING: "Contabilità",
  COMMERCIAL: "Commerciale",
  READ_ONLY: "Sola lettura",
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  OPERATIONS: "Operativo",
  ACCOUNTING: "Contabilità",
  COMMERCIAL: "Commerciale",
  MANAGEMENT: "Direzione",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Da fare",
  IN_PROGRESS: "In corso",
  DONE: "Completata",
  CANCELLED: "Annullata",
};

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  RESPONSE_DUE: "Termine per rispondere",
  PAYMENT_DUE: "Scadenza pagamento",
  PAYMENT_REDUCED_DUE: "Scadenza pagamento ridotto",
  APPEAL_DUE: "Termine per il ricorso",
  APPEAL_DUE_GDP: "Termine ricorso Giudice di Pace",
  APPEAL_DUE_PREFETTO: "Termine ricorso Prefetto",
  PICKUP_DUE: "Data ritiro",
  DELIVERY_DUE: "Data consegna",
  OTHER: "Scadenza",
};

export const FIELD_SOURCE_TYPE_LABELS: Record<FieldSourceType, string> = {
  EMAIL_BODY: "Corpo email",
  EMAIL_SUBJECT: "Oggetto email",
  ATTACHMENT: "Allegato",
  MANUAL: "Inserito manualmente",
  SYSTEM: "Calcolato dal sistema",
};

export const CASE_RELATION_KIND_LABELS: Record<CaseRelationKind, string> = {
  DUPLICATE_CANDIDATE: "Possibile duplicato",
  RELATED: "Pratica collegata",
};

export const CASE_RELATION_STATUS_LABELS: Record<CaseRelationStatus, string> = {
  PENDING: "Da verificare",
  CONFIRMED: "Confermata",
  REJECTED: "Rifiutata",
};

export const EMAIL_DRAFT_STATUS_LABELS: Record<EmailDraftStatus, string> = {
  PENDING_APPROVAL: "In attesa di approvazione",
  APPROVED: "Approvata",
  DISCARDED: "Scartata",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_LOGIN: "Accesso utente",
  USER_LOGOUT: "Disconnessione utente",
  CASE_VIEWED: "Accesso alla pratica",
  FIELD_UPDATED: "Campo corretto",
  FIELD_CONFIRMED: "Campo confermato",
  STATUS_CHANGED: "Stato modificato",
  ASSIGNEE_CHANGED: "Responsabile modificato",
  DRAFT_GENERATED: "Bozza generata",
  DOCUMENT_GENERATED: "Documento generato",
  CASE_LINKED: "Pratica collegata",
  CASE_SPLIT: "Collegamento rifiutato/separato",
  EMAIL_SYNCED: "Sincronizzazione email",
  CLASSIFICATION_ERROR: "Errore di classificazione",
  ADMIN_ACTION: "Intervento amministrativo",
  CASE_CREATED: "Pratica creata",
  EXTRACTION_ERROR: "Errore di estrazione",
  POSSIBLE_DUPLICATE_FLAGGED: "Possibile duplicato segnalato",
  SECURITY_FLAG_DETECTED: "Segnale di sicurezza rilevato",
  RULE_SETTINGS_UPDATED: "Impostazioni regole aggiornate",
  DRAFT_APPROVED: "Bozza approvata",
  DRAFT_DISCARDED: "Bozza scartata",
  JOB_DEAD_LETTERED: "Job scartato (dead-letter)",
  ENFORCEMENT_DEVICE_CONFIRMED: "Dato dispositivo confermato",
  ENFORCEMENT_DOCUMENT_LINKED: "Documento tecnico collegato",
  ENFORCEMENT_LEGAL_ESCALATED: "Segnalato per verifica legale",
  SPEED_REGISTRY_SYNCED: "Registro MIT sincronizzato",
  SPEED_REGISTRY_MANUAL_UPLOAD: "Registro MIT caricato manualmente",
  APPEAL_DECISION_RECORDED: "Decisione ricorso registrata",
  ENFORCEMENT_DOCUMENTATION_REQUESTED: "Documentazione tecnica richiesta",
  ENFORCEMENT_TECHNICAL_REVIEW_REQUESTED: "Segnalato per verifica tecnica",
};

/** Gli 8 modelli di SPEC.md §12 — mancava una traduzione: DocumentsCard mostrava il valore
 * enum grezzo (es. "QUOTE_SHEET") invece dell'etichetta italiana (FASE 3, tappa 4). */
export const GENERATED_DOCUMENT_TYPE_LABELS: Record<GeneratedDocumentType, string> = {
  QUOTE_SHEET: "Scheda preventivo",
  TRANSPORT_ORDER_SHEET: "Scheda ordine di trasporto",
  CLAIM_DOSSIER: "Dossier reclamo/sinistro",
  FINE_SHEET: "Scheda multa",
  DEADLINES_REPORT: "Report scadenze amministrative",
  DAILY_BRIEFING: "Briefing operativo giornaliero",
  OVERDUE_RECEIVABLES_REPORT: "Report crediti scaduti",
  SUPPLIER_INVOICES_REPORT: "Report fatture fornitori",
};

/** Indicatore ricorso (docs/SPEC.md §10bis) — linguaggio prudente vincolato, mai una
 * probabilità di accoglimento (CLAUDE.md invariante 9). */
export const APPEAL_DOCUMENTARY_STRENGTH_LABELS: Record<AppealDocumentaryStrength, string> = {
  NONE: "Assenti",
  WEAK: "Deboli",
  RELEVANT: "Rilevanti",
  STRONG: "Forti",
};

export const APPEAL_ECONOMIC_CONVENIENCE_LABELS: Record<AppealEconomicConvenience, string> = {
  UNFAVORABLE: "Sfavorevole",
  LIMITED: "Limitata",
  FAVORABLE: "Favorevole",
};

export const APPEAL_INDICATION_LABELS: Record<AppealIndication, string> = {
  CONSIDER_GDP_APPEAL: "Valutare ricorso al Giudice di Pace",
  CONSIDER_PREFETTO_APPEAL: "Considerare ricorso al Prefetto",
  RELEVANT_BUT_UNECONOMICAL: "Elementi presenti ma antieconomico",
  NO_RELEVANT_ELEMENT: "Nessun elemento rilevante",
  DEADLINES_EXPIRED: "Termini scaduti",
  INSUFFICIENT_DATA: "Dati insufficienti",
};

export const APPEAL_DECISION_LABELS: Record<AppealDecisionKind, string> = {
  NOT_DECIDED: "Da decidere",
  GDP_FILED: "Ricorso Giudice di Pace avviato",
  PREFETTO_FILED: "Ricorso Prefetto avviato",
  NO_APPEAL: "Nessun ricorso",
};

/** Modulo verifica autovelox (docs/SPEC.md §10bis, §4 di docs/SPEC-AUTOVELOX-DRAFT.md). */
export const ENFORCEMENT_CHECK_APPLICABILITY_LABELS: Record<EnforcementCheckApplicability, string> = {
  NOT_APPLICABLE: "Non applicabile",
  TO_BE_IDENTIFIED: "Da identificare",
  SPEED_CAMERA_FIXED: "Autovelox fisso",
  SPEED_CAMERA_MOBILE: "Autovelox mobile",
  AVERAGE_SPEED_CONTROL: "Tutor / velocità media",
  TELELASER: "Telelaser",
  OTHER_SPEED_DEVICE: "Altro dispositivo di rilevamento velocità",
};

/** Stati del pannello di verifica (docs/SPEC-AUTOVELOX-DRAFT.md §8): solo stati documentali,
 * mai un giudizio di validità della sanzione (CLAUDE.md invariante 9). */
export const ENFORCEMENT_VERIFICATION_STATE_LABELS: Record<EnforcementVerificationState, string> = {
  NOT_APPLICABLE: "Non applicabile",
  TO_BE_IDENTIFIED: "Da identificare",
  IDENTIFIED: "Identificato",
  DOCUMENTATION_TO_ACQUIRE: "Documentazione da acquisire",
  DOCUMENTATION_INCOMPLETE: "Documentazione incompleta",
  DATA_CONFLICT: "Dati in conflitto",
  TO_BE_VERIFIED: "Da verificare",
  DOCUMENTED_VERIFICATION_COMPLETE: "Verifica documentale completata",
  REQUIRES_LEGAL_REVIEW: "In verifica legale",
};

export const ENFORCEMENT_DOCUMENT_TYPE_LABELS: Record<EnforcementDocumentType, string> = {
  APPROVAL_OR_HOMOLOGATION_DECREE: "Decreto di approvazione/omologazione",
  CALIBRATION_CERTIFICATE: "Certificato di taratura",
  FUNCTIONALITY_CERTIFICATE: "Certificato di funzionalità",
  TECHNICAL_MANUAL: "Manuale tecnico",
  OTHER: "Altro documento",
};

export const ENFORCEMENT_DOCUMENT_STATUS_LABELS: Record<EnforcementDocumentStatus, string> = {
  PRESENT: "Presente",
  MISSING: "Mancante",
  REQUESTED: "Richiesto",
};

/** Solo confronto documentale con il registro MIT (docs/SPEC-AUTOVELOX-DRAFT.md §10): un
 * MISMATCH significa "il dato dichiarato non corrisponde al registro consultato in data X", mai
 * "la multa è invalida" — nessuna etichetta esprime una conclusione di validità. */
export const ENFORCEMENT_REGISTRY_MATCH_LABELS: Record<EnforcementRegistryMatchState, string> = {
  MATCH: "Corrisponde al registro",
  MISMATCH: "Non corrisponde al registro",
  NOT_FOUND: "Non trovato nel registro",
  NOT_CONSULTED: "Registro non consultato",
};
