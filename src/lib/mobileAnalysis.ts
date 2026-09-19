import type { RealEstateProjectInputs } from '../types';
import { computeProject, scenarioInputs } from './realestate';
import { projectFeasibility } from './projectAnalysis';

/** The mobile view is explicitly before tax; no inferred local rent or tax regime. */
export function mobileAnalysis(input: RealEstateProjectInputs) {
  const p = { ...input, taxRatePct: 0 };
  const r = computeProject(p);
  const adverse = scenarioInputs(p, 'prudent');
  const stress = computeProject(adverse);
  const feasibility = projectFeasibility(p, {realiste:r, prudent:stress, optimiste:computeProject(scenarioInputs(p, 'optimiste'))});
  feasibility.components = feasibility.components.map(c => c.key === 'economics'
    ? {...c, label:'Équilibre financier', explanation:`Rendement net d’exploitation avant impôt (cible ${p.targetNetYieldPct ?? 5.5} %), trésorerie et couverture du crédit.`}
    : c);
  const insurance = r.financed * p.insurancePctYearly / 1200;
  const checks = ['Loyers et vacance : confirmer par des baux ou des références locatives récentes.',
    'Impôts non calculés : le résultat dépendra du régime de détention et de location.'];
  if (p.works === 0) checks.push('Travaux à 0 € : faire confirmer l’état du bien et les travaux de copropriété. Le scénario dégradé ne crée pas de devis.');
  if (p.ownerInsuranceYearly === 0) checks.push('Assurance propriétaire à 0 € : vérifier le coût et la couverture.');
  if (p.monthlyCharges === 0) checks.push('Charges à 0 € : vérifier les dépenses restant à la charge du propriétaire.');
  if (p.maintenancePct === 0) checks.push('Aucune réserve pour entretien courant renseignée.');
  if (p.managementPct === 0) checks.push('Gestion à 0 % : suppose une gestion personnelle sans frais de prestataire.');
  const age = p.evidence ? Date.now() - Date.parse(p.evidence.retrievedAt) : Infinity;
  if (!(age >= 0 && age < 90 * 86400000)) checks.push('Références locales absentes ou datées de plus de 90 jours : actualiser la collecte.');
  if (p.rentalMode === 'saisonnier') checks.push('Dossier saisonnier : cette vue utilise les loyers mensuels saisis. Vérifier leur moyenne annuelle, incluant saisonnalité et vacance.');
  return {
    total: r.totalCost, loan: r.financed, credit: r.monthlyLoanPayment - insurance, insurance,
    effectiveRent: r.effectiveMonthlyRent, operating: r.effectiveMonthlyRent - r.yearlyNetIncome / 12,
    cashflow: r.monthlyCashflow, grossYield: r.grossYieldPct, netYield: r.netYieldPct,
    monthlyPayment: r.monthlyLoanPayment, breakEvenRent: r.breakEvenRent,
    stressCashflow: stress.monthlyCashflow, stressVacancy: adverse.vacancyPct, checks, feasibility,
  };
}
