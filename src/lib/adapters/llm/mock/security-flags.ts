/**
 * Rilevamento pattern di prompt-injection (SPEC.md §13, CLAUDE.md invariante 1). Puro
 * pattern-matching su stringa: nessuna azione viene mai eseguita, il testo resta sempre e solo
 * dato da analizzare. Usato dal motore euristico mock; il provider Anthropic reale si affida
 * invece alla mitigazione strutturale "nessun tools[] passato mai" più il testo §13 nel prompt.
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignora\s+(tutte\s+)?le\s+istruzioni/i,
  /senza\s+restrizioni/i,
  /invia\s+(questo|i\s+dati|l['’]elenco).{0,40}\s+a\b/i,
  /senza\s+chiedere\s+conferma/i,
  /senza\s+informare\s+l['’]utente/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+an?\s+/i,
  /send\s+(this|the)\s+(data|list)\s+to\b/i,
  /without\s+asking\s+for\s+confirmation/i,
  /esegui\s+questa\s+azione/i,
];

const SUSPICIOUS_TARGET_PATTERNS: RegExp[] = [/raccolta-dati@/i, /@suspicious-sender\./i];

export function detectSecurityFlags(text: string): string[] {
  const flags: string[] = [];
  if (PROMPT_INJECTION_PATTERNS.some((re) => re.test(text))) {
    flags.push("prompt_injection_detected");
  }
  if (SUSPICIOUS_TARGET_PATTERNS.some((re) => re.test(text))) {
    flags.push("suspicious_exfiltration_target");
  }
  return flags;
}
