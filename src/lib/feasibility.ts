export type EvidenceConfidence = "high" | "medium" | "low" | "unknown";

export interface MarketEvidence {
  locationLabel?: string;
  populationTrendPct?: number;
  vacancyRatePct?: number;
  medianSalePricePerSqm?: number;
  subjectPricePerSqm?: number;
  medianRentPerSqm?: number;
  estimatedMarketRentMonthly?: number;
  comparableRentCount?: number;
  comparableSaleCount?: number;
  rentalDemandScore?: number; // 0..100
  resaleLiquidityScore?: number; // 0..100
  amenitiesScore?: number; // 0..100
  dataConfidence?: EvidenceConfidence;
}

export interface PropertyRiskEvidence {
  dpe?: string;
  majorWorksRiskScore?: number; // 0 = faible risque, 100 = risque très élevé
  coproRiskScore?: number; // 0..100
  geoRiskScore?: number; // 0..100
  tenantabilityScore?: number; // 0..100
  dataConfidence?: EvidenceConfidence;
}

export interface ScenarioFeasibilityInput {
  monthlyCashflow: number;
  monthlyDebtService: number;
  yearlyNetOperatingIncome: number;
  netAfterTaxYieldPct: number;
}

export interface FeasibilityInputs {
  askingPrice: number;
  totalCost: number;
  subjectMonthlyRent: number;
  targetNetYieldPct?: number;
  breakEvenRent: number;
  realistic: ScenarioFeasibilityInput;
  prudent: ScenarioFeasibilityInput;
  optimistic: ScenarioFeasibilityInput;
  market?: MarketEvidence;
  propertyRisk?: PropertyRiskEvidence;
  listingConfidence?: EvidenceConfidence;
  locationConfidence?: EvidenceConfidence;
}

