import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import type { Role } from "@/generated/prisma/enums";

const ROLE_VALUES = Object.keys(ROLE_LABELS) as [Role, ...Role[]];
const patchSchema = z.object({ active: z.boolean().optional(), role: z.enum(ROLE_VALUES).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("user:manage", async (user) => {
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Utente non trovato" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
          ...(parsed.data.role ? { role: parsed.data.role } : {}),
        },
      });
      await writeAuditLog(tx, {
        action: "ADMIN_ACTION",
        entityType: "User",
        entityId: id,
        actorId: user.id,
        metadata: { action: "user_updated", ...parsed.data },
      });
      return updatedUser;
    });

    const { passwordHash: _passwordHash, ...safeUser } = updated;
    return Response.json({ user: safeUser });
  });
}
