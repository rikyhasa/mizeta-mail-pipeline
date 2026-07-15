"use client";

import { useState } from "react";
import { SplitView } from "@/components/ui/SplitView";
import { ReviewList } from "./ReviewList";
import { ReviewDetail } from "./ReviewDetail";
import type { QueueItem } from "./types";

/** Stato di selezione client-side: tutti gli elementi sono gia caricati dal server in
 * un'unica query, quindi cambiare selezione non richiede nuove chiamate di rete. */
export function ReviewQueueSplitView({ items }: { items: QueueItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <SplitView
      list={<ReviewList items={items} selectedId={selectedId} onSelect={setSelectedId} />}
      detail={<ReviewDetail item={selected} />}
    />
  );
}
