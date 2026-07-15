import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  bodyText: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("settings:manage", async () => {
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }
    const existing = await prisma.replyTemplate.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Modello non trovato" }, { status: 404 });

    const template = await prisma.replyTemplate.update({ where: { id }, data: parsed.data });
    return Response.json({ template });
  });
}
