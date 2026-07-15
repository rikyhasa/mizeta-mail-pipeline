import type { ReactNode } from "react";
import { HelpCircle, AlertTriangle, ShieldAlert, Clock, Search } from "lucide-react";
import type { BadgeTone } from "@/components/ui/Badge";
import { fieldLabel } from "@/lib/i18n/field-labels";
import { formatDate } from "@/lib/format";

export interface ReviewReason {
  tone: BadgeTone;
  /** Icona gia renderizzata (non un riferimento al componente): attraversa il confine
   * server/client component, come gia fatto per `TabItem.icon` in Tabs.tsx. */
  icon: ReactNode;
  text: string;
}

const ICON_CLASS = "h-3.5 w-3.5";

/**
 * Motivo concreto della verifica, derivato solo da dati gia persistiti (confidenza,
 * campi che l'estrazione stessa ha segnalato come incerti, anomaly_reason, segnali di
 * sicurezza, scadenze critiche) — mai inventato e mai un conteggio su campi non richiesti
 * per questa categoria (usiamo il flag needsHumanReview gia assegnato campo per campo,
 * non un controllo generico "valore nullo").
 */
export function computeReasons(
  c: {
    confidence: number | null;
    fields: { fieldKey: string; value: string | null; needsHumanReview: boolean }[];
    deadlines: { dueAt: Date }[];
    messages: { securityFlags: unknown }[];
  },
  confidenceThreshold: number,
): ReviewReason[] {
  const reasons: ReviewReason[] = [];

  if (c.confidence !== null && c.confidence < confidenceThreshold) {
    reasons.push({
      tone: "warning",
      icon: <HelpCircle className={ICON_CLASS} aria-hidden="true" />,
      text: `Classificazione incerta (confidenza ${Math.round(c.confidence * 100)}%)`,
    });
  }

  const flaggedFields = c.fields.filter((f) => f.needsHumanReview);
  const missingFlagged = flaggedFields.filter((f) => !f.value);
  const uncertainWithValue = flaggedFields.filter((f) => f.value);

  if (missingFlagged.length === 1) {
    reasons.push({
      tone: "critical",
      icon: <AlertTriangle className={ICON_CLASS} aria-hidden="true" />,
      text: `Manca ${fieldLabel(missingFlagged[0].fieldKey).toLowerCase()}`,
    });
  } else if (missingFlagged.length > 1) {
    reasons.push({
      tone: "critical",
      icon: <AlertTriangle className={ICON_CLASS} aria-hidden="true" />,
      text: `Mancano ${missingFlagged.length} dati (es. ${fieldLabel(missingFlagged[0].fieldKey).toLowerCase()})`,
    });
  }

  if (uncertainWithValue.length === 1) {
    reasons.push({
      tone: "warning",
      icon: <HelpCircle className={ICON_CLASS} aria-hidden="true" />,
      text: `Dato da verificare: ${fieldLabel(uncertainWithValue[0].fieldKey).toLowerCase()}`,
    });
  } else if (uncertainWithValue.length > 1) {
    reasons.push({
      tone: "warning",
      icon: <HelpCircle className={ICON_CLASS} aria-hidden="true" />,
      text: `${uncertainWithValue.length} dati da verificare`,
    });
  }

  const anomalyReason = c.fields.find((f) => f.fieldKey === "anomaly_reason")?.value;
  if (anomalyReason) {
    reasons.push({ tone: "critical", icon: <AlertTriangle className={ICON_CLASS} aria-hidden="true" />, text: anomalyReason });
  }

  const hasSecurityFlag = c.messages.some((m) => Array.isArray(m.securityFlags) && m.securityFlags.length > 0);
  if (hasSecurityFlag) {
    reasons.push({
      tone: "critical",
      icon: <ShieldAlert className={ICON_CLASS} aria-hidden="true" />,
      text: "Segnale di sicurezza rilevato nel contenuto email",
    });
  }

  if (c.deadlines[0]) {
    reasons.push({
      tone: "critical",
      icon: <Clock className={ICON_CLASS} aria-hidden="true" />,
      text: `Scadenza critica: ${formatDate(c.deadlines[0].dueAt)}`,
    });
  }

  if (reasons.length === 0) {
    reasons.push({ tone: "neutral", icon: <Search className={ICON_CLASS} aria-hidden="true" />, text: "Verifica manuale richiesta dalla pipeline" });
  }

  return reasons;
}

const TONE_SEVERITY: Record<BadgeTone, number> = { critical: 0, warning: 1, info: 2, neutral: 3, success: 4, muted: 5 };

/** Il motivo piu severo, per la riga compatta della lista (una sola frase, non un badge). */
export function primaryReason(reasons: ReviewReason[]): ReviewReason {
  return [...reasons].sort((a, b) => TONE_SEVERITY[a.tone] - TONE_SEVERITY[b.tone])[0];
}
