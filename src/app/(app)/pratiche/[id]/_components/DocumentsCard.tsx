import { WorkPanel } from "@/components/ui/WorkPanel";
import { ActionButton } from "@/components/ActionButton";
import { FocusOnHashMatch } from "@/components/FocusOnHashMatch";
import { formatDateTime } from "@/lib/format";
import { GENERATED_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import type { GeneratedDocumentType } from "@/generated/prisma/enums";

interface GeneratedDocumentData {
  id: string;
  type: GeneratedDocumentType;
  format: string;
  storageKey: string | null;
  createdAt: Date;
}

export function DocumentsCard({
  caseId,
  documents,
  documentType,
}: {
  caseId: string;
  documents: GeneratedDocumentData[];
  documentType: { type: GeneratedDocumentType; label: string } | undefined;
}) {
  return (
    <WorkPanel id="documenti" title="Documenti generati">
      <FocusOnHashMatch id="documenti-azione" />
      {documents.length === 0 ? (
        <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessun documento generato.</p>
      ) : (
        <ul className="mb-3 text-sm text-[var(--color-ink)]">
          {documents.map((doc) => (
            <li key={doc.id}>
              {doc.storageKey ? (
                <a
                  href={`/api/cases/${caseId}/documents/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--color-brand-dark)] hover:underline"
                >
                  {GENERATED_DOCUMENT_TYPE_LABELS[doc.type]} ({doc.format})
                </a>
              ) : (
                <>
                  {GENERATED_DOCUMENT_TYPE_LABELS[doc.type]} ({doc.format})
                </>
              )}{" "}
              — {formatDateTime(doc.createdAt)}
            </li>
          ))}
        </ul>
      )}
      {documentType ? (
        <ActionButton
          id="documenti-azione"
          method="POST"
          url={`/api/cases/${caseId}/documents`}
          body={{ type: documentType.type, format: "PDF" }}
        >
          {documentType.label}
        </ActionButton>
      ) : (
        <p id="documenti-azione" className="text-xs text-[var(--color-ink-muted)]">
          Nessun modello documento disponibile per questa categoria.
        </p>
      )}
    </WorkPanel>
  );
}
