import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CASE_CATEGORY_LABELS, DEPARTMENT_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import type { CaseCategory, Department } from "@/generated/prisma/enums";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="detail-label">{label}</span>
      <p className="detail-value">{value}</p>
    </div>
  );
}

/** "Contesto" più ricco (FASE 8B, problema #9): ogni riga compare solo se il dato reale
 * esiste, mai inventato — nessuna nuova query oltre all'include mailboxConnection già
 * aggiunto in page.tsx. */
export function ContextPanel({
  partyType,
  partyName,
  fromName,
  fromAddress,
  mailboxDisplayName,
  mailboxAddress,
  department,
  receivedAt,
  updatedAt,
  vehicleType,
  plate,
  driverName,
  secondaryCategories,
  needsHumanReview,
}: {
  partyType: "customer" | "supplier" | null;
  partyName: string | null;
  fromName: string | null;
  fromAddress: string | null;
  mailboxDisplayName: string | null;
  mailboxAddress: string | null;
  department: Department | null;
  receivedAt: Date | null;
  updatedAt: Date;
  vehicleType: string | null;
  plate: string | null;
  driverName: string | null;
  secondaryCategories: CaseCategory[];
  needsHumanReview: boolean;
}) {
  return (
    <div className="detail-panel">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)]">Contesto</h2>
      <div className="mt-3 flex flex-col gap-3">
        <Row label={partyType === "supplier" ? "Fornitore" : "Cliente / ente"} value={partyName ?? "Non associato"} />
        {fromAddress && <Row label="Mittente" value={fromName ? `${fromName} <${fromAddress}>` : fromAddress} />}
        {mailboxAddress && <Row label="Casella di origine" value={mailboxDisplayName ? `${mailboxDisplayName} <${mailboxAddress}>` : mailboxAddress} />}
        <Row label="Reparto" value={department ? DEPARTMENT_LABELS[department] : "Non assegnato"} />
        {receivedAt && <Row label="Data ricezione" value={formatDateTime(receivedAt)} />}
        <Row label="Ultima attività" value={formatDateTime(updatedAt)} />
        {vehicleType && <Row label="Veicolo" value={vehicleType} />}
        {plate && <Row label="Targa" value={plate} />}
        {driverName && <Row label="Conducente" value={driverName} />}
        <Row
          label="Categorie secondarie"
          value={secondaryCategories.length > 0 ? secondaryCategories.map((c) => CASE_CATEGORY_LABELS[c]).join(", ") : "Nessuna"}
        />
        <div>
          <span className="detail-label">Stato revisione</span>
          <div className="mt-1">
            {needsHumanReview ? (
              <Badge tone="warning" icon={AlertTriangle}>
                Revisione necessaria
              </Badge>
            ) : (
              <Badge tone="success" icon={CheckCircle2}>
                Nessuna revisione in sospeso
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2.5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-ink-muted)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          L&apos;app non invia email, non effettua pagamenti e non scrive nel gestionale. Le bozze di risposta
          richiedono sempre approvazione umana esplicita.
        </p>
      </div>
    </div>
  );
}
