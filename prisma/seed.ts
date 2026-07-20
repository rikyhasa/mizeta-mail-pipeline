import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { MockMailProviderAdapter } from "../src/lib/adapters/mail/mock-mail-provider";
import { ingestRawMessage } from "../src/lib/mail/ingest-mailbox";
import { extractMessageAttachments } from "../src/lib/attachments/extract-message-attachments";
import { env } from "../src/lib/config/env";
import { SEED_EMAILS } from "./seed-data/emails";
import { enrichCasesWithPipelineArtifacts } from "./seed-enrich";
import type { MailProviderType, Role } from "../src/generated/prisma/enums";

function uniq(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

async function seedUsers() {
  const roleUsers: { email: string; name: string; role: Role }[] = [
    { email: "admin@mizeta.local", name: "Amministratore Demo", role: "ADMIN" },
    { email: "operations@mizeta.local", name: "Operativo Demo", role: "OPERATIONS" },
    { email: "accounting@mizeta.local", name: "Contabilità Demo", role: "ACCOUNTING" },
    { email: "commercial@mizeta.local", name: "Commerciale Demo", role: "COMMERCIAL" },
    { email: "readonly@mizeta.local", name: "Sola Lettura Demo", role: "READ_ONLY" },
  ];

  const passwordHash = await hashPassword(env.SEED_DEMO_PASSWORD);
  const usersByRole = new Map<Role, { id: string }>();

  for (const seedUser of roleUsers) {
    const user = await prisma.user.create({
      data: { email: seedUser.email, name: seedUser.name, role: seedUser.role, passwordHash },
    });
    usersByRole.set(seedUser.role, user);
  }

  return usersByRole;
}

async function seedCustomersAndSuppliers() {
  const customerNames = uniq(SEED_EMAILS.map((f) => f.customerName));
  const supplierNames = uniq(SEED_EMAILS.map((f) => f.supplierName));

  const customerIds = new Map<string, string>();
  for (const name of customerNames) {
    const customer = await prisma.customer.create({ data: { name } });
    customerIds.set(name, customer.id);
  }

  const supplierIds = new Map<string, string>();
  for (const name of supplierNames) {
    const supplier = await prisma.supplier.create({ data: { name } });
    supplierIds.set(name, supplier.id);
  }

  return { customerIds, supplierIds };
}

async function seedVehiclesAndDrivers() {
  await prisma.vehicle.createMany({
    data: [
      { plate: "AB123CD", type: "Bilico" },
      { plate: "EF456GH", type: "Furgone" },
    ],
  });
  await prisma.driver.createMany({
    data: [{ name: "Mario Bianchi" }, { name: "Luca Verdi" }],
  });
}

interface SeedMailboxParams {
  mailboxKey: "info" | "pec";
  provider: MailProviderType;
  emailAddress: string;
  displayName: string;
  isPec: boolean;
  adapter: MockMailProviderAdapter;
  adminUserId: string;
  caseMap: Map<string, string>;
  customerIds: Map<string, string>;
  supplierIds: Map<string, string>;
  referenceCounter: { n: number };
}

async function seedMailbox(params: SeedMailboxParams) {
  const {
    mailboxKey,
    provider,
    emailAddress,
    displayName,
    isPec,
    adapter,
    adminUserId,
    caseMap,
    customerIds,
    supplierIds,
    referenceCounter,
  } = params;

  const { externalAccountId } = await adapter.connectAccount({
    emailAddress,
    displayName,
    isPec,
  });

  const mailbox = await prisma.mailboxConnection.create({
    data: {
      provider,
      displayName,
      emailAddress,
      status: "CONNECTED",
      isPec,
      externalAccountId,
      createdById: adminUserId,
      lastSyncAt: new Date(),
    },
  });

  const { changes } = await adapter.listChanges(externalAccountId, null);

  for (const change of changes) {
    const fixture = SEED_EMAILS.find(
      (f) => f.id === change.providerMessageId && f.mailbox === mailboxKey,
    );
    if (!fixture) {
      throw new Error(`Seed data error: fixture not found for ${mailboxKey}/${change.providerMessageId}`);
    }

    const raw = await adapter.fetchMessage(externalAccountId, change.providerMessageId);

    let caseId: string;
    if (fixture.isPecReceiptForCaseKey) {
      const existingCaseId = caseMap.get(fixture.isPecReceiptForCaseKey);
      if (!existingCaseId) {
        throw new Error(
          `Seed data error: receipt ${fixture.id} references unknown case ${fixture.isPecReceiptForCaseKey}`,
        );
      }
      caseId = existingCaseId;
    } else if (caseMap.has(fixture.caseKey)) {
      caseId = caseMap.get(fixture.caseKey)!;
    } else {
      referenceCounter.n += 1;
      const reference = `PRT-2026-${String(referenceCounter.n).padStart(4, "0")}`;
      const created = await prisma.case.create({
        data: {
          reference,
          title: fixture.subject,
          category: fixture.category,
          secondaryCategories: fixture.secondaryCategories ?? [],
          status: fixture.status ?? (fixture.needsHumanReview ? "NEEDS_REVIEW" : "NEW"),
          priority: fixture.priority,
          isPec: fixture.isPec,
          needsHumanReview: fixture.needsHumanReview ?? false,
          customerId: fixture.customerName ? customerIds.get(fixture.customerName) : undefined,
          supplierId: fixture.supplierName ? supplierIds.get(fixture.supplierName) : undefined,
        },
      });
      caseId = created.id;
      caseMap.set(fixture.caseKey, caseId);
    }

    const { emailMessageId, hasAttachments } = await ingestRawMessage({
      mailboxConnectionId: mailbox.id,
      raw,
      caseId,
      storageKeyPrefix: "seed",
    });
    // Nessun worker di job gira durante il seed (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md):
    // l'estrazione allegati va eseguita subito in-process, PRIMA di
    // enrichCasesWithPipelineArtifacts più sotto, esattamente come farebbe EXTRACT_ATTACHMENTS
    // prima di PROCESS_INCOMING_MESSAGE nella pipeline reale.
    if (hasAttachments) await extractMessageAttachments(emailMessageId);

    await adapter.markProcessingResult(externalAccountId, change.providerMessageId, { ok: true });
  }

  const health = await adapter.healthCheck(externalAccountId);
  await prisma.mailboxConnection.update({
    where: { id: mailbox.id },
    data: { lastHealthCheckAt: health.checkedAt, lastHealthStatus: health.status },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: "EMAIL_SYNCED",
      entityType: "MailboxConnection",
      entityId: mailbox.id,
      metadata: { mailbox: mailboxKey, messagesProcessed: changes.length },
    },
  });

  return changes.length;
}

