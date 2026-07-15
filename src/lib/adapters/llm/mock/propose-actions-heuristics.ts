import type { CaseCategory, Department } from "@/generated/prisma/enums";
import type { ActionProposalInput } from "@/lib/adapters/llm/types";
import type { ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";

interface CategoryPlan {
  department: Department | null;
  tasks: { title: string; description: string | null }[];
  draftRecommended: boolean;
  draftReason: string | null;
}

const CATEGORY_PLANS: Record<CaseCategory, CategoryPlan> = {
  QUOTE_REQUEST: {
    department: "COMMERCIAL",
    tasks: [{ title: "Preparare preventivo", description: "Calcolare tariffa in base ai dati estratti." }],
    draftRecommended: true,
    draftReason: "Il cliente attende una risposta con il preventivo o una richiesta di dati mancanti.",
  },
  TRANSPORT_ORDER: {
    department: "OPERATIONS",
    tasks: [{ title: "Pianificare il trasporto", description: "Assegnare mezzo e autista." }],
    draftRecommended: false,
    draftReason: null,
  },
  SUPPLIER_INVOICE: {
    department: "ACCOUNTING",
    tasks: [{ title: "Verificare e registrare la fattura", description: null }],
    draftRecommended: false,
    draftReason: null,
  },
  CUSTOMER_RECEIVABLE: {
    department: "ACCOUNTING",
    tasks: [{ title: "Verificare lo stato del pagamento nel gestionale", description: null }],
    draftRecommended: true,
    draftReason: "Potrebbe essere necessario rispondere al cliente sullo stato del credito.",
  },
  PAYMENT_NOTICE: {
    department: "ACCOUNTING",
    tasks: [{ title: "Registrare la scadenza", description: null }],
    draftRecommended: false,
    draftReason: null,
  },
  FINE_OR_PENALTY: {
    department: "ACCOUNTING",
    tasks: [
      { title: "Individuare il conducente responsabile", description: null },
      { title: "Valutare il pagamento in misura ridotta entro il termine", description: null },
    ],
    draftRecommended: false,
    draftReason: null,
  },
  CLAIM_OR_DAMAGE: {
    department: "OPERATIONS",
    tasks: [{ title: "Aprire istruttoria reclamo", description: "Verificare documentazione e responsabilità." }],
    draftRecommended: true,
    draftReason: "Il cliente attende un riscontro sul reclamo.",
  },
  TRANSPORT_DOCUMENT: {
    department: "OPERATIONS",
    tasks: [{ title: "Archiviare il documento nella pratica", description: null }],
    draftRecommended: false,
    draftReason: null,
  },
  CUSTOMER_COMMUNICATION: {
    department: "COMMERCIAL",
    tasks: [{ title: "Aggiornare anagrafica cliente", description: null }],
    draftRecommended: false,
    draftReason: null,
  },
  ADMINISTRATIVE: {
    department: "MANAGEMENT",
    tasks: [{ title: "Valutare l'adempimento richiesto", description: null }],
    draftRecommended: false,
    draftReason: null,
  },
  OTHER: { department: null, tasks: [], draftRecommended: false, draftReason: null },
  UNCERTAIN: {
    department: null,
    tasks: [{ title: "Verificare manualmente il contenuto dell'email", description: null }],
    draftRecommended: false,
    draftReason: null,
  },
};

export function proposeActionsHeuristically(input: ActionProposalInput): ProposeActionsResult {
  const plan = CATEGORY_PLANS[input.category];
  const needsHumanReview = input.classification.needs_human_review;

  return {
    suggested_actions: plan.tasks.map((t) => t.title),
    proposed_tasks: plan.tasks.map((t) => ({
      title: t.title,
      description: t.description,
      suggested_department: plan.department,
      suggested_due_at: null,
    })),
    responsible_department: plan.department,
    draft_reply_recommended: plan.draftRecommended,
    draft_reply_reason: plan.draftReason,
    confidence: input.classification.confidence,
    needs_human_review: needsHumanReview,
  };
}
