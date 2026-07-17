import type { FieldSourceType } from "@/generated/prisma/enums";
import type { ExtractionMessageInput } from "@/lib/adapters/llm/types";
import type { ExtractableCategory, ExtractionResultFor } from "@/lib/adapters/llm/schemas/extraction-index";
import type { QuoteRequestExtraction } from "@/lib/adapters/llm/schemas/extraction-quote-request";
import type { TransportOrderExtraction } from "@/lib/adapters/llm/schemas/extraction-transport-order";
import type { SupplierInvoiceExtraction } from "@/lib/adapters/llm/schemas/extraction-supplier-invoice";
import type { CustomerReceivableExtraction } from "@/lib/adapters/llm/schemas/extraction-customer-receivable";
import type { FinePenaltyExtraction } from "@/lib/adapters/llm/schemas/extraction-fine-or-penalty";
import type { ClaimOrDamageExtraction } from "@/lib/adapters/llm/schemas/extraction-claim-or-damage";
import {
  findAmountNearAnchor,
  findDatesIt,
  findPlate,
  findIban,
  findVatNumber,
  findInvoiceNumber,
  findOrderNumber,
  findFineNoticeNumber,
  findKeywordIndex,
} from "@/lib/text/patterns";

export interface Segment {
  messageId: string;
  attachmentId: string | null;
  sourceType: FieldSourceType;
  text: string;
}

/** Allegati (sempre isReadable, mai testo null) prima dei corpi email: precedenza attachment su email_body. */
export function buildSegments(messages: ExtractionMessageInput[]): Segment[] {
  const segments: Segment[] = [];
  for (const m of messages) {
    for (const a of m.attachments) {
      if (a.isReadable && a.text) {
        segments.push({ messageId: m.emailMessageId, attachmentId: a.attachmentId, sourceType: "ATTACHMENT", text: a.text });
      }
    }
  }
  for (const m of messages) {
    segments.push({ messageId: m.emailMessageId, attachmentId: null, sourceType: "EMAIL_BODY", text: m.bodyText });
  }
  return segments;
}

export interface Found<T> {
  value: T;
  raw: string;
  segment: Segment;
  confidence: number;
}

export function emptyField() {
  return {
    value: null,
    normalized_value: null,
    confidence: null,
    source_type: null,
    source_message_id: null,
    source_attachment_id: null,
    source_page: null,
    source_excerpt: null,
    needs_human_review: true,
  };
}

export function fieldFrom<T>(found: Found<T> | null, normalize: (v: T) => string = (v) => String(v)) {
  if (!found) return emptyField();
  return {
    value: found.value,
    normalized_value: normalize(found.value),
    confidence: found.confidence,
    source_type: found.segment.sourceType,
    source_message_id: found.segment.messageId,
    source_attachment_id: found.segment.attachmentId,
    source_page: null,
    source_excerpt: found.raw.slice(0, 200),
    needs_human_review: found.confidence < 0.6,
  };
}

function findAmountNear(segments: Segment[], anchors: string[]): Found<number> | null {
  for (const segment of segments) {
    const found = findAmountNearAnchor(segment.text, anchors);
    if (found) return { value: found.value, raw: found.raw, segment, confidence: 0.85 };
  }
  return null;
}

export function findDateNear(segments: Segment[], anchors: string[]): Found<string> | null {
  for (const segment of segments) {
    const idx = findKeywordIndex(segment.text, anchors);
    if (idx === -1) continue;
    const window = segment.text.slice(idx, idx + 80);
    const dates = findDatesIt(window);
    if (dates.length > 0) return { value: dates[0].value.toISOString(), raw: dates[0].raw, segment, confidence: 0.85 };
  }
  return null;
}

function findAnyDate(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const dates = findDatesIt(segment.text);
    if (dates.length > 0) return { value: dates[0].value.toISOString(), raw: dates[0].raw, segment, confidence: 0.55 };
  }
  return null;
}

