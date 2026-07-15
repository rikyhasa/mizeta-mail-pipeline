import { requireUserOrRedirect } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserOrRedirect();

  return (
    <ToastProvider>
      <AppShell
        userName={user.name}
        userRoleLabel={ROLE_LABELS[user.role] ?? user.role}
        isAdmin={user.role === "ADMIN"}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
