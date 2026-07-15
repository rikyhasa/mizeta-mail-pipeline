import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { getCachedLLMProvider } from "@/lib/adapters/llm/llm-provider-factory";
import { createDraftForCase } from "@/lib/pipeline/create-draft-for-case";

/** Crea una bozza di risposta (SPEC.md §11): sempre in stato PENDING_APPROVAL, mai inviata. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });

    const { draftId } = await prisma.$transaction(async (tx) =>
      createDraftForCase(tx, { caseId, llmProvider: getCachedLLMProvider(), actorId: user.id }),
    );

    const draft = await prisma.emailDraft.findUniqueOrThrow({ where: { id: draftId } });
    return Response.json({ draft }, { status: 201 });
  });
}
