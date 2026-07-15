import "dotenv/config";
import { MockLLMProvider } from "@/lib/adapters/llm/mock-llm-provider";
import { EVAL_DATASET } from "./dataset";
import { computeMetrics } from "./metrics";
import { runEvalWithProvider } from "./run-pipeline-eval";
import { writeReport } from "./report-writer";

/**
 * `npm run eval` (SPEC.md §18): istanzia esplicitamente MockLLMProvider — mai
 * `getLLMProvider()`/`env.LLM_PROVIDER`, mai Postgres. Costo zero, sempre deterministico.
 */
async function main() {
  const records = await runEvalWithProvider(new MockLLMProvider());
  const metrics = computeMetrics(records, EVAL_DATASET);
  await writeReport(metrics, records);

  console.log(`Categoria principale — accuratezza: ${(metrics.primaryCategoryAccuracy * 100).toFixed(1)}%`);
  console.log(`Recall multe/reclami urgenti: ${(metrics.fineAndClaimUrgentRecall * 100).toFixed(1)}%`);
  console.log(`Accuratezza importi: ${(metrics.amountAccuracy * 100).toFixed(1)}%`);
  console.log(`Accuratezza scadenze: ${(metrics.deadlineAccuracy * 100).toFixed(1)}%`);
  console.log(`Tasso pratiche in revisione: ${(metrics.needsReviewRate * 100).toFixed(1)}%`);
  console.log(`Recall duplicati: ${(metrics.duplicateRecall * 100).toFixed(1)}%`);
  console.log(`Falsi positivi duplicati: ${metrics.duplicateFalsePositives}`);
  console.log(`Recall security flags: ${(metrics.securityFlagsRecall * 100).toFixed(1)}%`);
  console.log(`\nReport completo: docs/eval-report.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
