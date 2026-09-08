import { useMemo, useState } from "react";
import { useStore } from "../store";
import { DEAL_STAGE_LABELS, DealStage, rankProjects, readPipeline, setDealStage } from "../lib/dealPipeline";
import { fmtEUR, fmtPct } from "../lib/finance";

export default function Opportunites(){
 const projects=useStore(s=>s.projects); const [pipeline,setPipeline]=useState(readPipeline());
 const ranked=useMemo(()=>rankProjects(projects),[projects]);
 const change=(id:string,stage:DealStage)=>setPipeline(setDealStage(id,stage));
 return <div className="opportunities-page">
  <header className="op-head"><span>PORTEFEUILLE D'OPPORTUNITÉS</span><h1>Mes analyses</h1><p>Classez vos dossiers, comparez leur rendement/risque et concentrez votre temps sur les meilleurs deals.</p></header>
  {ranked.length===0?<div className="empty-deals"><strong>Aucune opportunité enregistrée</strong><p>Analysez une annonce depuis l’accueil puis enregistrez-la pour la retrouver ici.</p></div>:
  <div className="rank-list">{ranked.map((x,i)=>{const r=x.deal.results.realiste;const stage=pipeline[x.project.id]?.stage||"a_etudier";return <article key={x.project.id} className="rank-card">
   <div className="rank-no">#{i+1}</div><div className="rank-main"><span>{x.project.city||"Localisation à confirmer"}</span><h2>{x.project.name}</h2><div className="rank-kpis"><b>{fmtEUR(x.project.price)}</b><b>{fmtPct(r.netAfterTaxYieldPct)} net</b><b className={r.monthlyCashflow>=0?"positive":"negative"}>{r.monthlyCashflow>=0?"+":"−"}{fmtEUR(Math.abs(r.monthlyCashflow))}/mois</b></div></div>
   <div className="rank-score"><strong>{x.rankScore}</strong><span>/100</span></div>
   <select value={stage} onChange={e=>change(x.project.id,e.target.value as DealStage)}>{(Object.keys(DEAL_STAGE_LABELS) as DealStage[]).map(k=><option key={k} value={k}>{DEAL_STAGE_LABELS[k]}</option>)}</select>
  </article>})}</div>}
 </div>
}
