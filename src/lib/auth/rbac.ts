import type { Role } from "@/generated/prisma/enums";

/**
 * Permessi del modulo autovelox (docs/SPEC.md §10bis, §9 di docs/SPEC-AUTOVELOX-DRAFT.md):
 * estensione di permessi granulari, non nuovi ruoli — OPERATIONS conferma/corregge dati e
 * richiede documentazione, solo ADMIN segnala per verifica legale e gestisce il fallback
 * manuale del registro MIT.
 */
export type Permission =
  | "case:read"
  | "case:write"
  | "user:manage"
  | "settings:manage"
  | "enforcement:confirm"
  | "enforcement:request-documents"
  | "enforcement:legal-escalate"
  | "enforcement:manage-registry-sync";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "case:read",
    "case:write",
    "user:manage",
    "settings:manage",
    "enforcement:confirm",
    "enforcement:request-documents",
    "enforcement:legal-escalate",
    "enforcement:manage-registry-sync",
  ],
  OPERATIONS: ["case:read", "case:write", "enforcement:confirm", "enforcement:request-documents"],
  ACCOUNTING: ["case:read", "case:write"],
  COMMERCIAL: ["case:read", "case:write"],
  READ_ONLY: ["case:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
