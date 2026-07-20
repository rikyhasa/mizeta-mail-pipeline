import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";
import type { AttachmentExtractionOutcome } from "@/lib/attachments/types";

/**
 * Estrae l'XML firmato da una busta CMS/PKCS#7 (.p7m) SENZA verificarne la firma
 * crittografica — esplicitamente fuori scope in questa fase (docs/FASE-10-LETTURA-ALLEGATI.md:
 * "estrai l'XML dalla firma senza verificarla crittograficamente in v1, documentalo"). Non
 * fidarsi mai del contenuto firmato più di quanto ci si fiderebbe di un allegato non firmato:
 * resta comunque dato esterno non affidabile (CLAUDE.md invariante 1).
 */
/** Struttura ASN.1 grezza del nodo OCTETSTRING che contiene l'XML incapsulato, dentro
 * ContentInfo.content `[0] EXPLICIT` (RFC 2315 §7). */
interface Asn1OctetStringNode {
  type: number;
  constructed: boolean;
  value: string;
}

function unwrapP7m(content: Buffer): Buffer | null {
  try {
    const der = forge.util.createBuffer(content.toString("binary"));
    const asn1 = forge.asn1.fromDer(der);
    const message = forge.pkcs7.messageFromAsn1(asn1);
    // `message.content`/`message.rawCapture.content` è il nodo ASN.1 `[0] EXPLICIT content`
    // catturato per intero (non solo i byte): bisogna scendere di un livello fino
    // all'OCTETSTRING figlio per ottenere i byte grezzi dell'XML firmato. Verificato contro
    // una busta CMS/PKCS#7 SignedData sintetica generata con node-forge stesso nei test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCapture = (message as any).rawCapture as { content?: { value?: Asn1OctetStringNode[] } } | undefined;
    const octetStringNode = rawCapture?.content?.value?.[0];
    if (!octetStringNode || typeof octetStringNode.value !== "string") return null;
    return Buffer.from(octetStringNode.value, "binary");
  } catch {
    return null;
  }
}

// fast-xml-parser è un parser puro (tokenizza tag/testo), non risolve mai DOCTYPE/entità
// esterne o richieste di rete/file (nessuna capacità DTD esiste in questa libreria) — a
// differenza dei parser basati su libxml2, non esiste alcuna opzione da disabilitare per
// mitigare XXE: è strutturalmente non vulnerabile. Verificato con test dedicato.
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

function stripNsPrefix(key: string): string {
  const idx = key.indexOf(":");
  return idx === -1 ? key : key.slice(idx + 1);
}

function findRoot(parsed: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of Object.keys(parsed)) {
    if (stripNsPrefix(key) === "FatturaElettronica") return parsed[key] as Record<string, unknown>;
  }
  return null;
}

function firstOf<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function sumOf(value: unknown): number | null {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) {
    const n = Number(String(v).trim());
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function getPath(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Mappa una FatturaElettronica (XSD FatturaPA v1.2) sugli stessi field key usati da
 * `supplierInvoiceExtractionSchema` (src/lib/adapters/llm/schemas/extraction-supplier-invoice.ts),
 * così il merge in `runPipelineForMessage` (FASE 10) può sovrascrivere direttamente i
 * campi corrispondenti con confidenza 1.0. Riconosce solo la forma minima essenziale: se
 * mancano sia numero fattura sia fornitore, l'XML non viene considerato una FatturaPA valida
 * (mai un tentativo di leggerlo come testo generico).
 */
export function extractStructuredFatturaPa(fileName: string, content: Buffer): AttachmentExtractionOutcome {
  const isP7m = fileName.toLowerCase().endsWith(".p7m");
  const xmlBuffer = isP7m ? unwrapP7m(content) : content;
  if (!xmlBuffer) {
    return { status: "FAILED", reason: "Busta .p7m non riconosciuta: impossibile estrarre l'XML firmato." };
  }

  const xmlText = xmlBuffer.toString("utf-8").trim();
  if (!xmlText.startsWith("<")) {
    return { status: "FAILED", reason: "Contenuto non riconosciuto come XML." };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
  } catch {
    return { status: "FAILED", reason: "XML non valido o corrotto." };
  }

  const root = findRoot(parsed);
  if (!root) {
    return { status: "FAILED", reason: "XML non riconosciuto come fattura elettronica (FatturaElettronica)." };
  }

  const header = root["FatturaElettronicaHeader"];
  const body = firstOf(root["FatturaElettronicaBody"]);

  const supplierName = getPath(header, ["CedentePrestatore", "DatiAnagrafici", "Anagrafica", "Denominazione"]);
  const idPaese = getPath(header, ["CedentePrestatore", "DatiAnagrafici", "IdFiscaleIVA", "IdPaese"]);
  const idCodice = getPath(header, ["CedentePrestatore", "DatiAnagrafici", "IdFiscaleIVA", "IdCodice"]);

  const datiGeneraliDocumento = getPath(body, ["DatiGenerali", "DatiGeneraliDocumento"]);
  const invoiceNumber = getPath(datiGeneraliDocumento, ["Numero"]);
  const invoiceDate = getPath(datiGeneraliDocumento, ["Data"]);
  const currency = getPath(datiGeneraliDocumento, ["Divisa"]);
  const amountTotal = getPath(datiGeneraliDocumento, ["ImportoTotaleDocumento"]);

  const datiRiepilogo = getPath(body, ["DatiBeniServizi", "DatiRiepilogo"]);
  const amountNet = sumOf(getPathList(datiRiepilogo, "ImponibileImporto"));
  const vatAmount = sumOf(getPathList(datiRiepilogo, "Imposta"));

  const dettaglioPagamento = firstOf(getPath(body, ["DatiPagamento", "DettaglioPagamento"]) as unknown);
  const dueDate = getPath(dettaglioPagamento, ["DataScadenzaPagamento"]);
  const iban = getPath(dettaglioPagamento, ["IBAN"]);

  if (!invoiceNumber && !supplierName) {
    return { status: "FAILED", reason: "XML strutturato come XML ma privo dei campi minimi di una fattura elettronica." };
  }

  const structuredFields: Record<string, string | number | boolean> = {};
  if (typeof supplierName === "string" && supplierName) structuredFields.supplier_name = supplierName;
  if (idPaese || idCodice) structuredFields.vat_number = `${idPaese ?? ""}${idCodice ?? ""}`;
  if (typeof invoiceNumber === "string" && invoiceNumber) structuredFields.invoice_number = invoiceNumber;
  if (typeof invoiceDate === "string" && invoiceDate) structuredFields.invoice_date = invoiceDate;
  if (amountNet !== null) structuredFields.amount_net = amountNet;
  if (vatAmount !== null) structuredFields.vat_amount = vatAmount;
  const amountTotalNumber = toNumberOrNull(amountTotal);
  if (amountTotalNumber !== null) structuredFields.amount_total = amountTotalNumber;
  if (typeof currency === "string" && currency) structuredFields.currency = currency;
  if (typeof dueDate === "string" && dueDate) structuredFields.due_date = dueDate;
  if (typeof iban === "string" && iban) structuredFields.iban = iban;

  return { status: "SUCCEEDED", method: "STRUCTURED", structuredFields };
}

/** Estrae un campo da uno o più blocchi DatiRiepilogo (un blocco per aliquota IVA nella FatturaPA reale). */
function getPathList(container: unknown, field: string): unknown {
  const items = Array.isArray(container) ? container : [container];
  const values = items.map((item) => (item as Record<string, unknown>)?.[field]).filter((v) => v !== undefined);
  return values.length === 0 ? undefined : values;
}
