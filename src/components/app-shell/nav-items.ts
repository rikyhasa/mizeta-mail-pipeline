import type { ComponentType } from "react";
import { BarChart3, BriefcaseBusiness, Inbox, LayoutDashboard, ListChecks, Settings, ShieldCheck } from "lucide-react";

export type NavItemStatus = "active" | "disabled";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  status: NavItemStatus;
}

/**
 * Voci della sidebar (Fase 8, docs/UI-PORTING-PLAN.md): le 6 della reference
 * Mizeta Flow + "Coda di revisione" (solo nel target, più avanzata, va
 * conservata). "Registro attività" (pagina globale) resta `disabled`:
 * visibile nella struttura ma senza link reale, mai finta. "Posta acquisita"
 * è reale da FASE 3/tappa 2, "Report e documenti" da FASE 3/tappa 5
 * (docs/UI-PORTING-PLAN.md) — quest'ultima onesta sul fatto che solo 3 modelli
 * su 8 hanno generazione reale, gli altri restano "Non ancora disponibile"
 * dentro la pagina stessa, non nascosti dietro un nav disabilitato.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, status: "active" },
  { href: "/pratiche", label: "Pratiche", icon: BriefcaseBusiness, status: "active" },
  { href: "/revisione", label: "Coda di revisione", icon: ListChecks, status: "active" },
  { href: "/posta", label: "Posta acquisita", icon: Inbox, status: "active" },
  { href: "/report", label: "Report e documenti", icon: BarChart3, status: "active" },
  { href: "/audit", label: "Registro attività", icon: ShieldCheck, status: "disabled" },
];

/** Aggiunta solo per gli amministratori — gate di permesso, non "non ancora disponibile". */
export const ADMIN_NAV_ITEM: NavItem = { href: "/impostazioni", label: "Impostazioni", icon: Settings, status: "active" };
