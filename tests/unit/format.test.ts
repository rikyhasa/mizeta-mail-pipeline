import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("formatDate", () => {
  it("formats dates as dd/mm/yyyy in the Europe/Rome timezone", () => {
    expect(formatDate("2026-07-14T10:00:00Z")).toBe("14/07/2026");
  });

  it("returns a placeholder for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatCurrency", () => {
  it("formats amounts in EUR with it-IT separators", () => {
    expect(formatCurrency(12345.67)).toMatch(/^12\.345,67\s€$/);
  });

  it("accepts numeric strings (as returned by Prisma Decimal fields)", () => {
    expect(formatCurrency("1200.00")).toMatch(/^1200,00\s€$/);
  });

  it("returns a placeholder for missing amounts", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});
