import { useMemo, useState } from 'react';
import type { RealEstateProject } from '../types';
import { compareRentals, rentalDecision, type SharedFinance } from '../lib/rentalDecision';
import './rental-comparison.css';

const euros=(n:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const pct=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n)+' %';
const signed=(n:number)=>(n>=0?'+':'−')+euros(Math.abs(n));

export default function RentalComparison({projects,demo=false}:{projects:RealEstateProject[];demo?:boolean}) {
  const [selected,setSelected]=useState<string[]>([]),[common,setCommon]=useState(false);
  const [finance,setFinance]=useState<SharedFinance>({downPayment:15000,ratePct:3.5,durationYears:25,insurancePctYearly:.3});
  const [notice,setNotice]=useState('');
  const chosen=projects.filter(p=>selected.includes(p.id));
  const rows=useMemo(()=>compareRentals(chosen,common?finance:undefined),[projects,selected,common,finance]);
  const firstDecision=rows.find(x=>x.decision.calculable)?.decision;
  function toggle(id:string){setNotice('');if(selected.includes(id)){setSelected(selected.filter(x=>x!==id));return;}if(chosen.length>=3){setNotice('Retirez un bien avant d’en ajouter un quatrième.');return;}setSelected([...chosen.map(p=>p.id),id]);}
  function download(){
    const field=(s:unknown)=>'"'+String(s??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
    const data=[['Comparaison locative — '+(demo?'EXEMPLES FICTIFS':'hypothèses utilisateur')],['Montants avant impôt, aucune validation bancaire. '+new Date().toLocaleDateString('fr-FR')],
      ['Bien','Ville','Prix demandé EUR','Coût total EUR','Apport EUR','Taux %','Durée ans','Assurance %','Loyers HC EUR/mois','Vacance %','Trésorerie EUR/mois','Scénario dégradé EUR/mois','Rendement net exploitation %','Points à vérifier']];
    for(const {project,decision:d} of rows)data.push(d.calculable?[project.name,project.city??'',String(d.input.price),String(d.result.totalCost),String(d.input.downPayment),String(d.input.ratePct),String(d.input.durationYears),String(d.input.insurancePctYearly),String(d.result.grossMonthlyRent),String(d.input.vacancyPct),d.result.monthlyCashflow.toFixed(2),d.stress.monthlyCashflow.toFixed(2),d.result.netYieldPct.toFixed(2),d.gaps.join(' | ')]:[project.name,'À compléter',...d.issues]);
    data.push(['Scénario dégradé : loyers -5 %, vacance +5 points (maximum 100 %), travaux +15 %, charges mensuelles +10 %, même apport, surcoût financé.']);
    const url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(r=>r.map(field).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='comparaison-locative.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const metrics:Array<[string,(d:Extract<ReturnType<typeof rentalDecision>,{calculable:true}>)=>string]>=[
    ['Prix demandé',d=>euros(d.input.price)],['Coût total, frais et travaux',d=>euros(d.result.totalCost)],['Apport immobilisé',d=>euros(d.input.downPayment)],
    ['Crédit : taux / durée / assurance',d=>`${pct(d.input.ratePct)} / ${d.input.durationYears} ans / ${pct(d.input.insurancePctYearly)}`],
    ['Mensualité avec assurance',d=>euros(d.result.monthlyLoanPayment)],['Loyers hors charges',d=>euros(d.result.grossMonthlyRent)],['Vacance retenue',d=>pct(d.input.vacancyPct)],
    ['Trésorerie / mois · avant impôt',d=>signed(d.result.monthlyCashflow)],['Scénario dégradé / mois',d=>signed(d.stress.monthlyCashflow)],
    ['Effort mensuel dans le scénario dégradé',d=>euros(d.stress.savingsEffort)],['Rendement net d’exploitation',d=>pct(d.result.netYieldPct)],
    ['Loyers HC nécessaires à l’équilibre',d=>d.result.breakEvenRent===null?'Équilibre impossible':euros(d.result.breakEvenRent)],
    ['Prix pour un équilibre avant impôt',d=>d.result.monthlyCashflow>=0?'Déjà atteint au prix demandé':d.targetPrice===null?'Inaccessible par le prix seul':euros(d.targetPrice)],
    ['Références de ventes / loyers',d=>`${d.saleCount} / ${d.rentCount}`],
  ];
  return <section className="rental-comparison" aria-label="Comparateur d’achats locatifs">
    <p className="rc-intro">Sélectionnez deux ou trois biens. Comparez les montants et les incertitudes : une meilleure trésorerie ne suffit pas à désigner le meilleur achat.</p>
    {demo&&<p className="rc-notice">Exemples fictifs · aucun dossier personnel créé.</p>}
    <fieldset className="rc-picker"><legend>Biens à comparer · {chosen.length}/3</legend>{projects.length?projects.map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)}/><span><strong>{p.name||'Sans titre'}</strong><small>{p.city||'Ville à préciser'} · {Number.isFinite(p.price)?euros(p.price):'Prix manquant'}</small></span></label>):<p>Enregistrez deux analyses pour commencer.</p>}</fieldset>
    {notice&&<p role="status">{notice}</p>}
    {chosen.length<2?<p className="rc-notice">Choisissez encore {2-chosen.length} bien{chosen.length===0?'s':''} pour afficher la comparaison.</p>:<>
      <fieldset className="rc-financing"><legend>Comment comparer le financement ?</legend><label><input type="radio" name="rc-financing" checked={!common} onChange={()=>setCommon(false)}/>Conditions de chaque dossier</label><label><input type="radio" name="rc-financing" checked={common} onChange={()=>setCommon(true)}/>Même apport et mêmes conditions de crédit</label>
      {common&&<div className="rc-inputs">{([['downPayment','Apport · €',0,100000000,1000],['ratePct','Taux annuel · %',0,30,.1],['durationYears','Durée · ans',1,40,1],['insurancePctYearly','Assurance annuelle · %',0,10,.05]] as const).map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" min={min} max={max} step={step} value={Number.isNaN(finance[key])?'':finance[key]} onChange={e=>setFinance({...finance,[key]:e.target.value===''?NaN:Number(e.target.value)})}/></label>)}</div>}
      <p>Réglages de comparaison uniquement : vos dossiers restent inchangés. Les valeurs préremplies ne constituent pas une offre de crédit. Les loyers, charges, travaux et frais restent propres à chaque bien.</p></fieldset>
      <p className="rc-notice">Tous les résultats ci-dessous sont <strong>avant impôt sur les revenus locatifs</strong>. Le régime fiscal et les documents du bien doivent être étudiés séparément.</p>
      <p className="rc-scroll-hint">Sur téléphone, faites défiler le tableau horizontalement.</p>
      <div className="rc-table-scroll" tabIndex={0} role="region" aria-label="Tableau comparatif défilant"><table><caption>Comparaison selon {common?'un financement commun':'les conditions de chaque dossier'}</caption><thead><tr><th scope="col">Critère</th>{rows.map(({project})=><th scope="col" key={project.id}>{project.name}<small>{project.city}</small></th>)}</tr></thead><tbody>
        {metrics.map(([label,value])=><tr key={label}><th scope="row">{label}</th>{rows.map(({project,decision})=><td key={project.id}>{decision.calculable?value(decision):'À compléter'}</td>)}</tr>)}
        <tr><th scope="row">Lecture financière</th>{rows.map(({project,decision:d})=><td key={project.id}>{d.calculable?<><strong>{d.status}</strong><p>{d.next}</p></>:d.issues.join(' ')}</td>)}</tr>
        <tr><th scope="row">Ce qui manque pour décider</th>{rows.map(({project,decision:d})=><td key={project.id}>{d.calculable?<ul>{d.gaps.length?d.gaps.map(x=><li key={x}>{x}</li>):<li>Références présentes ; documents du bien et financement encore à vérifier.</li>}</ul>:d.issues.join(' ')}</td>)}</tr>
      </tbody></table></div>
      <details className="rc-details"><summary>Comprendre le scénario et le prix d’équilibre</summary><p>Scénario dégradé : loyers −5 %, vacance +5 points (maximum 100 %), travaux +15 %, charges mensuelles +10 %. Apport inchangé ; surcoût des travaux financé. Des travaux à 0 € restent à 0 € : renseignez des devis.</p><p>Le prix d’équilibre est le seuil calculé pour une trésorerie mensuelle nulle avant impôt, avec les autres hypothèses inchangées. Ce n’est ni une estimation de marché ni une recommandation d’offre. Le rendement net d’exploitation inclut les charges renseignées mais exclut le financement et l’impôt sur les revenus locatifs.</p></details>
      <details className="rc-details"><summary>Questions à emporter en visite</summary><ul>{firstDecision?.calculable&&firstDecision.visitQuestions.map(q=><li key={q}>{q}</li>)}</ul><p>Demandez des justificatifs pour chaque point manquant indiqué dans le tableau.</p></details>
      <button className="rc-export" onClick={download}>Exporter cette comparaison (.csv)</button>
    </>}
  </section>;
}
