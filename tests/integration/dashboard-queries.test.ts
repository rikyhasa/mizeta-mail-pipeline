import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getAlerts, getFilteredCases, getKpis } from "@/lib/dashboard/queries";

describe("Dashboard queries (SPEC.md §9)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("getAlerts returns all seven bands with non-negative counts", async () => {
    const alerts = await getAlerts();
    expect(alerts).toHaveLength(7);
    const keys = alerts.map((a) => a.key);
    expect(keys).toEqual(["oggi", "overdue", "dueSoon", "quotesToRespond", "urgentClaims", "urgentFines", "needsReview"]);
    for (const alert of alerts) {
      expect(alert.count).toBeGreaterThanOrEqual(0);
      expect(alert.label.length).toBeGreaterThan(0);
    }
  });

  it("getKpis returns the six metrics of §9 with sane values", async () => {
    const kpis = await getKpis();
    expect(kpis.quotes.count).toBeGreaterThanOrEqual(0);
    expect(kpis.quotes.total).toBeGreaterThanOrEqual(0);
    expect(kpis.supplierInvoicesDueTotal).toBeGreaterThanOrEqual(0);
    expect(kpis.overdueReceivablesTotal).toBeGreaterThanOrEqual(0);
    expect(kpis.openClaims).toBeGreaterThanOrEqual(0);
    expect(kpis.openFines).toBeGreaterThanOrEqual(0);
    expect(kpis.lowConfidenceCount).toBeGreaterThanOrEqual(0);
  });

  it("getFilteredCases with no filters returns the seeded cases with the expected row shape", async () => {
    const { items, total } = await getFilteredCases({});
    expect(total).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(0);
    const first = items[0];
    expect(first).toHaveProperty("reference");
    expect(first).toHaveProperty("category");
    expect(first).toHaveProperty("priority");
    expect(first).toHaveProperty("status");
  });

  it("filters by category: every returned item matches", async () => {
    const { items } = await getFilteredCases({ category: "QUOTE_REQUEST" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.category === "QUOTE_REQUEST")).toBe(true);
  });

  it("quick filter 'needsReview' only returns cases flagged for human review", async () => {
    const { items } = await getFilteredCases({ quick: "needsReview" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.needsHumanReview)).toBe(true);
  });

  it("sorts by priority first (CRITICAL/HIGH before NORMAL/LOW)", async () => {
    const { items } = await getFilteredCases({});
    const priorityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    for (let i = 1; i < items.length; i += 1) {
      expect(priorityRank[items[i - 1].priority]).toBeLessThanOrEqual(priorityRank[items[i].priority]);
    }
  });
});
