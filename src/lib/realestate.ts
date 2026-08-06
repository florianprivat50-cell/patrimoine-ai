import { RealEstateProjectInputs } from "../types";
import { irr, monthlyPayment, npv, remainingBalance } from "./finance";

export interface ProjectResults {
  totalCost: number;
  financed: number;
  monthlyLoanPayment: number; // assurance incluse
  grossYieldPct: number;
  netYieldPct: number;
  netAfterTaxYieldPct: number;
  monthlyCashflow: number; // après impôt estimé
  yearlyNetIncome: number; // avant impôt
  yearlyNetAfterTax: number;
  savingsEffort: number; // effort d'épargne mensuel si cash-flow négatif
  returnOnEquityPct: number | null; // rentabilité des fonds propres (cash-flow + amortissement) / apport
  irrPct: number | null; // TRI sur 20 ans avec revente
  npv20: number; // VAN à 4 % sur 20 ans
  paybackYears: number | null; // récupération de l'apport par les cash-flows
  breakEvenRent: number; // loyer mensuel pour cash-flow nul
  maxPrice: number | null; // prix d'achat max pour cash-flow nul (mêmes autres hypothèses)
  effectiveMonthlyRent: number;
  grossMonthlyRent: number; // loyers logements + commercial, hors vacance
}

/** Moteur de calcul du projet immobilier. Toutes les étapes sont détaillées dans l'UI. */
export function computeProject(p: RealEstateProjectInputs): ProjectResults {
  const notary = (p.price * p.notaryFeesPct) / 100;
  const totalCost =
    p.price + p.agencyFees + notary + p.works + p.furniture + p.bankFees;
  const financed = Math.max(0, totalCost - p.downPayment);
  const basePayment = monthlyPayment(financed, p.ratePct, p.durationYears);
  const insurance = (financed * p.insurancePctYearly) / 100 / 12;
  const monthlyLoanPayment = basePayment + insurance;

  const grossMonthlyRent = p.monthlyRent + (p.commercialMonthlyRent ?? 0);
  const effectiveMonthlyRent = grossMonthlyRent * (1 - p.vacancyPct / 100);
  const yearlyRent = effectiveMonthlyRent * 12;
  const yearlyCosts =
    p.monthlyCharges * 12 +
    p.propertyTaxYearly +
    p.ownerInsuranceYearly +
    (yearlyRent * p.managementPct) / 100 +
    (yearlyRent * p.maintenancePct) / 100;
  const yearlyNetIncome = yearlyRent - yearlyCosts;
  const tax = Math.max(0, yearlyNetIncome) * (p.taxRatePct / 100);
  const yearlyNetAfterTax = yearlyNetIncome - tax;

  const grossYieldPct = totalCost > 0 ? ((grossMonthlyRent * 12) / totalCost) * 100 : 0;
  const netYieldPct = totalCost > 0 ? (yearlyNetIncome / totalCost) * 100 : 0;
  const netAfterTaxYieldPct = totalCost > 0 ? (yearlyNetAfterTax / totalCost) * 100 : 0;

  const monthlyCashflow = yearlyNetAfterTax / 12 - monthlyLoanPayment;
  const savingsEffort = monthlyCashflow < 0 ? -monthlyCashflow : 0;

  // Rentabilité des fonds propres année 1 : (cash-flow annuel + capital amorti) / apport
  const balanceAfter1y = remainingBalance(financed, p.ratePct, p.durationYears, 12);
  const principalPaidY1 = financed - balanceAfter1y;
  const returnOnEquityPct =
    p.downPayment > 0
      ? ((monthlyCashflow * 12 + principalPaidY1) / p.downPayment) * 100
      : null;

  // TRI sur 20 ans : apport initial négatif, cash-flows annuels, revente nette du CRD en année 20
  const horizon = 20;
  const flows: number[] = [-Math.max(1, p.downPayment)];
  let rent = effectiveMonthlyRent * 12;
  for (let y = 1; y <= horizon; y++) {
    const costs =
      p.monthlyCharges * 12 +
      p.propertyTaxYearly +
      p.ownerInsuranceYearly +
      (rent * (p.managementPct + p.maintenancePct)) / 100;
    const net = rent - costs;
    const afterTax = net - Math.max(0, net) * (p.taxRatePct / 100);
    const loanYear = y <= p.durationYears ? monthlyLoanPayment * 12 : 0;
    let cf = afterTax - loanYear;
    if (y === horizon) {
      const resale = p.price * Math.pow(1 + p.valueGrowthPct / 100, horizon);
      const crd = y < p.durationYears ? remainingBalance(financed, p.ratePct, p.durationYears, y * 12) : 0;
      cf += resale * 0.93 - crd; // 7 % de frais de revente estimés
    }
    flows.push(cf);
    rent *= 1 + p.rentGrowthPct / 100;
  }
  const irrPct = irr(flows);
  const npv20 = npv(flows, 4);

  // Délai de récupération de l'apport par les cash-flows cumulés (hors revente)
  let cumulative = 0;
  let paybackYears: number | null = null;
  let r2 = effectiveMonthlyRent * 12;
  for (let y = 1; y <= 40; y++) {
    const costs =
      p.monthlyCharges * 12 +
      p.propertyTaxYearly +
      p.ownerInsuranceYearly +
      (r2 * (p.managementPct + p.maintenancePct)) / 100;
    const net = r2 - costs;
    const afterTax = net - Math.max(0, net) * (p.taxRatePct / 100);
    const loanYear = y <= p.durationYears ? monthlyLoanPayment * 12 : 0;
    cumulative += afterTax - loanYear;
    if (cumulative >= p.downPayment && paybackYears === null) paybackYears = y;
    r2 *= 1 + p.rentGrowthPct / 100;
  }

  // Loyer d'équilibre : loyer brut mensuel tel que cash-flow = 0
  // cash-flow = loyer_eff×12 × (1 − gestion − entretien − impôt simplifié) − coûts fixes − crédit
  const fixedYear = p.monthlyCharges * 12 + p.propertyTaxYearly + p.ownerInsuranceYearly;
  const share = 1 - (p.managementPct + p.maintenancePct) / 100;
  // approximation sans impôt (affichée comme telle)
  const breakEvenRent =
    share > 0
      ? (fixedYear + monthlyLoanPayment * 12) / 12 / share / (1 - p.vacancyPct / 100)
      : 0;

  // Prix max pour cash-flow ≥ 0 (recherche dichotomique sur le prix)
  let maxPrice: number | null = null;
  let lo = 0;
  let hi = p.price * 3 + 100000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const test = computeCashflowForPrice({ ...p, price: mid });
    if (test >= 0) lo = mid;
    else hi = mid;
  }
  maxPrice = lo > 1000 ? lo : null;

  return {
    totalCost,
    financed,
    monthlyLoanPayment,
    grossYieldPct,
    netYieldPct,
    netAfterTaxYieldPct,
    monthlyCashflow,
    yearlyNetIncome,
    yearlyNetAfterTax,
    savingsEffort,
    returnOnEquityPct,
    irrPct,
    npv20,
    paybackYears,
    breakEvenRent,
    maxPrice,
    effectiveMonthlyRent,
    grossMonthlyRent,
  };
}

