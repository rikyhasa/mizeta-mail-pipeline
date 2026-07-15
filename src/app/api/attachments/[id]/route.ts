import { prisma } from "@/lib/db/prisma";
import { authErrorResponse, requireUser } from "@/lib/auth/guard";
import { attachmentStorage } from "@/lib/storage/local-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return Response.json({ error: "Allegato non trovato" }, { status: 404 });
  }
  if (!attachment.isReadable) {
    return Response.json({ error: "Allegato non leggibile: contenuto non disponibile" }, { status: 422 });
  }

  const content = await attachmentStorage.get(attachment.storageKey);
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Content-Length": String(attachment.sizeBytes),
    },
  });
}
