import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";
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
    <section aria-label="Provider email" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Provider email e stato connessione</h2>
      {!actionsEnabled && (
        <p className="mb-2 text-xs text-amber-700">
          EMAIL_PROVIDER=&quot;pec_imap&quot; resta uno scheletro documentato in questa fase: test connessione e sincronizzazione manuale non sono disponibili.
        </p>
      )}
      <div className="flex flex-col divide-y divide-slate-100">
        {mailboxes.map((mailbox) => (
          <div key={mailbox.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <div className="font-medium text-slate-900">
                {mailbox.displayName} {mailbox.isPec && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">PEC</span>}
              </div>
              <div className="text-xs text-slate-500">
                {mailbox.emailAddress} · {mailbox.provider} · stato: {mailbox.status}
              </div>
              <div className="text-xs text-slate-400">
                Ultima sincronizzazione: {formatDateTime(mailbox.lastSyncAt)} · Ultimo controllo salute:{" "}
                {mailbox.lastHealthStatus ?? "n/d"} ({formatDateTime(mailbox.lastHealthCheckAt)})
                {mailbox.subscriptionExpiresAt && <> · Subscription in scadenza: {formatDateTime(mailbox.subscriptionExpiresAt)}</>}
              </div>
            </div>
            <div className="flex gap-2">
              <ActionButton method="POST" url={`/api/settings/mailboxes/${mailbox.id}/health-check`} disabled={!actionsEnabled} disabledReason={!actionsEnabled ? "Scheletro pec_imap" : undefined}>
                Test connessione
              </ActionButton>
              <ActionButton method="POST" url={`/api/settings/mailboxes/${mailbox.id}/sync`} disabled={!actionsEnabled} disabledReason={!actionsEnabled ? "Scheletro pec_imap" : undefined}>
                Sincronizza ora
              </ActionButton>
            </div>
          </div>
        ))}
        {mailboxes.length === 0 && <p className="py-2 text-sm text-slate-500">Nessuna casella collegata.</p>}
      </div>
      <NewMailboxForm emailProviderLabel={emailProvider} />
    </section>
  );
}
