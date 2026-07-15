import { authErrorResponse, requirePermission } from "@/lib/auth/guard";
import type { Permission } from "@/lib/auth/rbac";

/**
 * Wrapper comune per i Route Handler che richiedono un permesso (SPEC.md §14, minimo
 * privilegio): converte `AuthError` in una risposta 401/403 coerente con `api/cases/route.ts`,
 * evitando di ripetere lo stesso try/catch in ogni route di azione sulla pratica.
 */
export async function withPermission(permission: Permission, handler: (user: Awaited<ReturnType<typeof requirePermission>>) => Promise<Response>): Promise<Response> {
  try {
    const user = await requirePermission(permission);
    return await handler(user);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
