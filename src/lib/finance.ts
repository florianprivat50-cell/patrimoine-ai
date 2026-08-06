// Fonctions financières de base — toutes les formules sont documentées
// et affichées dans l'application (panneau « Détail du calcul »).

/** Mensualité d'un prêt amortissable : M = C × t/12 / (1 − (1 + t/12)^−n) */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Capital restant dû après m mensualités payées */
export function remainingBalance(
  principal: number,
  annualRatePct: number,
  years: number,
  monthsPaid: number
): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const m = Math.min(monthsPaid, n);
  if (r === 0) return principal * (1 - m / n);
  const pay = monthlyPayment(principal, annualRatePct, years);
  return principal * Math.pow(1 + r, m) - pay * ((Math.pow(1 + r, m) - 1) / r);
}

/** Intérêts totaux restants sur un crédit (approximation par la mensualité) */
export function remainingInterest(
  remainingCapital: number,
  monthlyPay: number,
  annualRatePct: number
): { months: number; totalInterest: number } {
  if (remainingCapital <= 0 || monthlyPay <= 0) return { months: 0, totalInterest: 0 };
  const r = annualRatePct / 100 / 12;
  if (r === 0) {
    return { months: Math.ceil(remainingCapital / monthlyPay), totalInterest: 0 };
  }
  // n = −ln(1 − C·r/M) / ln(1+r)
  const inner = 1 - (remainingCapital * r) / monthlyPay;
  if (inner <= 0) return { months: Infinity, totalInterest: Infinity };
  const n = Math.ceil(-Math.log(inner) / Math.log(1 + r));
  return { months: n, totalInterest: n * monthlyPay - remainingCapital };
}

/** TRI annuel par bissection sur des flux annuels (flux[0] = investissement négatif) */
export function irr(cashflows: number[]): number | null {
  const npv = (rate: number) =>
    cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
  let lo = -0.99;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/** VAN au taux d'actualisation donné (%) */
export function npv(cashflows: number[], discountPct: number): number {
  const r = discountPct / 100;
  return cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i), 0);
}

/** Valeur future d'une épargne mensuelle à rendement annuel donné */
export function futureValue(
  initial: number,
  monthly: number,
  annualRatePct: number,
  years: number
): number {
  const r = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  if (r === 0) return initial + monthly * n;
  return initial * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
}

/** Nombre de mois pour atteindre une cible avec versements et rendement */
export function monthsToTarget(
  current: number,
  target: number,
  monthly: number,
  annualRatePct: number
): number | null {
  if (current >= target) return 0;
  if (monthly <= 0 && annualRatePct <= 0) return null;
  const r = annualRatePct / 100 / 12;
  let value = current;
  for (let m = 1; m <= 1200; m++) {
    value = value * (1 + r) + monthly;
    if (value >= target) return m;
  }
  return null;
}

export const fmtEUR = (v: number, digits = 0) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(v);

export const fmtPct = (v: number, digits = 1) =>
  `${v.toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;

export const fmtNum = (v: number, digits = 0) =>
  v.toLocaleString("fr-FR", { maximumFractionDigits: digits });
