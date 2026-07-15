import type { CaseRepository, MatchEmailInput } from "../types";

const STOPWORDS = new Set([
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "a", "da", "in", "con", "su", "per",
  "tra", "fra", "e", "o", "che", "non", "come", "più", "del", "della", "dello", "dei", "degli", "delle",
  "al", "alla", "allo", "ai", "agli", "alle", "buongiorno", "grazie", "salve", "cordiali", "saluti",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\wà-ù\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Ultimo livello della cascata (SPEC.md §7): proxy deterministico a overlap di token (Jaccard),
 * NON vera ricerca semantica/embeddings — limitazione nota. Confidenza sempre limitata a un
 * massimo di 0.6: da sola non deve mai bastare per un merge automatico.
 */
export async function levelSemanticSimilarity(input: MatchEmailInput, repo: CaseRepository) {
  const candidates = await repo.listOpenCasesInCategory(input.category);
  if (candidates.length === 0) return null;

  const queryTokens = tokenize(`${input.subject} ${input.bodyText.slice(0, 300)}`);

  let best: { caseId: string; score: number } | null = null;
  for (const candidate of candidates) {
    const candidateTokens = tokenize(`${candidate.title} ${candidate.summary ?? ""}`);
    const score = jaccard(queryTokens, candidateTokens);
    if (score > 0 && (!best || score > best.score)) {
      best = { caseId: candidate.caseId, score };
    }
  }
  if (!best) return null;

  return { caseId: best.caseId, confidence: Math.min(0.6, best.score), level: "semantic_similarity" as const };
}
