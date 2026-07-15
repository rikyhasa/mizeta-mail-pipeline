"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronDown, Filter, Paperclip } from "lucide-react";
import type { CaseRecord } from "@/lib/domain";
import { categoryLabels, priorityLabels, statusLabels } from "@/lib/domain";
import { formatCurrency, formatDate, relativeDate } from "@/lib/format";
import { CategoryIcon } from "./category-icon";

export function CasesTable({cases,compact=false}:{cases:CaseRecord[];compact?:boolean}){
  const [query,setQuery]=useState(""); const [category,setCategory]=useState("ALL"); const [priority,setPriority]=useState("ALL"); const [status,setStatus]=useState("ALL"); const [review,setReview]=useState(false);
  const visible=useMemo(()=>cases.filter(c=>(!query||`${c.title} ${c.party} ${c.code}`.toLowerCase().includes(query.toLowerCase()))&&(category==="ALL"||c.category===category)&&(priority==="ALL"||c.priority===priority)&&(status==="ALL"||c.status===status)&&(!review||c.needsHumanReview)),[cases,query,category,priority,status,review]);
  return <div className="panel"><div className="filters"><Filter size={15} color="#66778a"/><input className="filter search-filter" placeholder="Cerca in questa vista..." value={query} onChange={e=>setQuery(e.target.value)}/>
    <select className="filter" value={category} onChange={e=>setCategory(e.target.value)} aria-label="Categoria"><option value="ALL">Tutte le categorie</option>{Object.entries(categoryLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
    <select className="filter" value={priority} onChange={e=>setPriority(e.target.value)} aria-label="Priorità"><option value="ALL">Tutte le priorità</option>{Object.entries(priorityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
    <select className="filter" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Stato"><option value="ALL">Tutti gli stati</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
    <button className={`btn ${review?"btn-primary":""}`} onClick={()=>setReview(v=>!v)}><AlertCircle size={14}/> Da verificare</button>
  </div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Pratica</th><th>Cliente / fornitore</th><th>Importo</th><th>Scadenza</th><th>Priorità</th><th>Responsabile</th><th>Stato</th><th>Ultima attività</th></tr></thead>
    <tbody>{visible.slice(0,compact?12:50).map(c=><tr key={c.id}><td><div className="type-cell"><span className="type-icon"><CategoryIcon category={c.category}/></span><span>{categoryLabels[c.category]}</span>{c.emails.some(e=>e.attachments.length>0)&&<Paperclip size={12} color="#758395"/>}</div></td><td><Link className="case-link" href={`/pratiche/${c.id}`}>{c.title}</Link><div className="small-muted">{c.code}{c.needsHumanReview&&<span className="anomaly"> · Verifica richiesta</span>}</div></td><td>{c.party}</td><td style={{fontWeight:700}}>{formatCurrency(c.amount)}</td><td><div>{formatDate(c.deadline)}</div>{c.deadline&&<div className="small-muted">{relativeDate(c.deadline)}</div>}</td><td><span className={`badge priority-${c.priority}`}>{priorityLabels[c.priority]}</span></td><td>{c.assignee??<span style={{color:"#8090a0"}}>Non assegnata</span>}</td><td><span className={`badge status-${c.status}`}>{statusLabels[c.status]}</span></td><td>{relativeDate(c.updatedAt)}</td></tr>)}</tbody></table></div>
    {visible.length===0?<div className="empty">Nessuna pratica corrisponde ai filtri.</div>:<div className="pagination"><span>{visible.length} pratiche trovate</span><span>Pagina 1 <ChevronDown size={11} style={{display:"inline"}}/></span></div>}
  </div>
}

