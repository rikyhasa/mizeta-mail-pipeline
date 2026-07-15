import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";

const postSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });

    const task = await prisma.task.create({
      data: {
        caseId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        assignedToId: parsed.data.assignedToId ?? null,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        createdById: user.id,
      },
    });

    return Response.json({ task }, { status: 201 });
  });
}
