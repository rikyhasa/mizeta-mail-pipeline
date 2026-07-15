import { describe, expect, it } from "vitest";
import { MockMailProviderAdapter } from "@/lib/adapters/mail/mock-mail-provider";

describe("MockMailProviderAdapter", () => {
  it("connectAccount returns the externalAccountId matching the mailbox type", async () => {
    const adapter = new MockMailProviderAdapter();
    const info = await adapter.connectAccount({ emailAddress: "info@mizeta.it", displayName: "Info", isPec: false });
    expect(info.externalAccountId).toBe("info");
    const pec = await adapter.connectAccount({
      emailAddress: "pec@mizeta.legalmail.it",
      displayName: "PEC",
      isPec: true,
    });
    expect(pec.externalAccountId).toBe("pec");
  });

  it("listChanges returns pending fixtures, then none once marked processed", async () => {
    const adapter = new MockMailProviderAdapter();
    const { changes: first } = await adapter.listChanges("pec", null);
    expect(first.length).toBeGreaterThan(0);
    for (const change of first) {
      await adapter.markProcessingResult("pec", change.providerMessageId, { ok: true });
    }
    const { changes: second } = await adapter.listChanges("pec", null);
    expect(second).toHaveLength(0);
  });

  it("does not mark a fixture processed when markProcessingResult reports failure", async () => {
    const adapter = new MockMailProviderAdapter();
    const { changes: before } = await adapter.listChanges("pec", null);
    await adapter.markProcessingResult("pec", before[0].providerMessageId, { ok: false, error: "boom" });
    const { changes: after } = await adapter.listChanges("pec", null);
    expect(after).toHaveLength(before.length);
  });

  it("fetchMessage returns the raw message for a known id", async () => {
    const adapter = new MockMailProviderAdapter();
    const message = await adapter.fetchMessage("info", "EML-001");
    expect(message.subject).toContain("Milano");
    expect(message.direction).toBe("INBOUND");
  });

  it("fetchMessage throws for an unknown id", async () => {
    const adapter = new MockMailProviderAdapter();
    await expect(adapter.fetchMessage("info", "EML-999")).rejects.toThrow();
  });

  it("fetchThread returns every message sharing the thread id", async () => {
    const adapter = new MockMailProviderAdapter();
    const messages = await adapter.fetchThread("info", "thread-003");
    expect(messages.length).toBe(2);
  });

  it("healthCheck reports ok", async () => {
    const adapter = new MockMailProviderAdapter();
    const health = await adapter.healthCheck("info");
    expect(health.status).toBe("ok");
  });
});
