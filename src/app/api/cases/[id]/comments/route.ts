import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";

const postSchema = z.object({ body: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Il commento non può essere vuoto" }, { status: 400 });
    }

    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });

    const comment = await prisma.comment.create({
      data: { caseId, authorId: user.id, body: parsed.data.body },
    });

    return Response.json({ comment }, { status: 201 });
  });
}
