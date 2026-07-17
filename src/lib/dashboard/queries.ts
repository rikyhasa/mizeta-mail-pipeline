import { prisma } from "@/lib/db/prisma";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { AMOUNT_FIELD_BY_CATEGORY, parseFieldNumber } from "./field-keys";
import { PAGE_SIZE } from "./constants";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { Prisma } from "@/generated/prisma/client";
import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";

export const OPEN_STATUSES: CaseStatus[] = ["NEW", "NEEDS_REVIEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_INTERNAL"];
const URGENT_PRIORITIES: CasePriority[] = ["CRITICAL", "HIGH"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function caseAmountTotal(category: CaseCategory, where: Prisma.CaseWhereInput): Promise<{ count: number; total: number }> {
  const amountFieldKey = AMOUNT_FIELD_BY_CATEGORY[category] ?? "__none__";
  const cases = await prisma.case.findMany({
    where: { ...where, category },
    select: { id: true, fields: { where: { fieldKey: amountFieldKey }, select: { value: true } } },
  });
  const total = cases.reduce((sum, c) => sum + (parseFieldNumber(c.fields[0]?.value ?? null) ?? 0), 0);
  return { count: cases.length, total };
}

export interface DashboardAlert {
  key: string;
  label: string;
  count: number;
}

export async function getAlerts(now: Date = new Date()): Promise<DashboardAlert[]> {
  const openWhere: Prisma.CaseWhereInput = { status: { in: OPEN_STATUSES } };
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);
  const in7d = addDays(now, 7);

  const [overdue, dueToday, dueSoon, criticalOpen, quotesToRespond, urgentClaims, urgentFines, needsVerification] = await Promise.all([
    prisma.case.count({ where: { ...openWhere, deadlines: { some: { resolvedAt: null, dueAt: { lt: now } } } } }),
    prisma.case.count({ where: { ...openWhere, deadlines: { some: { resolvedAt: null, dueAt: { gte: today0, lte: today1 } } } } }),
    prisma.case.count({ where: { ...openWhere, deadlines: { some: { resolvedAt: null, dueAt: { gt: today1, lte: in7d } } } } }),
    prisma.case.count({ where: { ...openWhere, priority: "CRITICAL" } }),
    prisma.case.count({ where: { ...openWhere, category: "QUOTE_REQUEST" } }),
    prisma.case.count({ where: { ...openWhere, category: "CLAIM_OR_DAMAGE", priority: { in: URGENT_PRIORITIES } } }),
    prisma.case.count({ where: { ...openWhere, category: "FINE_OR_PENALTY", priority: { in: URGENT_PRIORITIES } } }),
    prisma.case.count({ where: { needsHumanReview: true } }),
  ]);

  // "Da gestire oggi": scadenze di oggi o priorità CRITICAL già aperta (senza doppio conteggio esatto — un conteggio indicativo, non un id-set deduplicato: coerente con l'uso come card di scorciatoia verso i filtri).
  const daGestireOggi = Math.max(dueToday, criticalOpen);

  return [
    { key: "oggi", label: "Da gestire oggi", count: daGestireOggi },
    { key: "overdue", label: "Scaduti", count: overdue },
    { key: "dueSoon", label: "Scadenze prossimi 7 giorni", count: dueSoon },
    { key: "quotesToRespond", label: "Preventivi da rispondere", count: quotesToRespond },
    { key: "urgentClaims", label: "Reclami urgenti", count: urgentClaims },
    { key: "urgentFines", label: "Multe urgenti", count: urgentFines },
    { key: "needsReview", label: "Elementi da verificare", count: needsVerification },
  ];
}

export interface DashboardKpis {
  quotes: { count: number; total: number };
  supplierInvoicesDueTotal: number;
  overdueReceivablesTotal: number;
  openClaims: number;
  openFines: number;
  lowConfidenceCount: number;
}