async function main() {
  console.log("Seeding Mizeta Mail Pipeline demo data...");

  const usersByRole = await seedUsers();
  const adminUser = usersByRole.get("ADMIN");
  if (!adminUser) throw new Error("Seed error: admin user not created");

  const { customerIds, supplierIds } = await seedCustomersAndSuppliers();
  await seedVehiclesAndDrivers();

  const adapter = new MockMailProviderAdapter();
  const caseMap = new Map<string, string>();
  const referenceCounter = { n: 0 };

  const infoCount = await seedMailbox({
    mailboxKey: "info",
    provider: "MICROSOFT365",
    emailAddress: "info@mizeta.it",
    displayName: "Mizeta - Posta Generale",
    isPec: false,
    adapter,
    adminUserId: adminUser.id,
    caseMap,
    customerIds,
    supplierIds,
    referenceCounter,
  });

  const pecCount = await seedMailbox({
    mailboxKey: "pec",
    provider: "PEC_IMAP",
    emailAddress: "pec@mizeta.legalmail.it",
    displayName: "Mizeta - PEC",
    isPec: true,
    adapter,
    adminUserId: adminUser.id,
    caseMap,
    customerIds,
    supplierIds,
    referenceCounter,
  });

  console.log(
    `Seed completato: ${infoCount + pecCount} email (${infoCount} info, ${pecCount} PEC), ${caseMap.size} pratiche, ${usersByRole.size} utenti.`,
  );

  console.log("Arricchimento con la pipeline AI reale (campi, scadenze, regole, bozze)...");
  await enrichCasesWithPipelineArtifacts(caseMap);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
