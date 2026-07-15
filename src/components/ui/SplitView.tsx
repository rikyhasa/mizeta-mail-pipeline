import type { ReactNode } from "react";

/**
 * Layout lista + dettaglio: colonna sinistra compatta e scrollabile, colonna destra
 * flessibile. Sotto il breakpoint `lg` degrada a colonna singola (prima la lista).
 */
export function SplitView({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem-2rem)] lg:overflow-y-auto">{list}</div>
      <div className="min-w-0">{detail}</div>
    </div>
  );
}
