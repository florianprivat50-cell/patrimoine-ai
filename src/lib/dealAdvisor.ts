import type { RealEstateProject } from '../types';
import type { AdvisorAnswer } from './advisor';
import { computeDeal, effectiveProjectInputs } from './deal';
import { rankProjects } from './dealPipeline';
import { projectFeasibility, targetPriceForScore } from './projectAnalysis';
import { fmtEUR, fmtPct } from './finance';
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function answerDealQuestion(question:string,projects:RealEstateProject[],selectedId?:string):AdvisorAnswer|null {
  const q=normal(question);
  if(!/compar|opportunit|score|negoci|immeuble|dossier|travaux|atteindre|obtenir|prix cible/.test(q))return null;
  const answer:AdvisorAnswer={conclusion:'',data:[],hypotheses:['Même moteur de faisabilité que le rapport ; calculs indicatifs selon les hypothèses enregistrées.'],risks:[],alternatives:[],actions:[],missing:[]};
  if(!projects.length)return {...answer,conclusion:'Enregistrez une opportunité pour pouvoir l’analyser ou la comparer.',actions:['Analyser et enregistrer une annonce.']};
  const ranked=rankProjects(projects);
  if(/compar|meilleur|classement/.test(q)&&!/score.*\d|\d.*score/.test(q)){
    return {...answer,conclusion:projects.length<2?'Un seul dossier enregistré : ajoutez un second bien pour une comparaison.':`${ranked[0].project.name} obtient le meilleur score actuel (${ranked[0].deal.score}/100), sous réserve des preuves manquantes.`,
      data:ranked.slice(0,10).map((x,i)=>`${i+1}. ${x.project.name} · ${x.project.city||'ville inconnue'} · ${x.deal.score}/100 · ${fmtEUR(x.project.price)} · net ${fmtPct(x.deal.results.realiste.netAfterTaxYieldPct)} · cash-flow ${fmtEUR(x.deal.results.realiste.monthlyCashflow)}/mois · prudent ${fmtEUR(x.deal.results.prudent.monthlyCashflow)}/mois`),
      risks:[...new Set(ranked.flatMap(x=>projectFeasibility(effectiveProjectInputs(x.project),x.deal.results).hardCaps))],
      actions:['Confirmer les loyers, les charges et les devis des dossiers les mieux classés.']};
  }
  const named=projects.filter(p=>normal(p.name).length>3&&q.includes(normal(p.name)));
  const p=projects.find(p=>p.id===selectedId)??(named.length===1?named[0]:projects.length===1?projects[0]:undefined);
  if(!p)return {...answer,conclusion:'Sélectionnez le dossier concerné pour calculer son prix cible ou simuler des travaux.',data:projects.map(p=>p.name)};
  const input=effectiveProjectInputs(p), before=computeDeal(input);
  const target=q.match(/(?:score(?: de)?|atteindre|obtenir|viser)\s*(\d{1,3})\b/)??q.match(/\b(\d{1,3})\s*(?:\/\s*100|points)/);
  if(target){const result=targetPriceForScore(input,Number(target[1]));return {...answer,
    conclusion:result.price==null?`${p.name} : ${target[1]}/100 inaccessible par une baisse du prix seule.`:`${p.name} : prix maximal ${fmtEUR(result.price)} pour atteindre ${target[1]}/100.`,
    data:[`Prix actuel ${fmtEUR(p.price)} · score ${before.score}/100`,...(result.price!=null?[`Score recalculé ${result.score}/100 · baisse ${fmtEUR(p.price-result.price)}`]:[])],
    hypotheses:[...answer.hypotheses,result.reason],risks:projectFeasibility(input,before.results).hardCaps,actions:['Vérifier les données avant de formuler une offre.']};}
  const works=q.match(/(?:travaux(?: de)?|simule)\s*([\d\s]+)\s*(?:€|euros)?/);
  if(works){const amount=Number(works[1].replace(/\s/g,''));if(Number.isFinite(amount)&&amount>=0){const after=computeDeal({...input,works:amount});return {...answer,conclusion:`${p.name} avec ${fmtEUR(amount)} de travaux : ${after.score}/100.`,data:[`Score ${before.score} → ${after.score}/100`,`Cash-flow ${fmtEUR(before.results.realiste.monthlyCashflow)} → ${fmtEUR(after.results.realiste.monthlyCashflow)}/mois`],hypotheses:[...answer.hypotheses,'Le montant remplace le budget travaux ; simulation non enregistrée.'],risks:after.risks};}}
  return {...answer,conclusion:`${p.name} : ${before.score}/100.`,data:[`Prix ${fmtEUR(p.price)} · cash-flow ${fmtEUR(before.results.realiste.monthlyCashflow)}/mois`],risks:before.risks,actions:before.visitQuestions,alternatives:['Demandez « Quel prix pour atteindre 65/100 ? » ou « Simule 30 000 € de travaux ».']};
}

