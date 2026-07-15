import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnthropicLLMProvider } from "../src/lib/adapters/llm/anthropic-llm-provider";
import { runEvalWithProvider } from "../eval/run-pipeline-eval";
import { computeMetrics, type EvalMetrics, type EvalRecord } from "../eval/metrics";
import { EVAL_DATASET } from "../eval/dataset";

/**
 * Confronto ad-hoc mock vs Anthropic reale sull'intero dataset di eval. NON fa parte di
 * `npm run eval` (che resta sempre mock, costo zero, SPEC.md §4) — richiede ANTHROPIC_API_KEY e
 * fa fino a ~80 chiamate reali a pagamento. Va eseguito manualmente:
 * `npx tsx scripts/anthropic-eval-compare.ts`.
 */
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY non impostata: imposta la variabile in .env locale prima di eseguire questo confronto.");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const mockReportPath = path.join(process.cwd(), "eval", "report.json");
  let mockRecords: EvalRecord[] = [];
  try {
    const raw = JSON.parse(await readFile(mockReportPath, "utf-8"));
    mockRecords = raw.records ?? [];
  } catch {
    console.warn(`Attenzione: ${mockReportPath} non trovato. Esegui prima 'npm run eval' per avere un confronto. Procedo comunque solo con Anthropic.`);
  }
  const mockByFixture = new Map(mockRecords.map((r) => [r.fixtureId, r]));

  const provider = new AnthropicLLMProvider({ apiKey, model });
  console.log(`Provider: anthropic, modello: ${model}`);
  console.log(`Esecuzione dell'intero dataset (${EVAL_DATASET.length} fixture, fino a ~3 chiamate reali ciascuna)...\n`);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  const errors: { fixtureId: string; message: string }[] = [];

  const anthropicRecords = await runEvalWithProvider(provider, {
    onFixtureDone: (fixtureId, index, total) => {
      process.stdout.write(`  [${index}/${total}] ${fixtureId} ok\n`);
    },
    onError: (fixtureId, error) => {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ fixtureId, message });
      process.stdout.write(`  ${fixtureId} FALLITA: ${message}\n`);
    },
    onResult: (_fixtureId, result) => {
      for (const usage of [result.classification.usage, result.extraction?.result.usage, result.actionProposal?.usage]) {
        if (!usage) continue;
        totalInputTokens += usage.inputTokens ?? 0;
        totalOutputTokens += usage.outputTokens ?? 0;
        totalCostUsd += usage.costUsd ?? 0;
      }
    },
  });

  const tuningDataset = EVAL_DATASET.filter((e) => !e.heldOut);
  const heldOutDataset = EVAL_DATASET.filter((e) => e.heldOut);

  const anthropicMetrics = computeMetrics(anthropicRecords, EVAL_DATASET);
  const anthropicMetricsTuning = computeMetrics(anthropicRecords, tuningDataset);
  const anthropicMetricsHeldOut = heldOutDataset.length > 0 ? computeMetrics(anthropicRecords, heldOutDataset) : null;
  const anthropicByFixture = new Map(anthropicRecords.map((r) => [r.fixtureId, r]));

  const mockMetrics = mockRecords.length > 0 ? computeMetrics(mockRecords, EVAL_DATASET) : null;
  const mockMetricsTuning = mockRecords.length > 0 ? computeMetrics(mockRecords, tuningDataset) : null;
  const mockMetricsHeldOut = mockRecords.length > 0 && heldOutDataset.length > 0 ? computeMetrics(mockRecords, heldOutDataset) : null;

  console.log(`\n=== Metriche a confronto — complessivo (${EVAL_DATASET.length} fixture) ===\n`);
  printMetricsComparison(mockMetrics, anthropicMetrics);
  console.log(`\n=== Solo tuning (${tuningDataset.length} fixture, usate durante l'iterazione) ===\n`);
  printMetricsComparison(mockMetricsTuning, anthropicMetricsTuning);
  if (anthropicMetricsHeldOut) {
    console.log(`\n=== Solo held-out (${heldOutDataset.length} fixture, mai ispezionate durante il tuning) ===\n`);
    printMetricsComparison(mockMetricsHeldOut, anthropicMetricsHeldOut);
  }

  console.log(`\nToken totali: ${totalInputTokens} input / ${totalOutputTokens} output`);
  console.log(`Costo totale reale: $${totalCostUsd.toFixed(4)}`);
  if (errors.length > 0) {
    console.log(`\n${errors.length} fixture fallite (saltate, non abortiscono il run):`);
    for (const e of errors) console.log(`  - ${e.fixtureId}: ${e.message}`);
  }

  const lines: string[] = [];
  lines.push("# Confronto eval — Mock vs Anthropic reale");
  lines.push("");
  lines.push(`Modello: \`${model}\`. Generato da \`scripts/anthropic-eval-compare.ts\` (NON riproducibile a costo zero).`);
  lines.push("");
  lines.push(`Token totali: ${totalInputTokens} input / ${totalOutputTokens} output — Costo reale: **$${totalCostUsd.toFixed(4)}**`);
  if (errors.length > 0) {
    lines.push("");
    lines.push(`⚠️ ${errors.length} fixture fallite e saltate: ${errors.map((e) => e.fixtureId).join(", ")}`);
  }
  lines.push("");
  pushMetricsSection(lines, `## Metriche — complessivo (${EVAL_DATASET.length} fixture)`, mockMetrics, anthropicMetrics);
  pushMetricsSection(
    lines,
    `## Metriche — solo tuning (${tuningDataset.length} fixture, usate durante l'iterazione)`,
    mockMetricsTuning,
    anthropicMetricsTuning,
  );
  if (anthropicMetricsHeldOut) {
    lines.push("");
    lines.push(
      `> Fixture held-out (${heldOutDataset.length}): ${heldOutDataset.map((e) => e.fixtureId).join(", ")} — mai ispezionate né usate per calibrare prompt/normalizzatore durante il tuning (docs/evaluation.md §2.4).`,
    );
    pushMetricsSection(lines, `## Metriche — solo held-out (${heldOutDataset.length} fixture)`, mockMetricsHeldOut, anthropicMetricsHeldOut);
  }
  lines.push("## Confronto per fixture");
  lines.push("");
  lines.push("| Fixture | Mock categoria/priorità | Anthropic categoria/priorità | Categoria concorde |");
  lines.push("|---|---|---|---|");
  for (const expectation of EVAL_DATASET) {
    const mock = mockByFixture.get(expectation.fixtureId);
    const anthropic = anthropicByFixture.get(expectation.fixtureId);
    const mockCell = mock ? `${mock.category} / ${mock.priority}` : "—";
    const anthropicCell = anthropic ? `${anthropic.category} / ${anthropic.priority}` : errors.some((e) => e.fixtureId === expectation.fixtureId) ? "ERRORE" : "—";
    const agree = mock && anthropic ? (mock.category === anthropic.category ? "sì" : "no") : "n/d";
    lines.push(`| ${expectation.fixtureId} | ${mockCell} | ${anthropicCell} | ${agree} |`);
  }
  lines.push("");

  const outPath = path.join(process.cwd(), "docs", "eval-report-anthropic.md");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join("\n"), "utf-8");
  console.log(`\nReport di confronto scritto in: docs/eval-report-anthropic.md`);
}

