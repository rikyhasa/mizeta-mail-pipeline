import { describe, expect, it } from "vitest";
import { calculateAppealDeadlines, calculateAppealDueDate } from "@/lib/appeal-indicator/deadlines";

describe("calculateAppealDeadlines", () => {
  it("returns null for both terms when notificationDate is missing", () => {
    const result = calculateAppealDeadlines(null, new Date("2026-07-17T00:00:00.000Z"));
    expect(result).toEqual({ daysRemainingGdp: null, daysRemainingPrefetto: null });
  });

  it("computes 30gg (Giudice di Pace) and 60gg (Prefetto) from notification_date", () => {
    const notificationDate = new Date("2026-07-01T00:00:00.000Z");
    const now = new Date("2026-07-01T00:00:00.000Z");
    const result = calculateAppealDeadlines(notificationDate, now);
    expect(result.daysRemainingGdp).toBe(30);
    expect(result.daysRemainingPrefetto).toBe(60);
  });

  it("returns negative days once a term has expired", () => {
    const notificationDate = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-07-17T00:00:00.000Z");
    const result = calculateAppealDeadlines(notificationDate, now);
    expect(result.daysRemainingGdp).toBeLessThan(0);
    expect(result.daysRemainingPrefetto).toBeLessThan(0);
  });

  it("è deterministica rispetto a 'now' esplicito, nessuna dipendenza da Date.now()", () => {
    const notificationDate = new Date("2026-07-01T00:00:00.000Z");
    const now = new Date("2026-07-10T00:00:00.000Z");
    const first = calculateAppealDeadlines(notificationDate, now);
    const second = calculateAppealDeadlines(notificationDate, now);
    expect(first).toEqual(second);
  });
});

describe("calculateAppealDueDate (FASE 12, Bug 4)", () => {
  it("restituisce null senza notification_date", () => {
    expect(calculateAppealDueDate(null)).toBeNull();
  });

  it("restituisce notification_date + 30gg (termine Giudice di Pace, il più vicino dei due)", () => {
    const notificationDate = new Date("2026-07-01T00:00:00.000Z");
    expect(calculateAppealDueDate(notificationDate)).toEqual(new Date("2026-07-31T00:00:00.000Z"));
  });
});
