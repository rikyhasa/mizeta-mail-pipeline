import type { Job } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { ingestMailboxChanges } from "@/lib/mail/ingest-mailbox";
import { processIncomingMessage } from "@/lib/pipeline/process-incoming-message";
import { getCachedMailProvider } from "@/lib/adapters/mail/mail-provider-factory";
import { logger } from "@/lib/observability/logger";
import { enqueueJob } from "@/lib/jobs/queue";
import {
  ingestMailboxChangesIdempotencyKey,
  renewSubscriptionIdempotencyKey,
  syncSpeedDeviceRegistryIdempotencyKey,
  type IngestMailboxChangesPayload,
  type ProcessIncomingMessagePayload,
  type RenewSubscriptionPayload,
} from "@/lib/jobs/types";
import { runScheduledSpeedRegistrySync } from "@/lib/speed-registry/sync-speed-device-registry";
import { rematchDevicesForSnapshot } from "@/lib/speed-registry/apply-registry-match";

/**
 * Claim transazionale del prossimo job pronto: `SELECT ... FOR UPDATE SKIP LOCKED` è l'unica
 * eccezione deliberata a "niente SQL raw" nel resto del repo — Prisma non espone questo
 * costrutto tramite il query builder. Il lock è tenuto dentro la stessa transazione della UPDATE
 * successiva, quindi due worker concorrenti non possono mai reclamare lo stesso job.
 */
async function claimNextJob(): Promise<Job | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Job"
      WHERE status = 'PENDING' AND "nextRunAt" <= now()
      ORDER BY "nextRunAt" ASC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return null;
    return tx.job.update({
      where: { id: rows[0].id },
      data: { status: "RUNNING", lockedAt: new Date(), attempts: { increment: 1 } },
    });
  });
}

function backoffMs(attempts: number): number {
  return env.JOB_BACKOFF_BASE_MS * 2 ** (attempts - 1);
}

async function dispatch(job: Job): Promise<void> {
  switch (job.type) {
    case "INGEST_MAILBOX_CHANGES": {
      const { mailboxConnectionId } = job.payload as unknown as IngestMailboxChangesPayload;
      await ingestMailboxChanges(mailboxConnectionId);
      return;
    }
    case "PROCESS_INCOMING_MESSAGE": {
      const { emailMessageId } = job.payload as unknown as ProcessIncomingMessagePayload;
      await processIncomingMessage(emailMessageId);
      return;
    }
    case "RENEW_SUBSCRIPTION": {
      const { mailboxConnectionId } = job.payload as unknown as RenewSubscriptionPayload;
      const mailbox = await prisma.mailboxConnection.findUniqueOrThrow({ where: { id: mailboxConnectionId } });
      if (!mailbox.externalAccountId) {
        throw new Error(`MailboxConnection ${mailboxConnectionId} non ha un externalAccountId: impossibile rinnovare.`);
      }
      const adapter = getCachedMailProvider();
      const { expiresAt } = await adapter.renewSubscription(mailbox.externalAccountId);
      await prisma.mailboxConnection.update({
        where: { id: mailboxConnectionId },
        data: { subscriptionExpiresAt: expiresAt },
      });
      return;
    }
    case "SYNC_SPEED_DEVICE_REGISTRY": {
      const result = await runScheduledSpeedRegistrySync();
      // Un dispositivo può passare da "non trovato" a "corrisponde" (o viceversa) fra due sync,
      // senza che l'operatore riapra la pratica (docs/SPEC-AUTOVELOX-DRAFT.md §7bis) — solo su
      // uno snapshot realmente nuovo, mai su "nessuna modifica".
      if (result.snapshotId) {
        await rematchDevicesForSnapshot(result.snapshotId, null);
      }
      return;
    }
    default: {
      const exhaustiveCheck: never = job.type;
      throw new Error(`JobType non riconosciuto: ${String(exhaustiveCheck)}`);
    }
  }
}

const RECURRING_JOB_TYPES = new Set<Job["type"]>(["SYNC_SPEED_DEVICE_REGISTRY"]);
const SPEED_REGISTRY_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Auto-rischedulazione (docs/SPEC-AUTOVELOX-DRAFT.md §7bis): non esiste un cron interno, quindi
 * un job "ricorrente" si riaccoda da solo al proprio completamento (successo o esaurimento
 * tentativi), riusando il dedup su `idempotencyKey` già presente in `enqueueJob` — mai una nuova
 * libreria di scheduling. Non riaccoda dopo un fallimento transitorio: quello è già gestito dal
 * backoff di `markFailed`, riaccodare anche lì romperebbe il backoff.
 */
