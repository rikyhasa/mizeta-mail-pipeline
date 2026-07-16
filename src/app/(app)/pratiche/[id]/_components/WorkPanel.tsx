import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";

/**
 * Sostituisce Card/CardHeader per il dettaglio pratica (FASE 8B): stesse misure di `.box`
 * nella reference (.reference/mizeta-flow/src/app/globals.css) — niente ombra, padding 19px,
 * radius 12px — invece dei default di Card (ombra, padding 16px). Vedi classi `.detail-panel*`
 * in src/app/globals.css.
 */
export function WorkPanel({
  id,
  title,
  count,
  action,
  description,
  children,
}: {
  id?: string;
  title: ReactNode;
  count?: number;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div id={id} className={`detail-panel${id ? " scroll-mt-24" : ""}`}>
      <div className="detail-panel-head">
        <div>
          <h2 className="text-card-title flex items-center gap-2 font-semibold text-[var(--color-ink)]">
            {title}
            {count !== undefined && <Badge tone="neutral">{count}</Badge>}
          </h2>
          {description && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
