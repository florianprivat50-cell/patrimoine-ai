import type { RealEstateProject, RealEstateProjectInputs } from '../types';
import { computeProject, scenarioInputs } from './realestate';

export type SharedFinance = Pick<RealEstateProjectInputs, 'downPayment'|'ratePct'|'durationYears'|'insurancePctYearly'>;
const fresh = (date: string | undefined, now: number) => {
  const age = now - Date.parse(date || '');
  return Number.isFinite(age) && age >= 0 && age < 90 * 86400000;
};

/** Decision support for long-term rentals. All figures deliberately exclude income tax. */
export function rentalDecision(input: RealEstateProjectInputs, now = Date.now()) {
  const p = {...input, taxRatePct:0};
  const issues:string[] = [];
  if ('mobileDraft' in input && input.mobileDraft) issues.push('Terminer et enregistrer l’analyse de ce brouillon.');
  if (!(Number.isFinite(p.price) && p.price > 0)) issues.push('Renseigner un prix d’achat positif.');
  if (!(Number.isFinite(p.surface) && p.surface! > 0)) issues.push('Renseigner la surface du bien.');
  if (!(Number.isFinite(p.monthlyRent) && p.monthlyRent >= 0 && Number.isFinite(p.commercialMonthlyRent ?? 0) && (p.commercialMonthlyRent ?? 0) >= 0 && p.monthlyRent + (p.commercialMonthlyRent ?? 0) > 0)) issues.push('Renseigner les loyers mensuels hors charges.');
  const costs = [p.agencyFees,p.notaryFeesPct,p.works,p.furniture,p.bankFees,p.downPayment,p.ratePct,p.insurancePctYearly,p.monthlyCharges,p.propertyTaxYearly,p.ownerInsuranceYearly,p.managementPct,p.maintenancePct];
  if (!costs.every(n=>Number.isFinite(n)&&n>=0)) issues.push('Corriger les frais, charges et conditions de crédit.');
  if (p.ratePct>30||p.insurancePctYearly>10||p.notaryFeesPct>30) issues.push('Taux de crédit, d’assurance ou de frais d’acquisition hors limites.');
  if (!(Number.isInteger(p.durationYears)&&p.durationYears>=1&&p.durationYears<=40)) issues.push('Choisir une durée de crédit entière entre 1 et 40 ans.');
  if (!(Number.isFinite(p.vacancyPct)&&p.vacancyPct>=0&&p.vacancyPct<=100&&p.managementPct+p.maintenancePct<100)) issues.push('Vérifier la vacance, les frais de gestion et l’entretien.');
  if (p.rentalMode==='saisonnier') issues.push('Ce comparateur concerne la location longue durée. Le saisonnier demande une analyse distincte.');
  const total=p.price*(1+p.notaryFeesPct/100)+p.agencyFees+p.works+p.furniture+p.bankFees;
  if (p.downPayment>total) issues.push('L’apport dépasse le coût total : réduisez-le pour ce bien.');
  if (issues.length) return {calculable:false as const, issues, input:p};

  const result=computeProject(p),stressInput=scenarioInputs(p,'prudent'),stress=computeProject(stressInput);
  const evidence=p.evidence, current=fresh(evidence?.retrievedAt,now);
  const conflicts=(evidence?.fields??[]).filter(f=>f.status==='conflict');
  const saleCount=current?(evidence?.market?.comparableSaleCount??0):0;
  const rentCount=current?(evidence?.market?.comparableRentCount??0):0;
  const gaps:string[]=[];
  if (!p.city?.trim()) gaps.push('Localisation à préciser.');
  if (!current) gaps.push('Références locales absentes, expirées ou datées dans le futur.');
  if (!current||!evidence?.location) gaps.push('Adresse à confirmer pour vérifier le quartier et les risques.');
  if (saleCount<5) gaps.push('Prix demandé : pas assez de ventes comparables récentes.');
  if (rentCount<3) gaps.push('Loyer annoncé : références locatives insuffisantes.');
  const labels:Record<string,string>={price:'prix',surface:'surface',monthlyRent:'loyer',city:'ville',address:'adresse',works:'travaux',propertyType:'type de bien'};
  if (conflicts.length) gaps.push('Informations contradictoires : '+conflicts.map(f=>labels[f.field]||'une donnée de l’annonce').join(', ')+'.');
  if (p.works===0) gaps.push('Travaux à 0 € : faire confirmer l’état du bien par une visite et des devis.');
  if (p.propertyTaxYearly===0) gaps.push('Taxe foncière à 0 € : demander le dernier avis.');
  if (p.ownerInsuranceYearly===0) gaps.push('Assurance propriétaire à 0 € : demander un devis.');
  if (p.monthlyCharges===0) gaps.push('Charges à 0 € : vérifier les dépenses non récupérables.');
  const status=result.monthlyCashflow<0?'Effort mensuel à prévoir':stress.monthlyCashflow<0?'Équilibre sensible aux imprévus':'Marge positive dans les deux scénarios';
  const next=result.monthlyCashflow<0
    ? 'Vérifiez que cet effort est supportable, puis testez une négociation ou un autre financement.'
    : stress.monthlyCashflow<0
      ? 'Chiffrez votre réserve de sécurité et confirmez les loyers et travaux avant une offre.'
      : 'La simulation justifie de poursuivre les vérifications ; elle ne valide pas l’achat.';
  return {calculable:true as const, issues, input:p, result, stress, stressInput, status, next, gaps,
    saleCount,rentCount,referenceDate:current?evidence?.retrievedAt:null,
    targetPrice:result.maxPrice===null?null:Math.min(p.price,Math.floor(result.maxPrice)),
    visitQuestions:[
      'Demander les baux, loyers hors charges, impayés et historique de vacance.',
      'Obtenir le DPE, les diagnostics et l’état des risques correspondant à l’adresse.',
      'Faire chiffrer les travaux privatifs et collectifs ; demander les documents de copropriété si applicable.',
      'Confirmer les charges, la taxe foncière, l’assurance et une proposition de financement.',
    ]};
}

export function compareRentals(projects:RealEstateProject[], shared?:SharedFinance) {
  return projects.map(project=>({project,decision:rentalDecision({...project,...shared})}));
}
