import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { createEnforcementDocumentRequestDraft } from "@/lib/pipeline/create-enforcement-document-request-draft";
import { ENFORCEMENT_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import type { EnforcementDocumentType } from "@/generated/prisma/enums";

const ALL_DOCUMENT_TYPES = Object.keys(ENFORCEMENT_DOCUMENT_TYPE_LABELS) as EnforcementDocumentType[];

/**
 * "Richiedi documentazione" (docs/SPEC-AUTOVELOX-DRAFT.md §8): genera una bozza `EmailDraft`
 * elencando i tipi di documento non ancora presenti (allowlist meno quelli già `PRESENT`) e li
 * marca `REQUESTED` — mai un invio automatico (CLAUDE.md invariante 2/3, non negoziabile).
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("enforcement:request-documents", async (user) => {
    const { id: caseId } = await context.params;

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId }, include: { documentChecks: true } });
    if (!check) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const presentTypes = new Set(check.documentChecks.filter((d) => d.status === "PRESENT").map((d) => d.documentType));
    const missingTypes = ALL_DOCUMENT_TYPES.filter((t) => !presentTypes.has(t));
    if (missingTypes.length === 0) {
      return Response.json({ error: "Nessun documento mancante da richiedere" }, { status: 422 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const { draftId } = await createEnforcementDocumentRequestDraft(tx, { caseId, missingDocumentTypes: missingTypes, actorId: user.id });

      for (const documentType of missingTypes) {
        await tx.enforcementDocumentCheck.upsert({
          where: { checkId_documentType: { checkId: check.id, documentType } },
          create: { checkId: check.id, documentType, status: "REQUESTED" },
          update: { status: "REQUESTED" },
        });
      }

      await writeAuditLog(tx, {
        action: "ENFORCEMENT_DOCUMENTATION_REQUESTED",
        entityType: "EnforcementDeviceCheck",
        entityId: check.id,
        caseId,
        actorId: user.id,
        metadata: { documentTypes: missingTypes, draftId },
      });

      return { draftId };
    });

    return Response.json(result);
  });
}
