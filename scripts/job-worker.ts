import "dotenv/config";
import { env } from "../src/lib/config/env";
import { runWorkerOnce, runRecoveryTick } from "../src/lib/jobs/worker";
import { logger } from "../src/lib/observability/logger";

/**
 * Processo worker separato per la coda job su Postgres (SPEC.md §3/§17). Deliberatamente NON
 * un `setInterval` dentro un modulo Next.js: l'hot-reload di sviluppo e i target
 * serverless-style rendono un timer in-process inaffidabile (può eseguire due volte o mai).
 * Avviare con `npm run jobs:worker`, in parallelo a `npm run dev` — vedi README.md.
 */
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  logger.info("job-worker.started", { pollIntervalMs: env.JOB_POLL_INTERVAL_MS, recoveryIntervalMinutes: env.JOB_RECOVERY_INTERVAL_MINUTES });

  let lastRecoveryTickAt = 0;
  const recoveryIntervalMs = env.JOB_RECOVERY_INTERVAL_MINUTES * 60 * 1000;

  for (;;) {
    const now = Date.now();
    if (now - lastRecoveryTickAt >= recoveryIntervalMs) {
      lastRecoveryTickAt = now;
      try {
        await runRecoveryTick();
      } catch (error) {
        logger.error("job-worker.recovery-tick-failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }

    const { claimed } = await runWorkerOnce();
    if (!claimed) await sleep(env.JOB_POLL_INTERVAL_MS);
  }
}

main().catch((error) => {
  logger.error("job-worker.fatal", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