export interface FeasibilityComponent {
  key: "economics" | "market" | "resilience" | "property" | "evidence";
  label: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface FeasibilityResult {
  score: number;
  rawScore: number;
  grade: "A" | "B" | "C" | "D" | "E";
  verdict: "très solide" | "solide" | "à négocier" | "fragile" | "non convaincant";
  components: FeasibilityComponent[];
  hardCaps: string[];
  redFlags: string[];
  positives: string[];
  priceGapPct?: number;
  rentGapPct?: number;
  dscrRealistic: number;
  dscrPrudent: number;
}

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const scoreRange = (value: number, bad: number, good: number) =>
  good === bad ? 50 : clamp(((value - bad) / (good - bad)) * 100);

function confidenceScore(c?: EvidenceConfidence): number {
  switch (c) {
    case "high": return 100;
    case "medium": return 72;
    case "low": return 38;
    default: return 12;
  }
}

function dscr(s: ScenarioFeasibilityInput): number {
  const yearlyDebt = Math.max(1, s.monthlyDebtService * 12);
  return s.yearlyNetOperatingIncome / yearlyDebt;
}

function weightedAverage(values: Array<[number | undefined, number]>, fallback = 50): number {
  const valid = values.filter(([v]) => typeof v === "number" && Number.isFinite(v)) as Array<[number, number]>;
  if (!valid.length) return fallback;
  const totalWeight = valid.reduce((s, [, w]) => s + w, 0);
  return valid.reduce((s, [v, w]) => s + v * w, 0) / totalWeight;
}

/**
 * Score de faisabilité 0..100 fondé sur les chiffres ET la qualité des preuves.
 * Les "hard caps" empêchent une note artificiellement élevée si le projet ne tient
 * qu'avec des hypothèses optimistes ou si les données de marché sont insuffisantes.
 */
export function computeFeasibilityScore(input: FeasibilityInputs): FeasibilityResult {
  const market = input.market ?? {};
  const risks = input.propertyRisk ?? {};
  const dscrRealistic = dscr(input.realistic);
  const dscrPrudent = dscr(input.prudent);

  const targetYield = input.targetNetYieldPct ?? 5.5;
  const yieldScore = scoreRange(input.realistic.netAfterTaxYieldPct, Math.max(0, targetYield - 3), targetYield + 2);
  const cashflowScore = scoreRange(input.realistic.monthlyCashflow, -350, 350);
  const dscrScore = scoreRange(dscrRealistic, 0.80, 1.35);
  const economics = weightedAverage([
    [yieldScore, 0.38],
    [cashflowScore, 0.34],
    [dscrScore, 0.28],
  ]);

  const priceGapPct = market.medianSalePricePerSqm && market.subjectPricePerSqm
    ? ((market.subjectPricePerSqm / market.medianSalePricePerSqm) - 1) * 100
    : undefined;
  const pricePositionScore = priceGapPct === undefined ? undefined : clamp(72 - priceGapPct * 2.4);

  const rentGapPct = market.estimatedMarketRentMonthly && input.subjectMonthlyRent
    ? ((input.subjectMonthlyRent / market.estimatedMarketRentMonthly) - 1) * 100
    : undefined;
  const rentCredibilityScore = rentGapPct === undefined
    ? undefined
    : rentGapPct <= 5
      ? clamp(90 - Math.abs(rentGapPct) * 1.2)
      : clamp(90 - rentGapPct * 3.2);

  const transactionDepth = market.comparableSaleCount === undefined
    ? undefined
    : clamp((market.comparableSaleCount / 20) * 100);
  const rentalDepth = market.comparableRentCount === undefined
    ? undefined
    : clamp((market.comparableRentCount / 12) * 100);
  const demographicScore = market.populationTrendPct === undefined
    ? undefined
    : scoreRange(market.populationTrendPct, -2.0, 2.0);
  const vacancyScore = market.vacancyRatePct === undefined
    ? undefined
    : clamp(100 - scoreRange(market.vacancyRatePct, 3, 18));

  const marketScore = weightedAverage([
    [market.rentalDemandScore, 0.24],
    [market.resaleLiquidityScore, 0.20],
    [pricePositionScore, 0.15],
    [rentCredibilityScore, 0.15],
    [demographicScore, 0.08],
    [vacancyScore, 0.08],
    [transactionDepth, 0.05],
    [rentalDepth, 0.05],
  ]);

  const prudentCashflowScore = scoreRange(input.prudent.monthlyCashflow, -450, 200);
  const prudentDscrScore = scoreRange(dscrPrudent, 0.75, 1.20);
  const breakEvenMarginPct = input.subjectMonthlyRent > 0
    ? ((input.subjectMonthlyRent - input.breakEvenRent) / input.subjectMonthlyRent) * 100
    : -100;
  const breakEvenScore = scoreRange(breakEvenMarginPct, -20, 20);
  const resilience = weightedAverage([
    [prudentCashflowScore, 0.42],
    [prudentDscrScore, 0.38],
    [breakEvenScore, 0.20],
  ]);

  const dpeScore = risks.dpe
    ? ({ A: 100, B: 95, C: 86, D: 72, E: 48, F: 24, G: 8 } as Record<string, number>)[risks.dpe.toUpperCase()] ?? 50
    : undefined;
  const property = weightedAverage([
    [dpeScore, 0.20],
    [risks.majorWorksRiskScore === undefined ? undefined : 100 - risks.majorWorksRiskScore, 0.28],
    [risks.coproRiskScore === undefined ? undefined : 100 - risks.coproRiskScore, 0.17],
    [risks.geoRiskScore === undefined ? undefined : 100 - risks.geoRiskScore, 0.15],
    [risks.tenantabilityScore, 0.20],
  ]);

  const evidence = weightedAverage([
    [confidenceScore(input.listingConfidence), 0.38],
    [confidenceScore(input.locationConfidence), 0.34],
    [confidenceScore(market.dataConfidence), 0.18],
    [confidenceScore(risks.dataConfidence), 0.10],
  ], 12);

  const components: FeasibilityComponent[] = [
    { key: "economics", label: "Économie du deal", score: economics, weight: 35, explanation: "Rendement net après fiscalité, cash-flow réaliste et couverture de la dette." },
    { key: "market", label: "Marché local", score: marketScore, weight: 25, explanation: "Demande locative, liquidité, profondeur des comparables et positionnement prix/loyer." },
    { key: "resilience", label: "Résistance au stress", score: resilience, weight: 20, explanation: "Scénario prudent, DSCR prudent et marge au loyer d'équilibre." },
    { key: "property", label: "Qualité / risques du bien", score: property, weight: 12, explanation: "DPE, travaux, copropriété, risques géographiques et facilité de location." },
    { key: "evidence", label: "Qualité des données", score: evidence, weight: 8, explanation: "Fiabilité de l'annonce, de la localisation et des données de marché utilisées." },
  ];

  const rawScore = components.reduce((sum, c) => sum + c.score * (c.weight / 100), 0);
  let score = rawScore;
  const hardCaps: string[] = [];
  const redFlags: string[] = [];
  const positives: string[] = [];

  if (input.realistic.monthlyCashflow < 0 && input.optimistic.monthlyCashflow >= 0) {
    score = Math.min(score, 55);
    hardCaps.push("Cash-flow positif uniquement en scénario optimiste : note plafonnée à 55.");
    redFlags.push("Le deal dépend d'hypothèses favorables pour devenir auto-financé.");
  }
  if (dscrRealistic < 0.95) {
    score = Math.min(score, 49);
    hardCaps.push("DSCR réaliste inférieur à 0,95 : note plafonnée à 49.");
    redFlags.push("Les revenus nets couvrent insuffisamment le service de la dette.");
  }
  if (dscrPrudent < 0.85) {
    score = Math.min(score, 58);
    hardCaps.push("DSCR prudent inférieur à 0,85 : résistance au stress insuffisante.");
  }
  if (evidence < 45) {
    score = Math.min(score, 68);
    hardCaps.push("Données insuffisamment vérifiées : note plafonnée à 68 tant que les preuves manquent.");
    redFlags.push("La rentabilité affichée repose encore sur des données à confirmer.");
  }
  if (rentGapPct !== undefined && rentGapPct > 15) {
    score -= Math.min(12, (rentGapPct - 15) * 0.6);
    redFlags.push(`Loyer saisi ${rentGapPct.toFixed(0)} % au-dessus de l'estimation de marché.`);
  }
  if (priceGapPct !== undefined && priceGapPct > 12) {
    score -= Math.min(10, (priceGapPct - 12) * 0.45);
    redFlags.push(`Prix au m² ${priceGapPct.toFixed(0)} % au-dessus de la médiane locale observée.`);
  }
  if ((risks.geoRiskScore ?? 0) >= 75) {
    score -= 8;
    redFlags.push("Exposition géographique élevée identifiée : vérification Géorisques indispensable.");
  }
  if (["F", "G"].includes((risks.dpe ?? "").toUpperCase())) {
    score -= 8;
    redFlags.push("DPE F/G : risque réglementaire, locatif et travaux à intégrer.");
  }

  if (input.realistic.monthlyCashflow > 150) positives.push("Cash-flow réaliste supérieur à 150 €/mois.");
  if (dscrRealistic >= 1.20) positives.push("Bonne couverture de dette en scénario réaliste.");
  if (dscrPrudent >= 1.05) positives.push("Le projet reste correctement couvert en scénario prudent.");
  if (priceGapPct !== undefined && priceGapPct <= -8) positives.push("Prix au m² sensiblement sous la médiane locale observée.");
  if (rentGapPct !== undefined && Math.abs(rentGapPct) <= 5) positives.push("Loyer retenu cohérent avec les comparables de marché.");

  score = Math.round(clamp(score));
  const grade: FeasibilityResult["grade"] = score >= 82 ? "A" : score >= 70 ? "B" : score >= 58 ? "C" : score >= 45 ? "D" : "E";
  const verdict: FeasibilityResult["verdict"] = score >= 82 ? "très solide" : score >= 70 ? "solide" : score >= 58 ? "à négocier" : score >= 45 ? "fragile" : "non convaincant";

  return {
    score,
    rawScore: Math.round(rawScore),
    grade,
    verdict,
    components,
    hardCaps,
    redFlags,
    positives,
    priceGapPct,
    rentGapPct,
    dscrRealistic,
    dscrPrudent,
  };
}
