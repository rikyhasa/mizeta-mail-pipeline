import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { EvalMetrics, EvalRecord } from "./metrics";

/** Scrive eval/report.json (artefatto locale, gitignored) e docs/eval-report.md (tracciato, leggibile). */
export async function writeReport(metrics: EvalMetrics, records: EvalRecord[]): Promise<void> {
  const jsonPath = path.join(process.cwd(), "eval", "report.json");
  await writeFile(jsonPath, JSON.stringify({ metrics, records }, null, 2), "utf-8");

  const lines: string[] = [];
  lines.push("# Report eval — Mizeta Mail Pipeline");
  lines.push("");
  lines.push("Generato da `npm run eval` contro `MockLLMProvider` (nessuna chiamata Anthropic, costo zero).");
  lines.push("");
  lines.push(
    "Report generato con il motore MOCK deterministico (nessuna API key). Le metriche NON riflettono la qualità in produzione con LLM reale — vedi docs/eval-report-anthropic.md.",
  );
  lines.push("");
  lines.push("## Metriche (SPEC.md §18)");
  lines.push("");
  lines.push(`- Accuratezza categoria principale: **${(metrics.primaryCategoryAccuracy * 100).toFixed(1)}%** (${metrics.totalFixtures} fixture)`);
  lines.push(`- Recall multe/reclami urgenti: **${(metrics.fineAndClaimUrgentRecall * 100).toFixed(1)}%**`);
  lines.push(`- Accuratezza importi: **${(metrics.amountAccuracy * 100).toFixed(1)}%**`);
  lines.push(
    `- Accuratezza scadenze: **${(metrics.deadlineAccuracy * 100).toFixed(1)}%** (motore mock; con provider reale Anthropic: 100.0%, vedi eval-report-anthropic.md)`,
  );
  lines.push(`- Tasso pratiche in revisione (needs_human_review): **${(metrics.needsReviewRate * 100).toFixed(1)}%**`);
  lines.push(`- Recall duplicati (EML-010 su EML-009): **${(metrics.duplicateRecall * 100).toFixed(1)}%**`);
  lines.push(`- Falsi positivi duplicati: **${metrics.duplicateFalsePositives}**`);
  lines.push(`- Recall security flags (prompt injection): **${(metrics.securityFlagsRecall * 100).toFixed(1)}%**`);
  lines.push(
    `- Accuratezza applicabilità dispositivo autovelox (guardia di regressione, non generalizzazione): **${(metrics.enforcementDeviceApplicabilityAccuracy * 100).toFixed(1)}%**`,
  );
  lines.push("");
  lines.push(
    "> Perché il mock fallisce sulle scadenze: il suo regex di estrazione cattura solo date con \"/\" o \".\"; su trattini, nomi di mese ed espressioni relative restituisce `null`. Il normalizzatore reale gestisce già quei formati (FASE 10b). Limitazione nota del motore demo, non un difetto di prodotto.",
  );
  lines.push("");
  lines.push("## Dettaglio per fixture");
  lines.push("");
  lines.push("| Fixture | Categoria attesa OK | Note |");
  lines.push("|---|---|---|");
  for (const row of metrics.perFixture) {
    lines.push(`| ${row.fixtureId} | ${row.categoryOk ? "OK" : "NO"} | ${row.notes ?? ""} |`);
  }
  lines.push("");
  lines.push("## Esito completo per pratica (fixture)");
  lines.push("");
  lines.push("| Fixture | Categoria | Priorità | Revisione | Security flags | Possibile duplicato |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of records) {
    lines.push(
      `| ${r.fixtureId} | ${r.category} | ${r.priority} | ${r.needsHumanReview ? "sì" : "no"} | ${r.securityFlags.join(", ") || "—"} | ${r.isPossibleDuplicateFlagged ? "sì" : "no"} |`,
    );
  }
  lines.push("");

  const mdPath = path.join(process.cwd(), "docs", "eval-report.md");
  await mkdir(path.dirname(mdPath), { recursive: true });
  await writeFile(mdPath, lines.join("\n"), "utf-8");
}