function findAnyPlate(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const plate = findPlate(segment.text);
    if (plate) return { value: plate, raw: plate, segment, confidence: 0.85 };
  }
  return null;
}

function findAnyIban(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const iban = findIban(segment.text);
    if (iban) return { value: iban, raw: iban, segment, confidence: 0.9 };
  }
  return null;
}

function findAnyVat(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const vat = findVatNumber(segment.text);
    if (vat) return { value: vat, raw: vat, segment, confidence: 0.9 };
  }
  return null;
}

function findAnyInvoiceNumber(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const num = findInvoiceNumber(segment.text);
    if (num) return { value: num, raw: num, segment, confidence: 0.85 };
  }
  return null;
}

function findAnyOrderNumber(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const num = findOrderNumber(segment.text);
    if (num) return { value: num, raw: num, segment, confidence: 0.85 };
  }
  return null;
}

function findAnyFineNoticeNumber(segments: Segment[]): Found<string> | null {
  for (const segment of segments) {
    const num = findFineNoticeNumber(segment.text);
    if (num) return { value: num, raw: num, segment, confidence: 0.85 };
  }
  return null;
}

function findNumberNear(segments: Segment[], anchors: string[], unit: RegExp): Found<number> | null {
  for (const segment of segments) {
    const idx = findKeywordIndex(segment.text, anchors);
    if (idx === -1) continue;
    const window = segment.text.slice(Math.max(0, idx - 30), idx + 60);
    const match = unit.exec(window);
    if (match) {
      const value = Number(match[1].replace(",", "."));
      if (Number.isFinite(value)) return { value, raw: match[0], segment, confidence: 0.8 };
    }
  }
  return null;
}

function findTextAfter(segments: Segment[], labelRegex: RegExp): Found<string> | null {
  for (const segment of segments) {
    const match = labelRegex.exec(segment.text);
    if (match && match[1]) {
      return { value: match[1].trim(), raw: match[0], segment, confidence: 0.75 };
    }
  }
  return null;
}

function keywordPresent(segments: Segment[], keywords: string[]): Found<boolean> | null {
  for (const segment of segments) {
    const idx = findKeywordIndex(segment.text, keywords);
    if (idx !== -1) return { value: true, raw: segment.text.slice(idx, idx + 40), segment, confidence: 0.8 };
  }
  return null;
}

function keywordExplicitBoolean(segments: Segment[], negativeKeywords: string[], positiveKeywords: string[]): Found<boolean> | null {
  for (const segment of segments) {
    const negIdx = findKeywordIndex(segment.text, negativeKeywords);
    if (negIdx !== -1) return { value: false, raw: segment.text.slice(negIdx, negIdx + 40), segment, confidence: 0.8 };
  }
  return keywordPresent(segments, positiveKeywords);
}

