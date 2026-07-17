import { Mail, Paperclip } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge } from "@/components/ui/Badge";
import { Disclosure } from "@/components/ui/Disclosure";
import { formatDateTime } from "@/lib/format";

/** Sopra questa lunghezza un'email più vecchia della più recente va dietro "Mostra email
 * completa" (docs/UX-AUDIT-2026-07.md, punto 3.3.7) — non un troncamento visivo (line-clamp) ma
 * un riassunto testuale nel summary, per non duplicare il corpo intero due volte sulla pagina. */
const PREVIEW_THRESHOLD = 220;

function previewText(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  const cut = singleLine.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

interface AttachmentData {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isReadable: boolean;
}

interface MessageData {
  id: string;
  fromName: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  isPec: boolean;
  attachments: AttachmentData[];
}

/** Cronologia email con allegati annidati per messaggio, timeline a pallini connessi come la
 * reference (FASE 8B — stesso trattamento di AuditLogCard, .detail-timeline*). */
export function EmailTimelineCard({ messages }: { messages: MessageData[] }) {
  return (
    <WorkPanel id="email" title="Cronologia email" count={messages.length}>
      <div className="detail-timeline">
        {messages.map((m, index) => {
          const isLatest = index === messages.length - 1;
          const needsPreview = !isLatest && m.bodyText.length > PREVIEW_THRESHOLD;
          return (
            <div key={m.id} id={`msg-${m.id}`} className="detail-timeline-item">
              <div className="detail-timeline-dot">
                <Mail className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="detail-timeline-title">{m.subject}</span>
                  {m.isPec && <Badge tone="info">PEC</Badge>}
                </div>
                <div className="detail-timeline-copy">
                  {m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress} · {formatDateTime(m.receivedAt)}
                </div>
                {needsPreview ? (
                  <>
                    <p className="detail-timeline-copy mt-1">{previewText(m.bodyText, PREVIEW_THRESHOLD)}</p>
                    <Disclosure summary="Mostra email completa" className="mt-1">
                      <p className="detail-timeline-copy whitespace-pre-line">{m.bodyText}</p>
                    </Disclosure>
                  </>
                ) : (
                  <p className="detail-timeline-copy mt-1 whitespace-pre-line">{m.bodyText}</p>
                )}
                {m.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {m.attachments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] p-2.5 text-sm">
                        <Paperclip className="h-4 w-4 text-[var(--color-ink-muted)]" aria-hidden="true" />
                        {a.isReadable ? (
                          <a
                            href={`/api/attachments/${a.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="detail-timeline-title text-[var(--color-brand-dark)] hover:underline"
                          >
                            {a.fileName}
                          </a>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">{a.fileName}</span>
                        )}
                        <span className="text-xs text-[var(--color-ink-muted)]">
                          ({a.mimeType}, {(a.sizeBytes / 1024).toFixed(0)} KB)
                        </span>
                        {!a.isReadable && <Badge tone="warning">Illeggibile</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </WorkPanel>
  );
}
