import type { RealEstateProjectInputs } from '../types';
import { computeFeasibilityScore } from './feasibility';
import { computeProject, scenarioInputs, ProjectResults } from './realestate';
export function projectFeasibility(p:RealEstateProjectInputs, supplied?:Record<'prudent'|'realiste'|'optimiste',ProjectResults>) {
  const results=supplied??{prudent:computeProject(scenarioInputs(p,'prudent')),realiste:computeProject(p),optimiste:computeProject(scenarioInputs(p,'optimiste'))};
  const adapt=(r:ProjectResults)=>({monthlyCashflow:r.monthlyCashflow,monthlyDebtService:r.monthlyLoanPayment,yearlyNetOperatingIncome:r.yearlyNetIncome,netAfterTaxYieldPct:r.netAfterTaxYieldPct});
  const e=p.evidence;
  const age=e ? Date.now()-Date.parse(e.retrievedAt) : Infinity;
  const fresh=age>=0 && age<90*86400000;
  const critical=['price','surface','monthlyRent'];
  const complete=critical.every(k=>e?.fields.some(f=>f.field===k&&f.status==='declared'&&Date.now()-Date.parse(f.retrievedAt)<90*86400000));
  const valid=[p.agencyFees,p.notaryFeesPct,p.works,p.furniture,p.bankFees,p.downPayment,p.ratePct,p.insurancePctYearly,p.monthlyCharges,p.propertyTaxYearly,p.ownerInsuranceYearly,p.managementPct,p.maintenancePct,p.taxRatePct].every(v=>Number.isFinite(v)&&v>=0)&&p.taxRatePct<100&&p.managementPct+p.maintenancePct<100&&Number.isFinite(p.price)&&p.price>0&&Number.isFinite(p.monthlyRent)&&p.monthlyRent>=0&&Number.isFinite(p.commercialMonthlyRent??0)&&(p.commercialMonthlyRent??0)>=0&&(p.monthlyRent+(p.commercialMonthlyRent??0))>0&&p.durationYears>0&&p.vacancyPct>=0&&p.vacancyPct<=100;
  const score=computeFeasibilityScore({askingPrice:p.price,totalCost:results.realiste.totalCost,subjectMonthlyRent:results.realiste.grossMonthlyRent,targetNetYieldPct:p.targetNetYieldPct,breakEvenRent:results.realiste.breakEvenRent,
    realistic:adapt(results.realiste),prudent:adapt(results.prudent),optimistic:adapt(results.optimiste),
    market:{...(fresh?e?.market:{}),subjectPricePerSqm:p.surface? p.price/p.surface:undefined,dataConfidence:fresh?e?.market.dataConfidence:'unknown'},
    propertyRisk:{...(fresh?e?.risks:{}),dataConfidence:fresh?e?.risks.dataConfidence:'unknown'},
    listingConfidence:fresh&&complete?'medium':'unknown',locationConfidence:fresh?e?.location?.confidence:'unknown'});
  if(!valid){score.score=0;score.grade='E';score.verdict='non convaincant';score.hardCaps.unshift('Données financières obligatoires manquantes ou invalides : score non calculable.');}
  return {...score, calculable:valid};
}
export function targetPriceForScore(p:RealEstateProjectInputs,target:number) {
  if(!Number.isInteger(target)||target<1||target>100) return {price:null,score:0,reason:'Choisir un score entier entre 1 et 100.'};
  if(!(p.price>0&&p.monthlyRent>0&&p.durationYears>0))return {price:null,score:0,reason:'Prix, loyer et durée de financement requis.'};
  const at=(price:number)=>projectFeasibility({...p,price});
  // Search the negotiation domain only; maintain evidence quality and every other assumption.
  const current=at(p.price);if(current.score>=target)return {price:p.price,score:current.score,reason:'Objectif déjà atteint aux hypothèses actuelles.'};
  const bottom=at(1);
  if(bottom.score<target)return {price:null,score:bottom.score,reason:bottom.hardCaps.join(' ')||'Une baisse du prix seule ne suffit pas avec ces hypothèses.'};
  let lo=1,hi=p.price;
  for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(at(mid).score>=target)lo=mid;else hi=mid;}
  const price=Math.floor(lo);
  return {price,score:at(price).score,reason:'Prix maximal arrondi à l’euro inférieur, à financement, loyers, travaux et qualité des preuves constants.'};
}
