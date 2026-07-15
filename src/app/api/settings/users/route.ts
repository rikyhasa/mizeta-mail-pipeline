import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import type { Role } from "@/generated/prisma/enums";

const ROLE_VALUES = Object.keys(ROLE_LABELS) as [Role, ...Role[]];
const postSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLE_VALUES),
  password: z.string().min(8),
});

/** Creazione utente da parte di un ADMIN (SPEC.md §14): nessuna registrazione pubblica. */
export async function POST(request: Request) {
  return withPermission("user:manage", async (user) => {
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Dati utente non validi" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return Response.json({ error: "Email già registrata" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash, invitedById: user.id },
      });
      await writeAuditLog(tx, {
        action: "ADMIN_ACTION",
        entityType: "User",
        entityId: newUser.id,
        actorId: user.id,
        metadata: { action: "user_created", role: parsed.data.role },
      });
      return newUser;
    });

    const { passwordHash: _passwordHash, ...safeUser } = created;
    return Response.json({ user: safeUser }, { status: 201 });
  });
}
