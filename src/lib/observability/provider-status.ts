import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { formatTime } from "@/lib/format";

export type ProviderStatusTone = "mock" | "connected" | "attention" | "unavailable";

export interface ProviderStatusSummary {
  tone: ProviderStatusTone;
  label: string;
}

/**
 * Stato aggregato del provider email, mostrato nella topbar a tutti i ruoli
 * autenticati (decisione Fase 8, docs/UI-PORTING-PLAN.md). Legge solo
 * stato/ultima sincronizzazione delle mailbox: mai costi, job o dettaglio
 * per-mailbox, che restano riservati a `getObservabilitySnapshot()`
 * (src/lib/observability/metrics.ts, gated `settings:manage`).
 */
export async function getProviderStatusSummary(): Promise<ProviderStatusSummary> {
  const isMockMode = env.EMAIL_PROVIDER === "mock" && env.LLM_PROVIDER === "mock";

  const mailboxes = await prisma.mailboxConnection.findMany({
    select: { status: true, lastSyncAt: true },
  });

  if (mailboxes.length === 0) {
    return { tone: "unavailable", label: "Non ancora disponibile" };
  }

  const mostRecentSync = mailboxes.reduce<Date | null>((latest, mailbox) => {
    if (!mailbox.lastSyncAt) return latest;
    if (!latest || mailbox.lastSyncAt > latest) return mailbox.lastSyncAt;
    return latest;
  }, null);

  if (isMockMode) {
    return {
      tone: "mock",
      label: mostRecentSync ? `Modalità mock · sincronizzato alle ${formatTime(mostRecentSync)}` : "Modalità mock",
    };
  }

  const hasConnected = mailboxes.some((m) => m.status === "CONNECTED" && m.lastSyncAt);
  if (hasConnected && mostRecentSync) {
    return { tone: "connected", label: `Connesso · sincronizzato alle ${formatTime(mostRecentSync)}` };
  }

  return { tone: "attention", label: "Nessuna sincronizzazione recente" };
}
