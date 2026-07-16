import { requireUserOrRedirect } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/Toast";
import { getProviderStatusSummary } from "@/lib/observability/provider-status";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, providerStatus] = await Promise.all([requireUserOrRedirect(), getProviderStatusSummary()]);

  return (
    <ToastProvider>
      <AppShell
        userName={user.name}
        userRoleLabel={ROLE_LABELS[user.role] ?? user.role}
        isAdmin={user.role === "ADMIN"}
        providerStatus={providerStatus}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
