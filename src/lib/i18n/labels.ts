import type {
  AuditAction,
  CaseCategory,
  CasePriority,
  CaseRelationKind,
  CaseRelationStatus,
  CaseStatus,
  DeadlineKind,
  Department,
  EmailDraftStatus,
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
