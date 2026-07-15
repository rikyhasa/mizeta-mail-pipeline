import { describe, expect, it } from "vitest";
import { PecImapProviderAdapter } from "@/lib/adapters/mail/pec-imap/pec-imap-provider";

/** Scheletro documentato, non funzionante (SPEC.md §3) — stesso pattern di OpenAILLMProvider:
 * ogni metodo lancia, tranne healthCheck che degrada senza mai lanciare. */
describe("PecImapProviderAdapter — scheletro documentato", () => {
  const adapter = new PecImapProviderAdapter();

  it("connectAccount lancia", async () => {
    await expect(adapter.connectAccount({ emailAddress: "pec@mizeta.legalmail.it", displayName: "PEC" })).rejects.toThrow();
  });

  it("disconnectAccount lancia", async () => {
    await expect(adapter.disconnectAccount("pec")).rejects.toThrow();
  });

  it("renewSubscription lancia", async () => {
    await expect(adapter.renewSubscription("pec")).rejects.toThrow();
  });

  it("fetchMessage lancia", async () => {
    await expect(adapter.fetchMessage("pec", "msg-1")).rejects.toThrow();
  });

  it("fetchThread lancia", async () => {
    await expect(adapter.fetchThread("pec", "thread-1")).rejects.toThrow();
  });

  it("fetchAttachment lancia", async () => {
    await expect(adapter.fetchAttachment("pec", "msg-1", "att-1")).rejects.toThrow();
  });

  it("listChanges lancia", async () => {
    await expect(adapter.listChanges("pec", null)).rejects.toThrow();
  });

  it("markProcessingResult lancia", async () => {
    await expect(adapter.markProcessingResult("pec", "msg-1", { ok: true })).rejects.toThrow();
  });

  it("healthCheck NON lancia: degrada sempre", async () => {
    const health = await adapter.healthCheck("pec");
    expect(health.status).toBe("degraded");
  });
});
