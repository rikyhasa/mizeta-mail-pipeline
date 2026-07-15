"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, FileText, Inbox, LayoutDashboard, Search, Settings, ShieldCheck, Users } from "lucide-react";

const nav=[
  {href:"/",label:"Dashboard",icon:LayoutDashboard}, {href:"/pratiche",label:"Pratiche",icon:BriefcaseBusiness},
  {href:"/posta",label:"Posta acquisita",icon:Inbox}, {href:"/report",label:"Report e documenti",icon:BarChart3},
  {href:"/audit",label:"Registro attività",icon:ShieldCheck}, {href:"/impostazioni",label:"Impostazioni",icon:Settings}
];
export function AppShell({children}:{children:React.ReactNode}){const pathname=usePathname();return <div className="app-shell">
  <aside className="sidebar"><div className="brand"><span className="brand-mark">MZ</span><div><div className="brand-name">Mizeta Flow</div><div className="brand-sub">OPERATIONS HUB</div></div></div>
    <nav className="nav" aria-label="Navigazione principale">{nav.map(({href,label,icon:Icon})=><Link key={href} href={href} className={`nav-link ${pathname===href||href!=="/"&&pathname.startsWith(href)?"active":""}`}><Icon size={18}/>{label}</Link>)}</nav>
    <div className="sidebar-footer"><div className="avatar">EB</div><div><div className="user-name">Elena Bianchi</div><div className="user-role">Amministratore</div></div><form action="/api/auth/logout" method="post" style={{marginLeft:"auto"}}><button className="btn-ghost" title="Esci" style={{color:"#aebdcb",cursor:"pointer",border:0}}><Users size={16}/></button></form></div>
  </aside>
  <main className="main"><header className="topbar"><div style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:11,color:"#738294"}}/><input className="search" aria-label="Cerca pratiche" placeholder="Cerca pratica, cliente, ordine..." style={{paddingLeft:36}}/></div><div className="top-actions"><span className="sync-pill"><span style={{width:7,height:7,borderRadius:"50%",background:"#28a47a"}}/> Mock connesso · ora</span><Link href="/report" className="btn"><FileText size={15}/> Crea report</Link></div></header>{children}</main>
  </div>}

