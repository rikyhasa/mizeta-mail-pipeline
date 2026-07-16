import { Mail, Paperclip } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
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

/** Cronologia email con allegati annidati per messaggio, come nella reference — al
 * posto delle due card separate "Allegati"/"Cronologia email" del target precedente. */
export function EmailTimelineCard({ messages }: { messages: MessageData[] }) {
  return (
    <Card padding="compact" id="email" className="scroll-mt-24">
      <CardHeader title="Cronologia email" action={<Badge tone="neutral">{messages.length}</Badge>} />
      <ul className="flex flex-col gap-4">
        {messages.map((m) => (
          <li key={m.id} id={`msg-${m.id}`} className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress} — {formatDateTime(m.receivedAt)}
              </span>
              {m.isPec && <Badge tone="info">PEC</Badge>}
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--color-ink)]">{m.subject}</div>
            <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--color-ink)]">{m.bodyText}</p>
            {m.attachments.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {m.attachments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Paperclip className="h-4 w-4 text-[var(--color-ink-muted)]" aria-hidden="true" />
                    {a.isReadable ? (
                      <a
                        href={`/api/attachments/${a.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[var(--color-brand-dark)] hover:underline"
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
          </li>
        ))}
      </ul>
    </Card>
  );
}
