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
    expect(hasPermission("ADMIN", "enforcement:confirm")).toBe(true);
    expect(hasPermission("ADMIN", "enforcement:request-documents")).toBe(true);
    expect(hasPermission("ADMIN", "enforcement:legal-escalate")).toBe(true);
    expect(hasPermission("ADMIN", "enforcement:manage-registry-sync")).toBe(true);
  });

  it("grants OPERATIONS, ACCOUNTING and COMMERCIAL read+write but not user/settings management", () => {
    for (const role of ["OPERATIONS", "ACCOUNTING", "COMMERCIAL"] as const) {
      expect(hasPermission(role, "case:read")).toBe(true);
      expect(hasPermission(role, "case:write")).toBe(true);
      expect(hasPermission(role, "user:manage")).toBe(false);
      expect(hasPermission(role, "settings:manage")).toBe(false);
    }
  });

  it("grants OPERATIONS enforcement:confirm/request-documents but not legal-escalate/registry-sync (docs/SPEC.md §10bis)", () => {
    expect(hasPermission("OPERATIONS", "enforcement:confirm")).toBe(true);
    expect(hasPermission("OPERATIONS", "enforcement:request-documents")).toBe(true);
    expect(hasPermission("OPERATIONS", "enforcement:legal-escalate")).toBe(false);
    expect(hasPermission("OPERATIONS", "enforcement:manage-registry-sync")).toBe(false);
  });

  it("denies all enforcement permissions to ACCOUNTING, COMMERCIAL and READ_ONLY", () => {
    for (const role of ["ACCOUNTING", "COMMERCIAL", "READ_ONLY"] as const) {
      expect(hasPermission(role, "enforcement:confirm")).toBe(false);
      expect(hasPermission(role, "enforcement:request-documents")).toBe(false);
      expect(hasPermission(role, "enforcement:legal-escalate")).toBe(false);
      expect(hasPermission(role, "enforcement:manage-registry-sync")).toBe(false);
    }
  });
});
