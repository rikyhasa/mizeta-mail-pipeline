import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/rbac";
import type { Role } from "@/generated/prisma/enums";

export class AuthError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

/** For Route Handlers: throws AuthError, caught by the caller and mapped to a JSON response. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError(401, "Autenticazione richiesta");
  }
  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError(403, "Permessi insufficienti");
  }
  return user;
}

/** For Server Components/pages: redirects to /login instead of throwing. */
export async function requireUserOrRedirect() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** For Server Components/pages: redirect to /pratiche (not /login) when authenticated but under-privileged. */
export async function requireRoleOrRedirect(roles: Role[]) {
  const user = await requireUserOrRedirect();
  if (!roles.includes(user.role)) {
    redirect("/pratiche");
  }
  return user;
}

/** For Route Handlers: throws AuthError(403) if the user's role lacks the given permission (src/lib/auth/rbac.ts). */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new AuthError(403, "Permessi insufficienti");
  }
  return user;
}

export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
