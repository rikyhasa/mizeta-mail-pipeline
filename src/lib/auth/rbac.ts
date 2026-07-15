import type { Role } from "@/generated/prisma/enums";

export type Permission = "case:read" | "case:write" | "user:manage" | "settings:manage";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ["case:read", "case:write", "user:manage", "settings:manage"],
  OPERATIONS: ["case:read", "case:write"],
  ACCOUNTING: ["case:read", "case:write"],
  COMMERCIAL: ["case:read", "case:write"],
  READ_ONLY: ["case:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
