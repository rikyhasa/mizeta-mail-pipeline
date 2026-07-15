import { ROLE_LABELS } from "@/lib/i18n/labels";
import { InlineSelect } from "@/components/InlineSelect";
import { ActionButton } from "@/components/ActionButton";
import { NewUserForm } from "./NewUserForm";
import type { Role } from "@/generated/prisma/enums";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export function UsersSection({ users }: { users: UserRow[] }) {
  return (
    <section aria-label="Utenti e ruoli" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Utenti e ruoli</h2>
      <div className="mb-4 flex flex-col divide-y divide-slate-100">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <div className="font-medium text-slate-900">
                {u.name} {!u.active && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Disattivo</span>}
              </div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <InlineSelect url={`/api/settings/users/${u.id}`} fieldName="role" value={u.role} options={ROLE_OPTIONS} label="Ruolo" />
              <ActionButton
                method="PATCH"
                url={`/api/settings/users/${u.id}`}
                body={{ active: !u.active }}
                confirmMessage={u.active ? "Disattivare questo utente?" : "Riattivare questo utente?"}
              >
                {u.active ? "Disattiva" : "Attiva"}
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
      <NewUserForm />
    </section>
  );
}
