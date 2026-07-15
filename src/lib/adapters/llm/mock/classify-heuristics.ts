import type { CaseCategory, CasePriority, Department } from "@/generated/prisma/enums";
import type { ClassificationResult } from "@/lib/adapters/llm/schemas";
import type { ClassificationInput } from "@/lib/adapters/llm/types";
import { detectSecurityFlags } from "./security-flags";
import { findDatesIt, findInvoiceNumber, findOrderNumber, findFineNoticeNumber } from "@/lib/text/patterns";

interface CategoryKeywords {
  it: string[];
  en: string[];
}

const CATEGORY_KEYWORDS: Record<CaseCategory, CategoryKeywords> = {
  QUOTE_REQUEST: {
    it: ["preventivo", "quotazione", "richiediamo un preventivo", "potreste farmi un preventivo", "vorremmo un preventivo"],
    en: ["quote for", "quote request", "request a quote", "please advise rate"],
  },
  TRANSPORT_ORDER: {
    it: ["ordine di trasporto", "confermiamo l'ordine", "vi affidiamo il trasporto", "numero ordine", "vi confermiamo l'ordine"],
    en: ["purchase order", "please arrange transport", "please go ahead and book", "confirmed pickup", "order reference"],
  },
  SUPPLIER_INVOICE: {
    it: ["si allega fattura", "in allegato la fattura", "invio fattura", "invio la fattura", "trasmettiamo fattura", "imponibile"],
    en: ["please find attached invoice", "attached invoice"],
  },
  CUSTOMER_RECEIVABLE: {
    it: ["sollecito", "risulta ancora aperta", "risulta ancora da saldare", "risulta già pagata", "risulta ancora insoluta", "promessa di pagamento", "pagheremo entro"],
    en: ["payment reminder", "overdue invoice"],
  },
  PAYMENT_NOTICE: {
    it: ["avviso di scadenza", "canone", "bolletta", "le ricordiamo che scade"],
    en: ["payment notice", "due date reminder"],
  },
  FINE_OR_PENALTY: {
    it: ["verbale di accertamento", "verbale n", "violazione", "codice della strada", "c.d.s.", "importo ridotto", "polizia locale", "contravvenzion"],
    en: ["traffic violation", "penalty notice"],
  },
  CLAIM_OR_DAMAGE: {
    it: ["reclamo", "merce danneggiata", "merce mancante", "richiesta di risarcimento", "risarciment", "danneggiat"],
    en: ["claim", "damaged goods", "compensation"],
  },
  TRANSPORT_DOCUMENT: {
    it: ["cmr firmato", "lettera di vettura", "documento di trasporto", "pod firmato", "cmr -"],
    en: ["bill of lading", "waybill"],
  },
  CUSTOMER_COMMUNICATION: {
    it: ["cambio referente", "nuovo referente", "restiamo a disposizione per ogni chiarimento"],
    en: [],
  },
  ADMINISTRATIVE: {
    it: ["aggiornamento procedure", "rinnovo iscrizione", "albo", "diffida ad adempiere", "trasmissione diffida", "comunicazione interna"],
    en: [],
  },
  OTHER: {
    it: ["fiera della logistica", "invito", "ingresso gratuito"],
    en: [],
  },
  UNCERTAIN: { it: [], en: [] },
};

const CASE_CATEGORY_VALUES = Object.keys(CATEGORY_KEYWORDS) as CaseCategory[];

