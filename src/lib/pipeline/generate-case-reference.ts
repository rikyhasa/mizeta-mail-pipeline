import type { Prisma } from "@/generated/prisma/client";

/**
 * Genera il riferimento leggibile della pratica (es. PRT-2026-0001). Basato su conteggio
 * semplice, non concorrenza-safe: accettabile prima dell'introduzione di una coda reale
 * (Fase 4) — limitazione nota.
 */
export async function generateCaseReference(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const year = now.getFullYear();
  const count = await tx.case.count({ where: { reference: { startsWith: `PRT-${year}-` } } });
  return `PRT-${year}-${String(count + 1).padStart(4, "0")}`;
}