async function rescheduleIfRecurring(job: Job): Promise<void> {
  if (!RECURRING_JOB_TYPES.has(job.type)) return;
  await enqueueJob({
    type: "SYNC_SPEED_DEVICE_REGISTRY",
    payload: {},
    idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey(),
    runAt: new Date(Date.now() + SPEED_REGISTRY_SYNC_INTERVAL_MS),
  });
}

async function markSucceeded(job: Job): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: job.id }, data: { status: "SUCCEEDED", lockedAt: null, lastError: null } });
    await tx.jobAttempt.create({
      data: { jobId: job.id, attemptNumber: job.attempts, finishedAt: new Date(), status: "SUCCEEDED" },
    });
  });
}

async function markFailed(job: Job, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isDead = job.attempts >= job.maxAttempts;

  await prisma.$transaction(async (tx) => {
    await tx.jobAttempt.create({
      data: { jobId: job.id, attemptNumber: job.attempts, finishedAt: new Date(), status: "FAILED", error: errorMessage },
    });

    if (isDead) {
      await tx.job.update({ where: { id: job.id }, data: { status: "DEAD_LETTER", lockedAt: null, lastError: errorMessage } });
      await writeAuditLog(tx, {
        action: "JOB_DEAD_LETTERED",
        entityType: "Job",
        entityId: job.id,
        metadata: { jobType: job.type, attempts: job.attempts, lastError: errorMessage },
      });
      return;
    }

    await tx.job.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        lockedAt: null,
        lastError: errorMessage,
        nextRunAt: new Date(Date.now() + backoffMs(job.attempts)),
      },
    });
  });
}

/** Esegue al massimo un job: reclama, esegue FUORI da transazione (mai tenere aperta una
 * transazione Postgres durante una chiamata di rete — stessa regola di
 * `process-incoming-message.ts`), poi registra l'esito. */
export async function runWorkerOnce(): Promise<{ claimed: boolean; jobId?: string }> {
  const job = await claimNextJob();
  if (!job) return { claimed: false };

  try {
    await dispatch(job);
    await markSucceeded(job);
    logger.info("job.succeeded", { jobId: job.id, jobType: job.type, attempts: job.attempts });
    await rescheduleIfRecurring(job);
  } catch (error) {
    await markFailed(job, error);
    logger.error("job.failed", {
      jobId: job.id,
      jobType: job.type,
      attempts: job.attempts,
      error: error instanceof Error ? error.message : String(error),
    });
    if (job.attempts >= job.maxAttempts) await rescheduleIfRecurring(job);
  }
  return { claimed: true, jobId: job.id };
}

/** Tick periodico di recovery (SPEC.md §3): accoda `RENEW_SUBSCRIPTION` per le mailbox
 * microsoft365 vicine a scadenza e `INGEST_MAILBOX_CHANGES` per ogni mailbox connessa
 * come safety net contro webhook persi. Mai per `pec_imap` (scheletro non funzionante).
 *
 * Anche il bootstrap di `SYNC_SPEED_DEVICE_REGISTRY` (docs/SPEC-AUTOVELOX-DRAFT.md §7bis) vive
 * qui: `enqueueJob` è già idempotente su `idempotencyKey` — se il job non è mai esistito lo crea
 * ed esegue subito; se è già PENDING/RUNNING con la sua schedulazione a 24h, no-op (non la
 * disturba); se per qualunque motivo si fosse fermato in stato terminale senza essersi
 * riaccodato da solo, questo tick lo riarma — stesso ruolo di safety net degli altri due job. */
export async function runRecoveryTick(): Promise<void> {
  const mailboxes = await prisma.mailboxConnection.findMany({ where: { status: "CONNECTED" } });
  const marginMs = env.MICROSOFT365_SUBSCRIPTION_RENEWAL_MARGIN_HOURS * 60 * 60 * 1000;

  await enqueueJob({
    type: "SYNC_SPEED_DEVICE_REGISTRY",
    payload: {},
    idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey(),
  });

  for (const mailbox of mailboxes) {
    if (mailbox.provider === "PEC_IMAP") continue;

    await enqueueJob({
      type: "INGEST_MAILBOX_CHANGES",
      payload: { mailboxConnectionId: mailbox.id },
      idempotencyKey: ingestMailboxChangesIdempotencyKey(mailbox.id),
    });

    if (
      mailbox.provider === "MICROSOFT365" &&
      (!mailbox.subscriptionExpiresAt || mailbox.subscriptionExpiresAt.getTime() - Date.now() < marginMs)
    ) {
      await enqueueJob({
        type: "RENEW_SUBSCRIPTION",
        payload: { mailboxConnectionId: mailbox.id },
        idempotencyKey: renewSubscriptionIdempotencyKey(mailbox.id),
      });
    }
  }
}