export async function getKpis(now: Date = new Date()): Promise<DashboardKpis> {
  const settings = await getRuleSettings();
  const openWhere: Prisma.CaseWhereInput = { status: { in: OPEN_STATUSES } };

  const [quotes, supplierInvoices, receivablesOpen, openClaims, openFines, lowConfidenceCount] = await Promise.all([
    caseAmountTotal("QUOTE_REQUEST", openWhere),
    caseAmountTotal("SUPPLIER_INVOICE", openWhere),
    prisma.case.findMany({
      where: { ...openWhere, category: "CUSTOMER_RECEIVABLE" },
      select: { fields: { where: { fieldKey: { in: ["amount", "due_date"] } }, select: { fieldKey: true, value: true } } },
    }),
    prisma.case.count({ where: { ...openWhere, category: "CLAIM_OR_DAMAGE" } }),
    prisma.case.count({ where: { ...openWhere, category: "FINE_OR_PENALTY" } }),
    prisma.case.count({ where: { OR: [{ needsHumanReview: true }, { confidence: { lt: settings.classificationConfidenceThreshold } }] } }),
  ]);

  const overdueReceivablesTotal = receivablesOpen.reduce((sum, c) => {
    const dueDateRaw = c.fields.find((f) => f.fieldKey === "due_date")?.value ?? null;
    const amount = parseFieldNumber(c.fields.find((f) => f.fieldKey === "amount")?.value ?? null);
    if (!dueDateRaw || amount === null) return sum;
    const dueDate = new Date(dueDateRaw);
    if (Number.isNaN(dueDate.getTime()) || dueDate >= now) return sum;
    return sum + amount;
  }, 0);

  return {
    quotes,
    supplierInvoicesDueTotal: supplierInvoices.total,
    overdueReceivablesTotal,
    openClaims,
    openFines,
    lowConfidenceCount,
  };
}

export type DashboardQuickFilter = "overdue" | "dueToday" | "dueSoon" | "quotesToRespond" | "urgentClaims" | "urgentFines" | "needsReview";

export interface DashboardFilters {
  q?: string;
  category?: CaseCategory;
  status?: CaseStatus;
  priority?: CasePriority;
  responsibleId?: string;
  customerId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  lowConfidence?: boolean;
  hasAttachments?: boolean;
  overdue?: boolean;
  quick?: DashboardQuickFilter;
  page?: number;
}

export interface CaseListItem {
  id: string;
  reference: string;
  category: CaseCategory;
  title: string;
  customerOrSupplierName: string | null;
  amount: number | null;
  nextDeadline: Date | null;
  priority: CasePriority;
  status: CaseStatus;
  responsibleName: string | null;
  updatedAt: Date;
  needsHumanReview: boolean;
  isPec: boolean;
  hasAttachments: boolean;
}

const PRIORITY_RANK: Record<CasePriority, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const CASE_LIST_INCLUDE = {
  customer: { select: { name: true } },
  supplier: { select: { name: true } },
  assignedTo: { select: { name: true } },
  deadlines: { where: { resolvedAt: null }, orderBy: { dueAt: "asc" as const }, take: 1 },
  fields: true,
  messages: { select: { hasAttachments: true }, take: 1, where: { hasAttachments: true } },
} satisfies Prisma.CaseInclude;

type CaseWithListRelations = Prisma.CaseGetPayload<{ include: typeof CASE_LIST_INCLUDE }>;

function mapCaseToListItem(c: CaseWithListRelations): CaseListItem {
  const amountFieldKey = AMOUNT_FIELD_BY_CATEGORY[c.category];
  const amount = amountFieldKey ? parseFieldNumber(c.fields.find((f) => f.fieldKey === amountFieldKey)?.value ?? null) : null;
  return {
    id: c.id,
    reference: c.reference,
    category: c.category,
    title: c.title,
    customerOrSupplierName: c.customer?.name ?? c.supplier?.name ?? null,
    amount,
    nextDeadline: c.deadlines[0]?.dueAt ?? null,
    priority: c.priority,
    status: c.status,
    responsibleName: c.assignedTo?.name ?? null,
    updatedAt: c.updatedAt,
    needsHumanReview: c.needsHumanReview,
    isPec: c.isPec,
    hasAttachments: c.messages.length > 0,
  };
}