interface CategoryScore {
  category: CaseCategory;
  score: number;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

export function scoreCategories(subject: string, body: string): CategoryScore[] {
  const subjectLower = subject.toLowerCase();
  const bodyLower = body.toLowerCase();

  const scores: CategoryScore[] = CASE_CATEGORY_VALUES.filter((c) => c !== "UNCERTAIN").map((category) => {
    const keywords = [...CATEGORY_KEYWORDS[category].it, ...CATEGORY_KEYWORDS[category].en];
    let score = 0;
    for (const keyword of keywords) {
      score += countOccurrences(subjectLower, keyword) * 2;
      score += countOccurrences(bodyLower, keyword);
    }
    return { category, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

const PRIORITY_DEPARTMENT: Record<CaseCategory, Department | null> = {
  QUOTE_REQUEST: "COMMERCIAL",
  TRANSPORT_ORDER: "OPERATIONS",
  SUPPLIER_INVOICE: "ACCOUNTING",
  CUSTOMER_RECEIVABLE: "ACCOUNTING",
  PAYMENT_NOTICE: "ACCOUNTING",
  FINE_OR_PENALTY: "ACCOUNTING",
  CLAIM_OR_DAMAGE: "OPERATIONS",
  TRANSPORT_DOCUMENT: "OPERATIONS",
  CUSTOMER_COMMUNICATION: "COMMERCIAL",
  ADMINISTRATIVE: "MANAGEMENT",
  OTHER: null,
  UNCERTAIN: null,
};

const SUGGESTED_ACTIONS_BY_CATEGORY: Record<CaseCategory, string[]> = {
  QUOTE_REQUEST: ["Preparare preventivo"],
  TRANSPORT_ORDER: ["Pianificare il trasporto", "Confermare mezzo e autista"],
  SUPPLIER_INVOICE: ["Verificare e registrare la fattura"],
  CUSTOMER_RECEIVABLE: ["Verificare lo stato del pagamento"],
  PAYMENT_NOTICE: ["Registrare la scadenza"],
  FINE_OR_PENALTY: ["Verificare il conducente responsabile", "Valutare pagamento in misura ridotta"],
  CLAIM_OR_DAMAGE: ["Aprire istruttoria reclamo"],
  TRANSPORT_DOCUMENT: ["Archiviare il documento"],
  CUSTOMER_COMMUNICATION: ["Aggiornare anagrafica cliente"],
  ADMINISTRATIVE: ["Valutare l'adempimento richiesto"],
  OTHER: [],
  UNCERTAIN: ["Verificare manualmente il contenuto"],
};

function extractDeadline(text: string): string | null {
  const lower = text.toLowerCase();
  const anchorIndex = Math.max(
    lower.indexOf("entro il"),
    lower.indexOf("scadenza"),
    lower.indexOf("termine per"),
    lower.indexOf("entro la"),
  );
  if (anchorIndex === -1) return null;

  const window = text.slice(anchorIndex, anchorIndex + 60);
  const dates = findDatesIt(window);
  if (dates.length === 0) return null;
  return dates[0].value.toISOString();
}

function guessCustomerOrSupplier(body: string): string | null {
  const signOffPattern = /(?:cordiali saluti|distinti saluti|grazie)[,.]?\s*\n\s*([A-Z][a-zà-ù]+(?:\s+[A-Z][a-zà-ù]+){0,2})/i;
  const match = signOffPattern.exec(body);
  return match ? match[1].trim() : null;
}

function estimateBaselinePriority(category: CaseCategory, subject: string, body: string): { priority: CasePriority; reasons: string[] } {
  const lower = `${subject}\n${body}`.toLowerCase();
  const reasons: string[] = [];

  if (category === "FINE_OR_PENALTY" && lower.includes("termine per il pagamento in misura ridotta")) {
    // "Importo ridotto" da solo è testo standard di quasi ogni verbale italiano (non è un
    // segnale di urgenza): solo la presenza di un termine ESPLICITO in misura ridotta lo è.
    reasons.push("Multa con termine di pagamento in misura ridotta esplicito");
    return { priority: "HIGH", reasons };
  }
  if (category === "CLAIM_OR_DAMAGE") {
    reasons.push("Reclamo cliente");
    return { priority: "HIGH", reasons };
  }
  if (category === "QUOTE_REQUEST" && (lower.includes("entro oggi") || lower.includes("in giornata"))) {
    reasons.push("Risposta richiesta in giornata");
    return { priority: "HIGH", reasons };
  }
  if (category === "CUSTOMER_RECEIVABLE" && lower.includes("già pagata")) {
    reasons.push("Cliente dichiara pagamento da verificare");
    return { priority: "HIGH", reasons };
  }
  return { priority: "NORMAL", reasons: [] };
}

/**
 * Motore euristico di classificazione (keyword scoring IT/EN + rilevamento prompt-injection).
 * `threshold` è la soglia minima di confidence sotto la quale la categoria diventa UNCERTAIN
 * e la pratica va in revisione umana (SPEC.md §6).
 */
export function classifyHeuristically(input: ClassificationInput, threshold: number): ClassificationResult {
  const combinedText = `${input.emailSubject}\n${input.emailBody}`;
  const securityFlags = detectSecurityFlags(combinedText);

  const scores = scoreCategories(input.emailSubject, input.emailBody);
  const top = scores[0];
  const second = scores[1];

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0) || 1;
  const confidence = Math.min(0.95, top.score > 0 ? 0.5 + (top.score / totalScore) * 0.45 : 0.2);

  const belowThreshold = top.score === 0 || confidence < threshold;
  const primaryCategory: CaseCategory = belowThreshold ? "UNCERTAIN" : top.category;

  const secondaryCategories: CaseCategory[] = [];
  if (!belowThreshold && second && second.score > 0 && second.score >= 0.6 * top.score) {
    secondaryCategories.push(second.category);
  }

  const { priority, reasons: priorityReasons } = belowThreshold
    ? { priority: "LOW" as CasePriority, reasons: [] as string[] }
    : estimateBaselinePriority(primaryCategory, input.emailSubject, input.emailBody);

  const identifiers = [
    findInvoiceNumber(combinedText),
    findOrderNumber(combinedText),
    findFineNoticeNumber(combinedText),
  ].filter((v): v is string => Boolean(v));

  const needsHumanReview = belowThreshold || securityFlags.length > 0;

  return {
    primary_category: primaryCategory,
    secondary_categories: secondaryCategories,
    short_title: input.emailSubject.slice(0, 120) || "(nessun oggetto)",
    summary: input.emailBody.trim().slice(0, 240) || "(nessun contenuto)",
    action_required: primaryCategory !== "OTHER",
    suggested_actions: SUGGESTED_ACTIONS_BY_CATEGORY[primaryCategory],
    priority,
    priority_reasons: priorityReasons,
    deadline: extractDeadline(combinedText),
    responsible_department: PRIORITY_DEPARTMENT[primaryCategory],
    customer_or_supplier: guessCustomerOrSupplier(input.emailBody),
    related_business_identifiers: identifiers,
    confidence: belowThreshold ? Math.min(confidence, threshold - 0.01 >= 0 ? threshold - 0.01 : 0) : confidence,
    needs_human_review: needsHumanReview,
    security_flags: securityFlags,
  };
}
