import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";
import { prisma } from "../src/lib/db/prisma";
import { MockMailProviderAdapter } from "../src/lib/adapters/mail/mock-mail-provider";
import { ingestRawMessage } from "../src/lib/mail/ingest-mailbox";
import { processIncomingMessage } from "../src/lib/pipeline/process-incoming-message";
import { SEED_EMAILS } from "../prisma/seed-data/emails";
import { env } from "../src/lib/config/env";

/**
 * Dimostra la pipeline AI reale (Fase 2) end-to-end sui fixture del seed, SENZA la logica
 * naive di associazione email->pratica di prisma/seed.ts (che resta invariata). Richiede un DB
 * pulito: resetta lo schema come tests/global-setup.ts, poi applica le migrazioni. Script
 * manuale per sviluppatori — non fa parte di `npm test`/`npm run eval`.
 */
async function resetSchema() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

async function ingestMailbox(params: {
  mailboxKey: "info" | "pec";
  provider: "MICROSOFT365" | "PEC_IMAP";
  emailAddress: string;
  displayName: string;
  isPec: boolean;
  adapter: MockMailProviderAdapter;
}) {
  const { mailboxKey, provider, emailAddress, displayName, isPec, adapter } = params;

  const { externalAccountId } = await adapter.connectAccount({ emailAddress, displayName, isPec });
  const mailbox = await prisma.mailboxConnection.create({
    data: { provider, displayName, emailAddress, status: "CONNECTED", isPec, externalAccountId, lastSyncAt: new Date() },
  });

  const { changes } = await adapter.listChanges(externalAccountId, null);
  const messageIds: string[] = [];

  for (const change of changes) {
    const raw = await adapter.fetchMessage(externalAccountId, change.providerMessageId);
    const { emailMessageId } = await ingestRawMessage({
      mailboxConnectionId: mailbox.id,
      raw,
      storageKeyPrefix: "pipeline-demo",
    });
    await adapter.markProcessingResult(externalAccountId, change.providerMessageId, { ok: true });
    messageIds.push(emailMessageId);
    void mailboxKey;
  }

  return messageIds;
}

async function main() {
  console.log("Reset schema e migrazioni...");
  await resetSchema();

  const adapter = new MockMailProviderAdapter();
  const infoIds = await ingestMailbox({
    mailboxKey: "info",
    provider: "MICROSOFT365",
    emailAddress: "info@mizeta.it",
    displayName: "Mizeta - Posta Generale",
    isPec: false,
    adapter,
  });
  const pecIds = await ingestMailbox({
    mailboxKey: "pec",
    provider: "PEC_IMAP",
    emailAddress: "pec@mizeta.legalmail.it",
    displayName: "Mizeta - PEC",
    isPec: true,
    adapter,
  });

  console.log(`Ingerite ${infoIds.length + pecIds.length} email (${infoIds.length} info, ${pecIds.length} PEC). Eseguo la pipeline reale...`);

  const orderedIds = await prisma.emailMessage
    .findMany({ where: { id: { in: [...infoIds, ...pecIds] } }, orderBy: { receivedAt: "asc" }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

  for (const id of orderedIds) {
    await processIncomingMessage(id);
  }

  const cases = await prisma.case.findMany({ select: { id: true, reference: true, category: true, title: true, needsHumanReview: true } });
  const expectedCaseKeys = new Set(SEED_EMAILS.filter((f) => !f.isPecReceiptForCaseKey).map((f) => f.caseKey));

  console.log("\n--- Report pipeline-demo ---");
  console.log(`Pratiche create dalla pipeline reale: ${cases.length}`);
  console.log(`Pratiche attese (caseKey distinti nei fixture, escluse ricevute PEC): ${expectedCaseKeys.size}`);
  for (const c of cases) {
    console.log(`  ${c.reference} [${c.category}]${c.needsHumanReview ? " (revisione)" : ""} — ${c.title}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
