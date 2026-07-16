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
 * conservata). Tutte reali da FASE 3: "Posta acquisita" (tappa 2), "Report e
 * documenti" (tappa 5, onesta sul fatto che solo 3 modelli su 8 hanno
 * generazione reale), "Registro attività" (tappa 6, pagina globale paginata
 * sull'`AuditLog` reale, non i 30 eventi mock della reference).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, status: "active" },
  { href: "/pratiche", label: "Pratiche", icon: BriefcaseBusiness, status: "active" },
  { href: "/revisione", label: "Coda di revisione", icon: ListChecks, status: "active" },
  { href: "/posta", label: "Posta acquisita", icon: Inbox, status: "active" },
  { href: "/report", label: "Report e documenti", icon: BarChart3, status: "active" },
  { href: "/audit", label: "Registro attività", icon: ShieldCheck, status: "active" },
];

/** Aggiunta solo per gli amministratori — gate di permesso, non "non ancora disponibile". */
export const ADMIN_NAV_ITEM: NavItem = { href: "/impostazioni", label: "Impostazioni", icon: Settings, status: "active" };
