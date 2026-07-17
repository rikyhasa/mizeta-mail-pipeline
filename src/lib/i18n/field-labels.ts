import type { ExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Etichette italiane per i fieldKey estratti (SPEC.md §6). Una sola mappa piatta: le chiavi
 * condivise fra categorie (es. `customer_name`, `due_date`, `plate`) hanno lo stesso
 * significato ovunque compaiano.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Comuni
  customer_name: "Cliente",
  supplier_name: "Fornitore",
  invoice_number: "Numero fattura",
  invoice_date: "Data fattura",
  due_date: "Scadenza",
  amount: "Importo",
  amount_net: "Imponibile",
  vat_amount: "IVA",
  amount_total: "Totale",
  currency: "Valuta",
  order_number: "Numero ordine",
  plate: "Targa",
  driver_name: "Autista",
  response_due_at: "Termine per rispondere",
  missing_data: "Dati mancanti",
  missing_documents: "Documenti mancanti",
  required_documents: "Documenti richiesti",

  // QUOTE_REQUEST
  contact_name: "Referente",
  contact_email: "Email referente",
  contact_phone: "Telefono referente",
  pickup_location: "Luogo di ritiro",
  delivery_location: "Luogo di consegna",
  pickup_datetime: "Data ritiro",
  pickup_time_window: "Fascia oraria ritiro",
  delivery_datetime: "Data consegna",
  delivery_time_window: "Fascia oraria consegna",
  pallet_count: "Numero pallet",
  weight_kg: "Peso (kg)",
  volume_m3: "Volume (m³)",
  linear_meters: "Metri lineari",
  goods_type: "Tipologia merce",
  transport_mode: "Modalità di trasporto",
  requested_vehicle: "Mezzo richiesto",
  hydraulic_tailgate_required: "Sponda idraulica richiesta",
  adr_required: "ADR richiesto",
  temperature_controlled: "Temperatura controllata",
  goods_value: "Valore merce",
  insurance_required: "Assicurazione richiesta",
  requested_or_proposed_price: "Prezzo richiesto/proposto",

  // TRANSPORT_ORDER
  customer_references: "Riferimenti cliente",
  origin: "Origine",
  destination: "Destinazione",
  vehicle_type: "Tipo mezzo",
  price: "Prezzo",
  instructions: "Istruzioni",
  loading_references: "Riferimenti carico",
  unloading_references: "Riferimenti scarico",

  // SUPPLIER_INVOICE
  vat_number: "Partita IVA",
  iban: "IBAN",
  linked_shipment_reference: "Viaggio collegato",
  cost_center: "Centro di costo",
  possible_duplicate: "Possibile duplicato",
  anomaly_reason: "Motivazione anomalia",

  // CUSTOMER_RECEIVABLE
  days_overdue: "Giorni di ritardo",
  payment_promise: "Promessa di pagamento",
  payment_promise_date: "Data promessa di pagamento",
  has_payment_receipt_attachment: "Contabile presente",
  customer_declared_status: "Stato dichiarato dal cliente",
  erp_verified_status: "Stato verificato nel gestionale",

  // FINE_OR_PENALTY
  issuing_authority: "Ente",
  notice_number: "Numero verbale",
  violation_datetime: "Data infrazione",
  violation_location: "Luogo infrazione",
  violation_type: "Tipo violazione",
  reduced_amount: "Importo ridotto",
  reduced_payment_due_at: "Scadenza pagamento ridotto",
  ordinary_payment_due_at: "Scadenza pagamento ordinario",
  appeal_due_at: "Termine per il ricorso",
  points: "Punti decurtati",
  received_channel: "Canale di ricezione",
  notification_date: "Data di notifica",
  driver_professional_cqc: "Autista professionale (CQC)",

  // CLAIM_OR_DAMAGE
  shipment_or_trip_reference: "Spedizione/viaggio",
  event_date: "Data evento",
  goods_description: "Descrizione merce",
  damage_description: "Descrizione danno",
  requested_amount: "Importo richiesto",
  photos_present: "Foto presenti",
  cmr_or_pod_present: "CMR/POD presenti",
  insurance_involved: "Assicurazione coinvolta",
  severity: "Gravità",
  possible_responsible_party: "Possibile responsabile",
};

export function fieldLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey] ?? fieldKey;
}

