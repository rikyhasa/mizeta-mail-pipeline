import { Mail, SlidersHorizontal, Tags, Users, FileText, Activity, Terminal, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireRoleOrRedirect } from "@/lib/auth/guard";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { getObservabilitySnapshot } from "@/lib/observability/metrics";
import { env } from "@/lib/config/env";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { SettingsNav } from "@/components/ui/SettingsNav";
import { MailboxesSection } from "./_components/MailboxesSection";
import { AutomationSettingsForm } from "./_components/AutomationSettingsForm";
import { CategorySettingsForm } from "./_components/CategorySettingsForm";
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
        <p className="text-xs font-semibold tracking-wide text-[var(--color-brand)] uppercase">Configurazione</p>
        <h1 className="mt-1 text-page-title font-semibold text-[var(--color-ink)]">Impostazioni</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Configurazione riservata agli amministratori.</p>
      </div>

      <SettingsNav
        items={[
          {
            value: "connessioni",
            label: "Connessioni email",
            icon: <Mail className="h-4 w-4" />,
            content: <MailboxesSection mailboxes={mailboxes} emailProvider={env.EMAIL_PROVIDER} />,
          },
          {
            value: "automazione",
            label: "Automazione e soglie",
            icon: <SlidersHorizontal className="h-4 w-4" />,
            content: <AutomationSettingsForm settings={settings} />,
          },
          {
            value: "categorie",
            label: "Categorie e assegnazioni",
            icon: <Tags className="h-4 w-4" />,
            content: <CategorySettingsForm settings={settings} />,
          },
          {
            value: "utenti",
            label: "Utenti e ruoli",
            icon: <Users className="h-4 w-4" />,
            content: <UsersSection users={users} />,
          },
          {
            value: "modelli",
            label: "Modelli di risposta",
            icon: <FileText className="h-4 w-4" />,
            content: <ReplyTemplatesSection templates={templates} />,
          },
          {
            value: "monitoraggio",
            label: "Monitoraggio",
            icon: <Activity className="h-4 w-4" />,
            content: <ObservabilitySection snapshot={observability} />,
          },
          {
            value: "tecniche",
            label: "Informazioni tecniche",
            icon: <Terminal className="h-4 w-4" />,
            content: (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <WorkPanel title="Modalità">
                  <p className="text-sm text-[var(--color-ink)]">
                    Provider email: <span className="font-mono">{env.EMAIL_PROVIDER}</span> · Provider AI:{" "}
                    <span className="font-mono">{env.LLM_PROVIDER}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    Impostati da variabili d&apos;ambiente: per cambiarli occorre modificare la configurazione e riavviare l&apos;applicazione.
                  </p>
                </WorkPanel>
                <WorkPanel title="Limiti di sicurezza" action={<ShieldCheck className="h-4 w-4 text-[var(--color-forest)]" aria-hidden="true" />}>
                  <div className="flex flex-col">
                    <div className="detail-setting-row">
                      <div>
                        <div className="detail-setting-name">Invio email disabilitato</div>
                        <div className="detail-setting-desc">L&apos;app non invia mai email: le bozze richiedono sempre approvazione umana esplicita.</div>
                      </div>
                    </div>
                    <div className="detail-setting-row">
                      <div>
                        <div className="detail-setting-name">Scrittura gestionale disabilitata</div>
                        <div className="detail-setting-desc">Accesso al gestionale solo in lettura, tramite l&apos;interfaccia ERPAdapter.</div>
                      </div>
                    </div>
                    <div className="detail-setting-row">
                      <div>
                        <div className="detail-setting-name">Pagamenti disabilitati</div>
                        <div className="detail-setting-desc">Nessun pagamento è mai considerato incassato sulla sola base di una email.</div>
                      </div>
                    </div>
                  </div>
                </WorkPanel>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