function extractQuoteRequest(segments: Segment[]): QuoteRequestExtraction {
  const missing: string[] = [];

  const pallets = findNumberNear(segments, ["pallet"], /(\d+)\s*pallet/i);
  const weight = findNumberNear(segments, ["peso"], /(\d+(?:[.,]\d+)?)\s*kg/i);
  const pickupDate = findDateNear(segments, ["ritiro"]);
  const deliveryDate = findDateNear(segments, ["consegna"]);
  const responseDue = findDateNear(segments, ["rispondere entro", "entro il"]);
  const adr = keywordExplicitBoolean(segments, ["nessun adr"], ["adr"]);
  const tailgate = keywordPresent(segments, ["sponda idraulica"]);
  const tempControlled = keywordPresent(segments, ["temperatura controllata"]);
  const insurance = keywordPresent(segments, ["assicurazione"]);
  const goodsValue = findAmountNear(segments, ["valore merce", "valore stimato", "stimato"]);
  const price = findAmountNear(segments, ["prezzo", "tariffa"]);

  let transportMode: Found<"GROUPAGE" | "LTL" | "FTL" | "LAST_MILE"> | null = null;
  for (const segment of segments) {
    if (/\bftl\b|trasporto completo/i.test(segment.text)) {
      transportMode = { value: "FTL", raw: "FTL", segment, confidence: 0.75 };
      break;
    }
    if (/\bltl\b/i.test(segment.text)) {
      transportMode = { value: "LTL", raw: "LTL", segment, confidence: 0.75 };
      break;
    }
    if (/groupage/i.test(segment.text)) {
      transportMode = { value: "GROUPAGE", raw: "groupage", segment, confidence: 0.75 };
      break;
    }
    if (/ultimo miglio/i.test(segment.text)) {
      transportMode = { value: "LAST_MILE", raw: "ultimo miglio", segment, confidence: 0.75 };
      break;
    }
  }

  if (!pallets) missing.push("pallet");
  if (!weight) missing.push("peso");
  if (!pickupDate) missing.push("data di ritiro");
  if (!deliveryDate) missing.push("data di consegna");

  return {
    customer_name: emptyField(),
    contact_name: emptyField(),
    contact_email: emptyField(),
    contact_phone: emptyField(),
    pickup_location: fieldFrom(findTextAfter(segments, /ritiro:?\s*([A-Zà-ù][\wà-ù'\s]*?)(?:\s+(?:il|entro|dalle)\b|[.,\n])/i)),
    delivery_location: fieldFrom(findTextAfter(segments, /consegna(?:\s+a)?:?\s*([A-Zà-ù][\wà-ù'\s]*?)(?:\s+(?:il|entro|dalle)\b|[.,\n])/i)),
    pickup_datetime: fieldFrom(pickupDate),
    pickup_time_window: emptyField(),
    delivery_datetime: fieldFrom(deliveryDate),
    delivery_time_window: emptyField(),
    pallet_count: fieldFrom(pallets),
    weight_kg: fieldFrom(weight),
    volume_m3: emptyField(),
    linear_meters: emptyField(),
    goods_type: emptyField(),
    transport_mode: fieldFrom(transportMode),
    requested_vehicle: emptyField(),
    hydraulic_tailgate_required: fieldFrom(tailgate),
    adr_required: fieldFrom(adr),
    temperature_controlled: fieldFrom(tempControlled),
    goods_value: fieldFrom(goodsValue),
    insurance_required: fieldFrom(insurance),
    requested_or_proposed_price: fieldFrom(price),
    response_due_at: fieldFrom(responseDue),
    missing_data: missing,
  };
}

function extractTransportOrder(segments: Segment[]): TransportOrderExtraction {
  const orderNumber = findAnyOrderNumber(segments);
  const plate = findAnyPlate(segments);
  const price = findAmountNear(segments, ["prezzo", "tariffa", "importo"]);
  const pickupDate = findDateNear(segments, ["ritiro"]);
  const deliveryDate = findDateNear(segments, ["consegna"]);

  const requiredDocuments: string[] = [];
  for (const segment of segments) {
    if (/\bcmr\b/i.test(segment.text)) requiredDocuments.push("CMR");
    if (/\bpod\b/i.test(segment.text)) requiredDocuments.push("POD");
  }

  return {
    order_number: fieldFrom(orderNumber),
    customer_name: emptyField(),
    customer_references: emptyField(),
    origin: fieldFrom(findTextAfter(segments, /ritiro\s+a\s+([A-Zà-ù][\wà-ù'\s]*?)(?:\s+il\b|[.,\n])/i)),
    destination: fieldFrom(findTextAfter(segments, /consegna\s+a\s+([A-Zà-ù][\wà-ù'\s]*?)(?:\s+entro\b|[.,\n])/i)),
    pickup_datetime: fieldFrom(pickupDate),
    pickup_time_window: emptyField(),
    delivery_datetime: fieldFrom(deliveryDate),
    delivery_time_window: emptyField(),
    vehicle_type: fieldFrom(findTextAfter(segments, /mezzo\s+richiesto:?\s*([\wà-ù\s]+?)(?:[.,\n]|$)/i)),
    plate: fieldFrom(plate),
    driver_name: emptyField(),
    price: fieldFrom(price),
    instructions: emptyField(),
    required_documents: { ...emptyField(), value: requiredDocuments.length > 0 ? requiredDocuments : null, needs_human_review: requiredDocuments.length === 0 },
    loading_references: emptyField(),
    unloading_references: emptyField(),
  };
}

function extractSupplierInvoice(segments: Segment[]): SupplierInvoiceExtraction {
  const invoiceNumber = findAnyInvoiceNumber(segments);
  const invoiceDate = findDateNear(segments, ["fattura del", "data fattura"]) ?? findAnyDate(segments);
  const netAmount = findAmountNear(segments, ["imponibile"]);
  const vatAmount = findAmountNear(segments, ["iva"]);
  const totalAmount = findAmountNear(segments, ["totale"]);
  const dueDate = findDateNear(segments, ["scadenza"]);
  const iban = findAnyIban(segments);
  const orderNumber = findAnyOrderNumber(segments);
  const plate = findAnyPlate(segments);

  return {
    supplier_name: emptyField(),
    vat_number: fieldFrom(findAnyVat(segments)),
    invoice_number: fieldFrom(invoiceNumber),
    invoice_date: fieldFrom(invoiceDate),
    amount_net: fieldFrom(netAmount),
    vat_amount: fieldFrom(vatAmount),
    amount_total: fieldFrom(totalAmount),
    currency: totalAmount ? { ...emptyField(), value: "EUR", normalized_value: "EUR", confidence: 0.9, needs_human_review: false } : emptyField(),
    due_date: fieldFrom(dueDate),
    iban: fieldFrom(iban),
    order_number: fieldFrom(orderNumber),
    linked_shipment_reference: emptyField(),
    plate: fieldFrom(plate),
    cost_center: emptyField(),
    possible_duplicate: {
      ...emptyField(),
      value: false,
      normalized_value: "false",
      confidence: 1,
      needs_human_review: false,
    },
    anomaly_reason: emptyField(),
  };
}

function extractCustomerReceivable(segments: Segment[]): CustomerReceivableExtraction {
  const invoiceNumber = findAnyInvoiceNumber(segments);
  const amount = findAmountNear(segments, ["fattura", "importo"]);
  const dueDate = findDateNear(segments, ["scadenza", "pagheremo entro", "entro il"]);
  const hasReceipt = keywordPresent(segments, ["contabile del bonifico", "contabile", "in allegato la contabile"]);
  const paymentPromise = keywordPresent(segments, ["pagheremo entro", "confermiamo che pagheremo"]);

  return {
    customer_name: emptyField(),
    invoice_number: fieldFrom(invoiceNumber),
    amount: fieldFrom(amount),
    invoice_date: emptyField(),
    due_date: fieldFrom(dueDate),
    days_overdue: emptyField(),
    payment_promise: fieldFrom(paymentPromise),
    payment_promise_date: paymentPromise ? fieldFrom(dueDate) : emptyField(),
    has_payment_receipt_attachment: fieldFrom(hasReceipt),
    customer_declared_status: fieldFrom(findTextAfter(segments, /(risulta\s+(?:già\s+)?[\wà-ù\s]+?)[.,\n]/i)),
  };
}

function extractFinePenalty(segments: Segment[]): FinePenaltyExtraction {
  const noticeNumber = findAnyFineNoticeNumber(segments);
  const plate = findAnyPlate(segments);
  const amount = findAmountNear(segments, ["importo ordinario"]);
  const reducedAmount = findAmountNear(segments, ["importo ridotto"]);
  const reducedDue = findDateNear(segments, ["termine per il pagamento in misura ridotta", "scadenza ridotto", "entro il"]);
  const appealDue = findDateNear(segments, ["ricorso"]);
  const violationDate = findDateNear(segments, ["elevato in data", "data infrazione", "infrazione"]);

  return {
    issuing_authority: emptyField(),
    notice_number: fieldFrom(noticeNumber),
    plate: fieldFrom(plate),
    driver_name: fieldFrom(findTextAfter(segments, /conducente\s+([A-Zà-ù][\wà-ù'\s]*?)[.,\n]/i)),
    violation_datetime: fieldFrom(violationDate),
    violation_location: emptyField(),
    violation_type: fieldFrom(findTextAfter(segments, /violazione\s+art\.?\s*(\d+[\wà-ù\s.]*?)(?:,|\n|elevato)/i)),
    amount: fieldFrom(amount),
    reduced_amount: fieldFrom(reducedAmount),
    reduced_payment_due_at: fieldFrom(reducedDue),
    ordinary_payment_due_at: emptyField(),
    appeal_due_at: fieldFrom(appealDue),
    points: emptyField(),
    missing_documents: { ...emptyField(), value: [], needs_human_review: false },
    received_channel: emptyField(),
  };
}

function extractClaimOrDamage(segments: Segment[]): ClaimOrDamageExtraction {
  const requestedAmount = findAmountNear(segments, ["rimborso di", "risarcimento di", "chiediamo un rimborso"]);
  const eventDate = findDateNear(segments, ["consegna prevista", "data evento"]);
  const photosPresent = segments.some((s) => s.sourceType === "ATTACHMENT" && /foto/i.test(s.text))
    ? { value: true, raw: "allegato foto", segment: segments.find((s) => s.sourceType === "ATTACHMENT")!, confidence: 0.8 }
    : null;
  const cmrOrPod = keywordExplicitBoolean(segments, ["non abbiamo ricevuto né cmr né pod", "non abbiamo ricevuto"], ["cmr", "pod"]);

  const missingDocuments: string[] = [];
  if (cmrOrPod?.value === false) missingDocuments.push("CMR/POD");

  return {
    customer_name: emptyField(),
    shipment_or_trip_reference: fieldFrom(findTextAfter(segments, /spedizione\s+([A-Z0-9-]+)/i)),
    event_date: fieldFrom(eventDate),
    goods_description: emptyField(),
    damage_description: emptyField(),
    requested_amount: fieldFrom(requestedAmount),
    photos_present: fieldFrom(photosPresent),
    cmr_or_pod_present: fieldFrom(cmrOrPod),
    insurance_involved: emptyField(),
    severity: emptyField(),
    response_due_at: emptyField(),
    missing_documents: { ...emptyField(), value: missingDocuments.length > 0 ? missingDocuments : null, needs_human_review: missingDocuments.length === 0 },
    possible_responsible_party: emptyField(),
  };
}

export function extractHeuristically<C extends ExtractableCategory>(category: C, messages: ExtractionMessageInput[]): ExtractionResultFor<C> {
  const segments = buildSegments(messages);
  switch (category) {
    case "QUOTE_REQUEST":
      return extractQuoteRequest(segments) as ExtractionResultFor<C>;
    case "TRANSPORT_ORDER":
      return extractTransportOrder(segments) as ExtractionResultFor<C>;
    case "SUPPLIER_INVOICE":
      return extractSupplierInvoice(segments) as ExtractionResultFor<C>;
    case "CUSTOMER_RECEIVABLE":
      return extractCustomerReceivable(segments) as ExtractionResultFor<C>;
    case "FINE_OR_PENALTY":
      return extractFinePenalty(segments) as ExtractionResultFor<C>;
    case "CLAIM_OR_DAMAGE":
      return extractClaimOrDamage(segments) as ExtractionResultFor<C>;
    default:
      throw new Error(`Categoria non estraibile: ${category}`);
  }
}
