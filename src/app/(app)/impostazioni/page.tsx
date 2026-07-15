import { prisma } from "@/lib/db/prisma";
import { requireRoleOrRedirect } from "@/lib/auth/guard";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { getObservabilitySnapshot } from "@/lib/observability/metrics";
import { env } from "@/lib/config/env";
import { MailboxesSection } from "./_components/MailboxesSection";
import { RuleSettingsForm } from "./_components/RuleSettingsForm";
import { UsersSection } from "./_components/UsersSection";
import { ReplyTemplatesSection } from "./_components/ReplyTemplatesSection";
import { ObservabilitySection } from "./_components/ObservabilitySection";

export default async function SettingsPage() {
  await requireRoleOrRedirect(["ADMIN"]);

  const [mailboxes, settings, users, templates, observability] = await Promise.all([
    prisma.mailboxConnection.findMany({ orderBy: { createdAt: "asc" } }),
    getRuleSettings(),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.replyTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    getObservabilitySnapshot(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Impostazioni</h1>
        <p className="text-sm text-slate-500">Configurazione riservata agli amministratori.</p>
      </div>

      <section aria-label="Modalità" className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Modalità</h2>
        <p>
          Provider email: <span className="font-mono">{env.EMAIL_PROVIDER}</span> · Provider AI: <span className="font-mono">{env.LLM_PROVIDER}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Impostati da variabili d&apos;ambiente: per cambiarli occorre modificare la configurazione e riavviare l&apos;applicazione.
        </p>
      </section>

      <MailboxesSection mailboxes={mailboxes} emailProvider={env.EMAIL_PROVIDER} />

      <ObservabilitySection snapshot={observability} />

      <section aria-label="Soglie e regole" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Soglie, retention e categorie</h2>
        <RuleSettingsForm settings={settings} />
      </section>

      <UsersSection users={users} />

      <ReplyTemplatesSection templates={templates} />
    </div>
  );
}

export const dynamic = "force-dynamic";