function metricsRow(label: string, mock: number | undefined, anthropic: number): string {
  const mockCell = mock === undefined ? "n/d" : `${(mock * 100).toFixed(1)}%`;
  return `| ${label} | ${mockCell} | ${(anthropic * 100).toFixed(1)}% |`;
}

function pushMetricsSection(lines: string[], title: string, mock: EvalMetrics | null, anthropic: EvalMetrics): void {
  lines.push(title);
  lines.push("");
  lines.push("| Metrica | Mock | Anthropic |");
  lines.push("|---|---|---|");
  lines.push(metricsRow("Accuratezza categoria", mock?.primaryCategoryAccuracy, anthropic.primaryCategoryAccuracy));
  lines.push(metricsRow("Recall multe/reclami urgenti", mock?.fineAndClaimUrgentRecall, anthropic.fineAndClaimUrgentRecall));
  lines.push(metricsRow("Accuratezza importi", mock?.amountAccuracy, anthropic.amountAccuracy));
  lines.push(metricsRow("Accuratezza scadenze", mock?.deadlineAccuracy, anthropic.deadlineAccuracy));
  lines.push(metricsRow("Tasso revisione", mock?.needsReviewRate, anthropic.needsReviewRate));
  lines.push(metricsRow("Recall duplicati", mock?.duplicateRecall, anthropic.duplicateRecall));
  lines.push(metricsRow("Recall security flags", mock?.securityFlagsRecall, anthropic.securityFlagsRecall));
  lines.push("");
}

function printMetricsComparison(mock: EvalMetrics | null, anthropic: EvalMetrics) {
  const rows: [string, number | undefined, number][] = [
    ["Accuratezza categoria", mock?.primaryCategoryAccuracy, anthropic.primaryCategoryAccuracy],
    ["Recall multe/reclami urgenti", mock?.fineAndClaimUrgentRecall, anthropic.fineAndClaimUrgentRecall],
    ["Accuratezza importi", mock?.amountAccuracy, anthropic.amountAccuracy],
    ["Accuratezza scadenze", mock?.deadlineAccuracy, anthropic.deadlineAccuracy],
    ["Tasso revisione", mock?.needsReviewRate, anthropic.needsReviewRate],
    ["Recall duplicati", mock?.duplicateRecall, anthropic.duplicateRecall],
    ["Recall security flags", mock?.securityFlagsRecall, anthropic.securityFlagsRecall],
  ];
  for (const [label, mockValue, anthropicValue] of rows) {
    const mockStr = mockValue === undefined ? "n/d" : `${(mockValue * 100).toFixed(1)}%`;
    console.log(`${label.padEnd(32)} mock: ${mockStr.padEnd(8)} anthropic: ${(anthropicValue * 100).toFixed(1)}%`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
