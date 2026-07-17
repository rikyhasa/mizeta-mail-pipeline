import type { EnforcementCheckApplicability } from "@/generated/prisma/enums";
import type { EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import type { ExtractionMessageInput } from "@/lib/adapters/llm/types";
import { findKeywordIndex } from "@/lib/text/patterns";
import { buildSegments, emptyField, fieldFrom, findDateNear, type Found, type Segment } from "./extract-heuristics";

interface ApplicabilityRule {
  keywords: string[];
  applicability: EnforcementCheckApplicability;
}

/** Ordine di priorità: un controllo non legato alla velocità (ZTL/semaforo/varco) esclude
 * subito l'applicabilità, prima di cercare segnali di velocità più specifici — un solo segnale
 * dominante per verbale, non un punteggio combinato tra regole. */
const APPLICABILITY_RULES: ApplicabilityRule[] = [
  { keywords: ["ztl", "zona a traffico limitato", "accesso non autorizzato", "varco elettronico", "semaforo"], applicability: "NOT_APPLICABLE" },
  { keywords: ["tutor", "velocità media"], applicability: "AVERAGE_SPEED_CONTROL" },
  { keywords: ["telelaser"], applicability: "TELELASER" },
  { keywords: ["autovelox mobile", "postazione mobile", "pattuglia con autovelox"], applicability: "SPEED_CAMERA_MOBILE" },
  { keywords: ["autovelox", "rilevatore di velocità", "misuratore di velocità"], applicability: "SPEED_CAMERA_FIXED" },
];

/** Art. 142 C.d.S. è specificamente "superamento dei limiti massimi di velocità" — segnale
 * reale di violazione legata alla velocità anche quando il verbale non nomina il dispositivo. */
const SPEED_VIOLATION_KEYWORDS = ["art. 142", "articolo 142", "superamento dei limiti di velocità", "eccesso di velocità", "limite di velocità"];

/** Lista limitata di marchi/modelli reali noti — se assente nel testo il campo resta vuoto,
 * mai una supposizione (CLAUDE.md invariante 6). */
const KNOWN_MANUFACTURERS = ["gatso", "gatsometer", "sicve", "t-explorer", "velomatic", "photored", "t-redspeed", "autovelox 104"];

const SERIAL_NUMBER_REGEX = /matricola\s*(?:numero|n\.?)?\s*:?\s*([\w-]+)/i;
const DECREE_NUMBER_REGEX = /decreto\s+(?:di\s+)?(?:approvazione|omologazione)?\s*(?:numero|n\.?)?\s*:?\s*([\w./-]+)/i;

function findFirstKeywordMatch(segments: Segment[], keywords: string[]): { segment: Segment; keyword: string } | null {
  for (const segment of segments) {
    if (findKeywordIndex(segment.text, keywords) === -1) continue;
    const lower = segment.text.toLowerCase();
    const keyword = keywords.find((k) => lower.includes(k.toLowerCase()));
    if (keyword) return { segment, keyword };
  }
  return null;
}

function excerptAround(segment: Segment, keyword: string): string {
  const idx = segment.text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return segment.text.slice(0, 200);
  return segment.text.slice(Math.max(0, idx - 40), idx + 160);
}

interface ApplicabilityDetection {
  value: EnforcementCheckApplicability;
  segment: Segment | null;
  excerpt: string | null;
}

function detectApplicability(segments: Segment[]): ApplicabilityDetection {
  for (const rule of APPLICABILITY_RULES) {
    const match = findFirstKeywordMatch(segments, rule.keywords);
    if (match) return { value: rule.applicability, segment: match.segment, excerpt: excerptAround(match.segment, match.keyword) };
  }
  const speedSignal = findFirstKeywordMatch(segments, SPEED_VIOLATION_KEYWORDS);
  if (speedSignal) {
    return { value: "TO_BE_IDENTIFIED", segment: speedSignal.segment, excerpt: excerptAround(speedSignal.segment, speedSignal.keyword) };
  }
  return { value: "NOT_APPLICABLE", segment: null, excerpt: null };
}

function findManufacturer(segments: Segment[]): Found<string> | null {
  const match = findFirstKeywordMatch(segments, KNOWN_MANUFACTURERS);
  if (!match) return null;
  return { value: match.keyword, raw: excerptAround(match.segment, match.keyword), segment: match.segment, confidence: 0.6 };
}

function findWithRegex(segments: Segment[], regex: RegExp, confidence: number): Found<string> | null {
  for (const segment of segments) {
    const match = regex.exec(segment.text);
    if (match?.[1]) return { value: match[1], raw: match[0], segment, confidence };
  }
  return null;
}

/**
 * Analisi euristica reale (non canned) di applicabilità e dati tecnici del dispositivo
 * (docs/SPEC-AUTOVELOX-DRAFT.md §4, §6): stesso principio del resto del motore mock — pattern
 * matching sul testo già disponibile, mai un'azione derivata dal contenuto (CLAUDE.md
 * invariante 1). Per la maggior parte dei verbali reali odierni (nessun dettaglio tecnico nel
 * corpo email) restituisce onestamente campi vuoti oltre all'applicabilità — non è un difetto,
 * è l'assenza di segnale nel testo sorgente.
 */
export function analyzeEnforcementDeviceHeuristically(messages: ExtractionMessageInput[]): EnforcementDeviceAnalysisResult {
  const segments = buildSegments(messages);

  const applicability = detectApplicability(segments);
  const manufacturer = findManufacturer(segments);
  const serialNumber = findWithRegex(segments, SERIAL_NUMBER_REGEX, 0.75);
  const decreeNumber = findWithRegex(segments, DECREE_NUMBER_REGEX, 0.75);
  const decreeDate = findDateNear(segments, ["decreto"]);

  return {
    applicability: {
      value: applicability.value,
      normalized_value: applicability.value,
      confidence: applicability.segment ? 0.7 : null,
      source_type: applicability.segment?.sourceType ?? null,
      source_message_id: applicability.segment?.messageId ?? null,
      source_attachment_id: applicability.segment?.attachmentId ?? null,
      source_page: null,
      source_excerpt: applicability.excerpt,
      needs_human_review: true,
    },
    manufacturer: fieldFrom(manufacturer),
    model: emptyField(),
    version: emptyField(),
    serial_number: fieldFrom(serialNumber),
    decree_number: fieldFrom(decreeNumber),
    decree_date: fieldFrom(decreeDate),
    authority: emptyField(),
  };
}
