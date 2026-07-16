import { ROLE_LABELS } from "@/lib/i18n/labels";
import { InlineSelect } from "@/components/InlineSelect";
import { ActionButton } from "@/components/ActionButton";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge } from "@/components/ui/Badge";
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
    <WorkPanel title="Utenti e ruoli">
      <div className="mb-4 flex flex-col">
        {users.map((u) => (
          <div key={u.id} className="detail-setting-row">
            <div>
              <div className="detail-setting-name">
                {u.name} {!u.active && <Badge tone="muted">Disattivo</Badge>}
              </div>
              <div className="detail-setting-desc">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <InlineSelect url={`/api/settings/users/${u.id}`} fieldName="role" value={u.role} options={ROLE_OPTIONS} label="Ruolo" />
              <ActionButton
                method="PATCH"
                url={`/api/settings/users/${u.id}`}
                body={{ active: !u.active }}
                confirmMessage={u.active ? "Disattivare questo utente?" : "Riattivare questo utente?"}
                size="sm"
              >
                {u.active ? "Disattiva" : "Attiva"}
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
      <NewUserForm />
    </WorkPanel>
  );
}
