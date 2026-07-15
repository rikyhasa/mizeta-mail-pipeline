import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/rbac";

describe("rbac", () => {
  it("grants READ_ONLY only read access", () => {
    expect(hasPermission("READ_ONLY", "case:read")).toBe(true);
    expect(hasPermission("READ_ONLY", "case:write")).toBe(false);
    expect(hasPermission("READ_ONLY", "user:manage")).toBe(false);
    expect(hasPermission("READ_ONLY", "settings:manage")).toBe(false);
  });

  it("grants ADMIN every permission", () => {
    expect(hasPermission("ADMIN", "case:read")).toBe(true);
    expect(hasPermission("ADMIN", "case:write")).toBe(true);
    expect(hasPermission("ADMIN", "user:manage")).toBe(true);
    expect(hasPermission("ADMIN", "settings:manage")).toBe(true);
  });

  it("grants OPERATIONS, ACCOUNTING and COMMERCIAL read+write but not user/settings management", () => {
    for (const role of ["OPERATIONS", "ACCOUNTING", "COMMERCIAL"] as const) {
      expect(hasPermission(role, "case:read")).toBe(true);
      expect(hasPermission(role, "case:write")).toBe(true);
      expect(hasPermission(role, "user:manage")).toBe(false);
      expect(hasPermission(role, "settings:manage")).toBe(false);
    }
  });
});