function sortCaseListItems(items: CaseListItem[]): void {
  items.sort((a, b) => {
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const aDeadline = a.nextDeadline?.getTime() ?? Infinity;
    const bDeadline = b.nextDeadline?.getTime() ?? Infinity;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/**
 * Elenco compatto per la dashboard ("Pratiche da lavorare"): stesse proiezione
 * e ordinamento di `getFilteredCases`, senza filtri/paginazione — solo le
 * pratiche aperte, limitate a `limit` righe (Fase 8, docs/UI-PORTING-PLAN.md).
 */
export async function getDashboardWorkItems(limit = 12): Promise<CaseListItem[]> {
  const cases = await prisma.case.findMany({
    where: { status: { in: OPEN_STATUSES } },
    include: CASE_LIST_INCLUDE,
  });
  const items = cases.map(mapCaseToListItem);
  sortCaseListItems(items);
  return items.slice(0, limit);
}

function applyQuickFilter(where: Prisma.CaseWhereInput, quick: DashboardQuickFilter | undefined, now: Date): Prisma.CaseWhereInput {
  if (!quick) return where;
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);
  const in7d = addDays(now, 7);

  switch (quick) {
    case "overdue":
      return { ...where, status: { in: OPEN_STATUSES }, deadlines: { some: { resolvedAt: null, dueAt: { lt: now } } } };
    case "dueToday":
      return { ...where, status: { in: OPEN_STATUSES }, deadlines: { some: { resolvedAt: null, dueAt: { gte: today0, lte: today1 } } } };
    case "dueSoon":
      return { ...where, status: { in: OPEN_STATUSES }, deadlines: { some: { resolvedAt: null, dueAt: { gt: today1, lte: in7d } } } };
    case "quotesToRespond":
      return { ...where, status: { in: OPEN_STATUSES }, category: "QUOTE_REQUEST" };
    case "urgentClaims":
      return { ...where, status: { in: OPEN_STATUSES }, category: "CLAIM_OR_DAMAGE", priority: { in: URGENT_PRIORITIES } };
    case "urgentFines":
      return { ...where, status: { in: OPEN_STATUSES }, category: "FINE_OR_PENALTY", priority: { in: URGENT_PRIORITIES } };
    case "needsReview":
      return { ...where, needsHumanReview: true };
    default:
      return where;
  }
}

export async function getFilteredCases(filters: DashboardFilters, now: Date = new Date()): Promise<{ items: CaseListItem[]; total: number }> {
  const settings = await getRuleSettings();

  let where: Prisma.CaseWhereInput = {};
  const q = filters.q?.trim();
  if (q) {
    // "multa" -> tutte le pratiche di categoria FINE_OR_PENALTY, "reclamo" -> CLAIM_OR_DAMAGE,
    // ecc. — confronto sulle etichette italiane già esistenti (CASE_CATEGORY_LABELS), nessun
    // nuovo elenco da mantenere in sincronia.
    const matchedCategories = (Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[]).filter((c) =>
      CASE_CATEGORY_LABELS[c].toLowerCase().includes(q.toLowerCase()),
    );
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { reference: { contains: q, mode: "insensitive" } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
          { supplier: { name: { contains: q, mode: "insensitive" } } },
          ...(matchedCategories.length > 0 ? [{ category: { in: matchedCategories } }] : []),
        ],
      },
    ];
  }
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.responsibleId) where.assignedToId = filters.responsibleId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: endOfDay(new Date(filters.dateTo)) } : {}),
    };
  }
  if (filters.lowConfidence) {
    where.OR = [{ needsHumanReview: true }, { confidence: { lt: settings.classificationConfidenceThreshold } }];
  }
  if (filters.hasAttachments) where.messages = { some: { hasAttachments: true } };
  if (filters.overdue) where.deadlines = { some: { resolvedAt: null, dueAt: { lt: now } } };
  where = applyQuickFilter(where, filters.quick, now);

  const cases = await prisma.case.findMany({ where, include: CASE_LIST_INCLUDE });

  let items: CaseListItem[] = cases.map(mapCaseToListItem);

  if (filters.amountMin !== undefined) items = items.filter((i) => i.amount !== null && i.amount >= filters.amountMin!);
  if (filters.amountMax !== undefined) items = items.filter((i) => i.amount !== null && i.amount <= filters.amountMax!);

  sortCaseListItems(items);

  const total = items.length;
  const page = Math.max(1, filters.page ?? 1);
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { items: paged, total };
}
