import { withPermission } from "@/lib/auth/route-helpers";
import { getObservabilitySnapshot } from "@/lib/observability/metrics";

/**
 * Dettaglio osservabilità (SPEC.md §17): coda job, subscription, costo/errori AI. Gated su
 * `settings:manage` (ADMIN) perché espone dettaglio di costo/errore — diverso da `/api/health`,
 * che resta liveness minimale e non autenticata.
 */
export async function GET() {
  return withPermission("settings:manage", async () => {
    const snapshot = await getObservabilitySnapshot();
    return Response.json(snapshot);
  });
}
