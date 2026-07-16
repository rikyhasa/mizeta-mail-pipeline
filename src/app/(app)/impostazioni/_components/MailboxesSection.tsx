import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewMailboxForm } from "./NewMailboxForm";

interface MailboxRow {
  id: string;
  provider: string;
  displayName: string;
  emailAddress: string;
  status: string;
  isPec: boolean;
  lastSyncAt: Date | null;
  lastHealthStatus: string | null;
  lastHealthCheckAt: Date | null;
  subscriptionExpiresAt: Date | null;
}

/** `pec_imap` resta uno scheletro documentato non funzionante (SPEC.md §3): mai abilitare test
 * connessione/sincronizzazione per quel provider. `microsoft365` e `mock` sono entrambi reali
 * in questa fase. */
export function MailboxesSection({ mailboxes, emailProvider }: { mailboxes: MailboxRow[]; emailProvider: string }) {
  const actionsEnabled = emailProvider !== "pec_imap";

  return (
    <WorkPanel title="Provider email e stato connessione">
      {!actionsEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2">
          <Badge tone="warning">Non ancora attivo</Badge>
          <p className="text-xs text-[var(--color-warning)]">
            EMAIL_PROVIDER=&quot;pec_imap&quot; resta uno scheletro documentato in questa fase: test connessione e sincronizzazione manuale non sono disponibili.
          </p>
        </div>
      )}
      <div className="flex flex-col">
        {mailboxes.map((mailbox) => (
          <div key={mailbox.id} className="detail-setting-row">
            <div>
              <div className="detail-setting-name">
                {mailbox.displayName} {mailbox.isPec && <Badge tone="info">PEC</Badge>}
              </div>
              <div className="detail-setting-desc">
                {mailbox.emailAddress} · {mailbox.provider} · stato: {mailbox.status}
              </div>
              <div className="detail-setting-desc">
                Ultima sincronizzazione: {formatDateTime(mailbox.lastSyncAt)} · Ultimo controllo salute:{" "}
                {mailbox.lastHealthStatus ?? "n/d"} ({formatDateTime(mailbox.lastHealthCheckAt)})
                {mailbox.subscriptionExpiresAt && <> · Subscription in scadenza: {formatDateTime(mailbox.subscriptionExpiresAt)}</>}
              </div>
            </div>
            <div className="flex gap-2">
              <ActionButton
                method="POST"
                url={`/api/settings/mailboxes/${mailbox.id}/health-check`}
                disabled={!actionsEnabled}
                disabledReason={!actionsEnabled ? "Scheletro pec_imap" : undefined}
                size="sm"
              >
                Test connessione
              </ActionButton>
              <ActionButton
                method="POST"
                url={`/api/settings/mailboxes/${mailbox.id}/sync`}
                disabled={!actionsEnabled}
                disabledReason={!actionsEnabled ? "Scheletro pec_imap" : undefined}
                size="sm"
              >
                Sincronizza ora
              </ActionButton>
            </div>
          </div>
        ))}
        {mailboxes.length === 0 && <EmptyState title="Nessuna casella collegata" />}
      </div>
      <NewMailboxForm emailProviderLabel={emailProvider} />
    </WorkPanel>
  );
}