/** Prix d'achat maximal pour atteindre une rentabilité nette après fiscalité cible (recherche dichotomique) */
export function maxPriceForTargetYield(
  p: RealEstateProjectInputs,
  targetNetAfterTaxPct: number
): number | null {
  if (targetNetAfterTaxPct <= 0) return null;
  let lo = 0;
  let hi = p.price * 3 + 200000;
  const yieldAt = (price: number) => computeProject({ ...p, price }).netAfterTaxYieldPct;
  if (yieldAt(1000) < targetNetAfterTaxPct) return null; // même quasi gratuit, la cible n'est pas atteinte
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (yieldAt(mid) >= targetNetAfterTaxPct) lo = mid;
    else hi = mid;
  }
  return lo > 1000 ? lo : null;
}

function computeCashflowForPrice(p: RealEstateProjectInputs): number {
  const notary = (p.price * p.notaryFeesPct) / 100;
  const totalCost = p.price + p.agencyFees + notary + p.works + p.furniture + p.bankFees;
  const financed = Math.max(0, totalCost - p.downPayment);
  const pay =
    monthlyPayment(financed, p.ratePct, p.durationYears) +
    (financed * p.insurancePctYearly) / 100 / 12;
  const rentYear = (p.monthlyRent + (p.commercialMonthlyRent ?? 0)) * (1 - p.vacancyPct / 100) * 12;
  const costs =
    p.monthlyCharges * 12 +
    p.propertyTaxYearly +
    p.ownerInsuranceYearly +
    (rentYear * (p.managementPct + p.maintenancePct)) / 100;
  const net = rentYear - costs;
  const afterTax = net - Math.max(0, net) * (p.taxRatePct / 100);
  return afterTax / 12 - pay;
}

export type ScenarioKind = "prudent" | "realiste" | "optimiste";

export const SCENARIO_LABELS: Record<ScenarioKind, string> = {
  prudent: "Prudent",
  realiste: "Réaliste",
  optimiste: "Optimiste",
};

/** Hypothèses dégradées / améliorées, affichées explicitement dans l'UI */
export function scenarioInputs(
  p: RealEstateProjectInputs,
  kind: ScenarioKind
): RealEstateProjectInputs {
  if (kind === "realiste") return p;
  if (kind === "prudent") {
    return {
      ...p,
      vacancyPct: Math.min(30, p.vacancyPct + 5),
      works: Math.round(p.works * 1.15),
      monthlyRent: Math.round(p.monthlyRent * 0.95),
      commercialMonthlyRent: Math.round((p.commercialMonthlyRent ?? 0) * 0.95),
      monthlyCharges: Math.round(p.monthlyCharges * 1.1),
      valueGrowthPct: p.valueGrowthPct - 1,
    };
  }
  return {
    ...p,
    vacancyPct: Math.max(0, p.vacancyPct - 2),
    monthlyRent: Math.round(p.monthlyRent * 1.05),
    commercialMonthlyRent: Math.round((p.commercialMonthlyRent ?? 0) * 1.05),
    valueGrowthPct: p.valueGrowthPct + 1,
  };
}
