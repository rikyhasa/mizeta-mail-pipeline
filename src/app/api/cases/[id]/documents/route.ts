import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { getDocumentService } from "@/lib/adapters/documents/document-service-factory";
import { GeneratedDocumentFormat, GeneratedDocumentType } from "@/generated/prisma/enums";

const TYPE_VALUES = Object.keys(GeneratedDocumentType) as [GeneratedDocumentType, ...GeneratedDocumentType[]];
const FORMAT_VALUES = Object.keys(GeneratedDocumentFormat) as [GeneratedDocumentFormat, ...GeneratedDocumentFormat[]];

const postSchema = z.object({
  type: z.enum(TYPE_VALUES),
  format: z.enum(FORMAT_VALUES).default("PDF"),
});

/** Implementati in questa fase (SPEC.md §12): scheda preventivo, dossier reclamo, scheda multa.
 * Gli altri 5 tipi (report/briefing amministrativi) restano un 501 esplicito. */
const IMPLEMENTED_TYPES = new Set<GeneratedDocumentType>(["QUOTE_SHEET", "CLAIM_DOSSIER", "FINE_SHEET"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Dati non validi" }, { status: 400 });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return Response.json({ error: "Pratica non trovata" }, { status: 404 });
    }

    if (!IMPLEMENTED_TYPES.has(parsed.data.type)) {
      return Response.json({ error: "Tipo di documento non ancora disponibile: previsto in una fase successiva." }, { status: 501 });
    }

    const { storageKey } = await getDocumentService().generate({
      caseId,
      type: parsed.data.type,
      format: parsed.data.format,
    });

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.generatedDocument.create({
        data: {
          caseId,
          type: parsed.data.type,
          format: parsed.data.format,
          storageKey,
          generatedById: user.id,
          generatedAt: new Date(),
        },
      });
      await writeAuditLog(tx, {
        action: "DOCUMENT_GENERATED",
        entityType: "GeneratedDocument",
        entityId: created.id,
        caseId,
        actorId: user.id,
        metadata: { type: parsed.data.type, format: parsed.data.format },
      });
      return created;
    });

    return Response.json({ document }, { status: 201 });
  });
}