/** Ordine di visualizzazione dei campi estratti nel dettaglio pratica (SPEC.md §10), per categoria. */
export const CATEGORY_FIELD_ORDER: Record<ExtractableCategory, string[]> = {
  QUOTE_REQUEST: [
    "customer_name",
    "contact_name",
    "contact_email",
    "contact_phone",
    "pickup_location",
    "delivery_location",
    "pickup_datetime",
    "pickup_time_window",
    "delivery_datetime",
    "delivery_time_window",
    "pallet_count",
    "weight_kg",
    "volume_m3",
    "linear_meters",
    "goods_type",
    "transport_mode",
    "requested_vehicle",
    "hydraulic_tailgate_required",
    "adr_required",
    "temperature_controlled",
    "goods_value",
    "insurance_required",
    "requested_or_proposed_price",
    "response_due_at",
  ],
  TRANSPORT_ORDER: [
    "order_number",
    "customer_name",
    "customer_references",
    "origin",
    "destination",
    "pickup_datetime",
    "pickup_time_window",
    "delivery_datetime",
    "delivery_time_window",
    "vehicle_type",
    "plate",
    "driver_name",
    "price",
    "instructions",
    "required_documents",
    "loading_references",
    "unloading_references",
  ],
  SUPPLIER_INVOICE: [
    "supplier_name",
    "vat_number",
    "invoice_number",
    "invoice_date",
    "amount_net",
    "vat_amount",
    "amount_total",
    "currency",
    "due_date",
    "iban",
    "order_number",
    "linked_shipment_reference",
    "plate",
    "cost_center",
    "possible_duplicate",
    "anomaly_reason",
  ],
  CUSTOMER_RECEIVABLE: [
    "customer_name",
    "invoice_number",
    "amount",
    "invoice_date",
    "due_date",
    "days_overdue",
    "payment_promise",
    "payment_promise_date",
    "has_payment_receipt_attachment",
    "customer_declared_status",
    "erp_verified_status",
  ],
  FINE_OR_PENALTY: [
    "issuing_authority",
    "notice_number",
    "plate",
    "driver_name",
    "violation_datetime",
    "violation_location",
    "violation_type",
    "amount",
    "reduced_amount",
    "reduced_payment_due_at",
    "ordinary_payment_due_at",
    "appeal_due_at",
    "notification_date",
    "points",
    "driver_professional_cqc",
    "missing_documents",
    "received_channel",
  ],
  CLAIM_OR_DAMAGE: [
    "customer_name",
    "shipment_or_trip_reference",
    "event_date",
    "goods_description",
    "damage_description",
    "requested_amount",
    "photos_present",
    "cmr_or_pod_present",
    "insurance_involved",
    "severity",
    "response_due_at",
    "missing_documents",
    "possible_responsible_party",
  ],
};

/**
 * Tipo dei valori estratti per formattazione nell'interfaccia (CLAUDE.md: importi e date in
 * formato italiano). `CaseField.value` è sempre una stringa in DB — questi insiemi permettono
 * di riconoscere quali fieldKey rappresentano date, importi, booleani o numeri semplici.
 */
const DATE_FIELD_KEYS = new Set([
  "pickup_datetime",
  "delivery_datetime",
  "response_due_at",
  "invoice_date",
  "due_date",
  "violation_datetime",
  "event_date",
  "reduced_payment_due_at",
  "ordinary_payment_due_at",
  "appeal_due_at",
  "payment_promise_date",
  "notification_date",
]);

/** `driver_professional_cqc` (SPEC.md §10bis, indicatore ricorso) non va mai estratto o dedotto
 * dal modello (CLAUDE.md invariante 6): l'informazione raramente è scritta nel verbale, va
 * inserita o confermata da un operatore (o, in futuro, derivata dall'anagrafica autisti) — non
 * fa parte di `finePenaltyExtractionSchema`. Assente/non confermato è un valore legittimo, non
 * un dato mancante che blocca il calcolo: l'indicatore lo tratta come "punti non conteggiati". */
const BOOLEAN_FIELD_KEYS = new Set([
  "hydraulic_tailgate_required",
  "adr_required",
  "temperature_controlled",
  "insurance_required",
  "possible_duplicate",
  "payment_promise",
  "has_payment_receipt_attachment",
  "photos_present",
  "cmr_or_pod_present",
  "insurance_involved",
  "driver_professional_cqc",
]);

const CURRENCY_FIELD_KEYS = new Set([
  "goods_value",
  "requested_or_proposed_price",
  "price",
  "amount",
  "amount_net",
  "vat_amount",
  "amount_total",
  "reduced_amount",
  "requested_amount",
]);

const PLAIN_NUMBER_FIELD_KEYS = new Set(["pallet_count", "weight_kg", "volume_m3", "linear_meters", "points", "days_overdue"]);

const italianNumberFormatter = new Intl.NumberFormat("it-IT");

export function formatFieldValue(fieldKey: string, value: string): string {
  if (DATE_FIELD_KEYS.has(fieldKey)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : formatDate(parsed);
  }
  if (BOOLEAN_FIELD_KEYS.has(fieldKey)) {
    if (value === "true") return "Sì";
    if (value === "false") return "No";
    return value;
  }
  if (CURRENCY_FIELD_KEYS.has(fieldKey)) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : formatCurrency(parsed);
  }
  if (PLAIN_NUMBER_FIELD_KEYS.has(fieldKey)) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : italianNumberFormatter.format(parsed);
  }
  return value;
}
