import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { ENFORCEMENT_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import type { EnforcementDocumentType } from "@/generated/prisma/enums";

const DOCUMENT_TYPE_VALUES = Object.keys(ENFORCEMENT_DOCUMENT_TYPE_LABELS) as [EnforcementDocumentType, ...EnforcementDocumentType[]];
const documentTypeSchema = z.enum(DOCUMENT_TYPE_VALUES);
const patchSchema = z.object({ attachmentId: z.string().min(1), note: z.string().nullable().optional() });

/**
 * "Collega documento" (docs/SPEC-AUTOVELOX-DRAFT.md §8): collega un allegato già presente nella
 * pratica (mai un upload diretto qui — gli allegati arrivano solo dalle email, CLAUDE.md
 * invariante 2) a un tipo di documento tecnico atteso. Upsert idempotente su
 * `@@unique([checkId, documentType])` (Tappa 1): nessun EnforcementDocumentCheck viene creato
 * eagerly dalla pipeline, solo al primo collegamento/richiesta.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; documentType: string }> }) {
  return withPermission("enforcement:confirm", async (user) => {
    const { id: caseId, documentType: rawDocumentType } = await context.params;
    const documentTypeParsed = documentTypeSchema.safeParse(rawDocumentType);
    if (!documentTypeParsed.success) {
      return Response.json({ error: "Tipo documento non valido" }, { status: 400 });
    }
    const documentType = documentTypeParsed.data;

    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido: indicare l'allegato da collegare" }, { status: 400 });
    }

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
    if (!check) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: parsed.data.attachmentId },
      include: { emailMessage: { select: { caseId: true } } },
    });
    if (!attachment || attachment.emailMessage.caseId !== caseId) {
      return Response.json({ error: "Allegato non trovato per questa pratica" }, { status: 404 });
    }

    const note = parsed.data.note?.trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      const documentCheck = await tx.enforcementDocumentCheck.upsert({
        where: { checkId_documentType: { checkId: check.id, documentType } },
        create: { checkId: check.id, documentType, status: "PRESENT", attachmentId: attachment.id, note },
        update: { status: "PRESENT", attachmentId: attachment.id, note },
      });

      await writeAuditLog(tx, {
        action: "ENFORCEMENT_DOCUMENT_LINKED",
        entityType: "EnforcementDocumentCheck",
        entityId: documentCheck.id,
        caseId,
        actorId: user.id,
        metadata: { documentType, attachmentId: attachment.id },
      });

      return documentCheck;
    });

    return Response.json({ documentCheck: updated });
  });
}
