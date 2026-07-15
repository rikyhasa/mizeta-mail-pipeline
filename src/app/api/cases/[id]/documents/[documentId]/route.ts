import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { attachmentStorage } from "@/lib/storage/local-storage";

/** Download di un documento generato (stesso pattern di /api/attachments/[id]: la buffer viene
 * letta dallo storage e trasmessa, mai un URL diretto verso lo storage sottostante). */
export async function GET(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  return withPermission("case:read", async () => {
    const { id: caseId, documentId } = await context.params;
    const document = await prisma.generatedDocument.findUnique({ where: { id: documentId } });
    if (!document || document.caseId !== caseId) {
      return Response.json({ error: "Documento non trovato" }, { status: 404 });
    }
    if (!document.storageKey) {
      return Response.json({ error: "Documento non ancora generato" }, { status: 422 });
    }

    const content = await attachmentStorage.get(document.storageKey);
    const mimeType = document.format === "PDF" ? "application/pdf" : "text/html";
    const extension = document.format === "PDF" ? "pdf" : "html";
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${document.type.toLowerCase()}-${document.id}.${extension}"`,
      },
    });
  });
}
