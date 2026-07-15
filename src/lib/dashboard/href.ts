/**
 * Costruisce l'URL della dashboard pratiche applicando modifiche puntuali ai parametri
 * di ricerca correnti. `null` in `changes` rimuove il parametro; la paginazione si
 * azzera sempre perché ogni modifica ai filtri cambia l'insieme dei risultati.
 */
export function buildPraticheHref(
  sp: Record<string, string | undefined>,
  changes: Record<string, string | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined || value === "" || key in changes) continue;
    params.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value !== null) params.set(key, value);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `/pratiche?${qs}` : "/pratiche";
}
