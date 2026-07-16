import { Mail, Paperclip } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";

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
        {messages.map((m) => (
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
                <br />
                {m.bodyText}
              </div>
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
        ))}
      </div>
    </WorkPanel>
  );
}
