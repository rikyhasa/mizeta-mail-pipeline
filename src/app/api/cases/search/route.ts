import { authErrorResponse, requireUser } from "@/lib/auth/guard";
import { getFilteredCases } from "@/lib/dashboard/queries";

const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;

/** Ricerca globale della topbar (FASE 3, rifinitura finale): stessa query reale già usata da
 * `/pratiche` (`getFilteredCases`, campi titolo/riferimento/cliente/fornitore) — nessuna nuova
 * logica di ricerca, solo un'esposizione JSON per il dropdown live. Nessun risultato simulato:
 * query troppo corta o priva di corrispondenze restituisce un array vuoto, mai dati inventati. */
export async function GET(request: Request) {
  try {
    await requireUser();
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) {
    return Response.json({ items: [], total: 0 });
  }

  const { items, total } = await getFilteredCases({ q });

  return Response.json({
    total,
    items: items.slice(0, MAX_RESULTS).map((c) => ({
      id: c.id,
      reference: c.reference,
      title: c.title,
      category: c.category,
      customerOrSupplierName: c.customerOrSupplierName,
    })),
  });
}
