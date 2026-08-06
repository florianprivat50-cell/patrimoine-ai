import { Asset, AssetCategory, Goal, Liability, Profile } from "../types";
import { remainingInterest } from "./finance";

export interface Allocation {
  category: AssetCategory;
  value: number;
  pct: number;
}

export interface Metrics {
  grossAssets: number;
  totalDebts: number;
  netWorth: number;
  allocation: Allocation[];
  totalIncome: number; // revenus du foyer
  totalLoanPayments: number; // mensualités + assurances
  debtRatioPct: number; // mensualités / revenus
  savingsRatePct: number;
  liquid: number; // liquidités disponibles
  emergencyMonths: number | null; // mois de dépenses couverts
  passiveIncomeMonthly: number; // loyers nets estimés + intérêts
  liquidSharePct: number;
  realEstateSharePct: number;
  riskySharePct: number; // crypto + actions risque élevé
  resteAVivre: number;
  investCapacity: number; // capacité d'investissement estimée
  costlyDebts: Liability[]; // taux > 4 % hors immobilier
}

export function computeMetrics(
  assets: Asset[],
  liabilities: Liability[],
  profile: Profile | null
): Metrics {
  const gross = assets.reduce((s, a) => s + a.currentValue * (a.ownershipPct / 100), 0);
  const debts = liabilities.reduce((s, l) => s + l.remainingCapital, 0);
  const netWorth = gross - debts;

  const byCat = new Map<AssetCategory, number>();
  for (const a of assets) {
    const v = a.currentValue * (a.ownershipPct / 100);
    byCat.set(a.category, (byCat.get(a.category) ?? 0) + v);
  }
  const allocation: Allocation[] = (
    ["immobilier", "liquidites", "financier", "crypto", "societe", "autre"] as AssetCategory[]
  )
    .filter((c) => (byCat.get(c) ?? 0) > 0)
    .map((c) => ({
      category: c,
      value: byCat.get(c)!,
      pct: gross > 0 ? ((byCat.get(c) ?? 0) / gross) * 100 : 0,
    }));

  const totalIncome = (profile?.netMonthlyIncome ?? 0) + (profile?.partnerMonthlyIncome ?? 0);
  const totalLoanPayments = liabilities.reduce(
    (s, l) => s + l.monthlyPayment + l.insuranceMonthly,
    0
  );
  const debtRatioPct = totalIncome > 0 ? (totalLoanPayments / totalIncome) * 100 : 0;
  const savingsRatePct =
    totalIncome > 0 ? ((profile?.monthlySavings ?? 0) / totalIncome) * 100 : 0;

  const liquid = assets
    .filter((a) => a.category === "liquidites")
    .reduce((s, a) => s + a.currentValue * (a.ownershipPct / 100), 0);
  const monthlyExpenses =
    profile?.monthlyExpenses && profile.monthlyExpenses > 0
      ? profile.monthlyExpenses
      : totalIncome > 0
        ? totalIncome - (profile?.monthlySavings ?? 0)
        : null;
  const emergencyMonths = monthlyExpenses ? liquid / monthlyExpenses : null;

  // Revenus passifs : loyers nets de charges + intérêts des livrets (estimation)
  let passive = 0;
  for (const a of assets) {
    if (a.category === "immobilier" && a.monthlyRent) {
      const rent = a.monthlyRent * (1 - (a.vacancyPct ?? 0) / 100);
      const costs =
        (a.monthlyCharges ?? 0) +
        (a.propertyTax ?? 0) / 12 +
        (a.insuranceYearly ?? 0) / 12 +
        (rent * (a.managementPct ?? 0)) / 100;
      passive += Math.max(0, (rent - costs) * (a.ownershipPct / 100));
    }
    if (a.category === "liquidites" && a.ratePct) {
      passive += (a.currentValue * (a.ratePct / 100)) / 12;
    }
  }

  const realEstate = byCat.get("immobilier") ?? 0;
  const crypto = byCat.get("crypto") ?? 0;
  const riskyFinancial = assets
    .filter((a) => a.category === "financier" && a.riskLevel === "élevé")
    .reduce((s, a) => s + a.currentValue * (a.ownershipPct / 100), 0);

  const resteAVivre = totalIncome - totalLoanPayments;
  // Capacité d'investissement : épargne mensuelle disponible sous contrainte de 35 % d'endettement
  const headroom = Math.max(0, totalIncome * 0.35 - totalLoanPayments);
  const investCapacity = Math.min(profile?.monthlySavings ?? 0, headroom + (profile?.monthlySavings ?? 0));

  const costlyDebts = liabilities.filter(
    (l) => l.ratePct > 4 && l.type !== "Crédit immobilier" && l.remainingCapital > 0
  );

  return {
    grossAssets: gross,
    totalDebts: debts,
    netWorth,
    allocation,
    totalIncome,
    totalLoanPayments,
    debtRatioPct,
    savingsRatePct,
    liquid,
    emergencyMonths,
    passiveIncomeMonthly: passive,
    liquidSharePct: gross > 0 ? (liquid / gross) * 100 : 0,
    realEstateSharePct: gross > 0 ? (realEstate / gross) * 100 : 0,
    riskySharePct: gross > 0 ? ((crypto + riskyFinancial) / gross) * 100 : 0,
    resteAVivre,
    investCapacity,
    costlyDebts,
  };
}

export interface SubScore {
  key: string;
  label: string;
  score: number; // 0–100
  weight: number;
  comment: string;
}

export interface HealthScore {
  total: number;
  subs: SubScore[];
  strengths: string[];
  weaknesses: string[];
  actions: string[];
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Score pédagogique sur 100 — pondérations et règles visibles dans l'UI */
export function computeHealthScore(m: Metrics, profile: Profile | null): HealthScore {
  const subs: SubScore[] = [];

  const em = m.emergencyMonths;
  subs.push({
    key: "securite",
    label: "Épargne de sécurité",
    weight: 20,
    score: em === null ? 40 : clamp((em / 6) * 100),
    comment:
      em === null
        ? "Dépenses mensuelles inconnues — complétez votre profil."
        : em >= 6
          ? `${em.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mois de dépenses couverts (cible : 6).`
          : `${em.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mois couverts — la cible pédagogique est 6 mois.`,
  });

  subs.push({
    key: "endettement",
    label: "Taux d'endettement",
    weight: 20,
    score:
      m.totalIncome === 0
        ? 40
        : m.debtRatioPct <= 25
          ? 100
          : m.debtRatioPct <= 35
            ? clamp(100 - (m.debtRatioPct - 25) * 5)
            : clamp(50 - (m.debtRatioPct - 35) * 4),
    comment:
      m.totalIncome === 0
        ? "Revenus non renseignés."
        : `${m.debtRatioPct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} % des revenus consacrés aux crédits (seuil usuel : 35 %).`,
  });

  subs.push({
    key: "epargne",
    label: "Taux d'épargne",
    weight: 15,
    score: clamp((m.savingsRatePct / 20) * 100),
    comment: `${m.savingsRatePct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} % des revenus épargnés (cible pédagogique : 20 %).`,
  });

  const nCat = m.allocation.length;
  const maxShare = Math.max(0, ...m.allocation.map((a) => a.pct));
  subs.push({
    key: "diversification",
    label: "Diversification",
    weight: 15,
    score: clamp(nCat * 20 - Math.max(0, maxShare - 60)),
    comment:
      nCat <= 1
        ? "Patrimoine concentré sur une seule classe d'actifs."
        : `${nCat} classes d'actifs ; la plus grosse pèse ${maxShare.toFixed(0)} %.`,
  });

  subs.push({
    key: "liquidite",
    label: "Liquidité",
    weight: 10,
    score: clamp((m.liquidSharePct / 10) * 100),
    comment: `${m.liquidSharePct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} % du patrimoine immédiatement disponible.`,
  });

  const passiveCover =
    m.totalIncome > 0 ? (m.passiveIncomeMonthly / m.totalIncome) * 100 : 0;
  subs.push({
    key: "passifs",
    label: "Revenus passifs",
    weight: 10,
    score: clamp(passiveCover * 4),
    comment: `${m.passiveIncomeMonthly.toFixed(0)} €/mois de revenus passifs estimés (${passiveCover.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} % des revenus).`,
  });

  subs.push({
    key: "risque",
    label: "Exposition au risque",
    weight: 10,
    score:
      m.riskySharePct <= 10
        ? 100
        : m.riskySharePct <= 25
          ? clamp(100 - (m.riskySharePct - 10) * 3)
          : clamp(55 - (m.riskySharePct - 25) * 2),
    comment: `${m.riskySharePct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} % du patrimoine en actifs très volatils (crypto, actions risquées).`,
  });

  const costly = m.costlyDebts.length;
  subs.push({
    key: "dettes",
    label: "Dettes coûteuses",
    weight: 10,
    score: costly === 0 ? 100 : clamp(100 - costly * 35),
    comment:
      costly === 0
        ? "Aucune dette à taux élevé hors immobilier."
        : `${costly} dette(s) à plus de 4 % hors immobilier.`,
  });

  const total = Math.round(
    subs.reduce((s, x) => s + x.score * x.weight, 0) / subs.reduce((s, x) => s + x.weight, 0)
  );

  const sorted = [...subs].sort((a, b) => b.score - a.score);
  const strengths = sorted.filter((s) => s.score >= 70).slice(0, 3).map((s) => s.label);
  const weaknesses = sorted.filter((s) => s.score < 50).map((s) => s.label);

  const actions: string[] = [];
  for (const s of subs) {
    if (s.score >= 70) continue;
    switch (s.key) {
      case "securite":
        actions.push("Renforcer l'épargne de précaution jusqu'à 6 mois de dépenses.");
        break;
      case "endettement":
        actions.push("Réduire les mensualités de crédit ou augmenter les revenus.");
        break;
      case "epargne":
        actions.push("Augmenter progressivement le taux d'épargne vers 15–20 %.");
        break;
      case "diversification":
        actions.push("Diversifier vers d'autres classes d'actifs (ETF, fonds euros…).");
        break;
      case "liquidite":
        actions.push("Conserver une part liquide d'au moins 10 % du patrimoine.");
        break;
      case "passifs":
        actions.push("Développer des sources de revenus passifs (loyers, dividendes).");
        break;
      case "risque":
        actions.push("Réduire l'exposition aux actifs très volatils.");
        break;
      case "dettes":
        actions.push("Rembourser en priorité les dettes à taux élevé.");
        break;
    }
  }

  return { total, subs, strengths, weaknesses, actions };
}

export interface Priority {
  title: string;
  detail: string;
  severity: "good" | "warning" | "serious";
}

/** Recommandation principale — règles hiérarchisées, toujours justifiées par les chiffres */
export function computePriority(m: Metrics, profile: Profile | null): Priority {
  if (m.grossAssets === 0 && m.totalDebts === 0) {
    return {
      title: "Complétez votre patrimoine",
      detail:
        "Ajoutez vos comptes, biens et crédits pour obtenir un diagnostic chiffré. L'analyse s'affine à chaque donnée ajoutée.",
      severity: "warning",
    };
  }
  if (m.costlyDebts.length > 0) {
    const worst = [...m.costlyDebts].sort((a, b) => b.ratePct - a.ratePct)[0];
    const ri = remainingInterest(worst.remainingCapital, worst.monthlyPayment, worst.ratePct);
    return {
      title: `Réduire la dette « ${worst.name} » (${worst.ratePct.toLocaleString("fr-FR")} %)`,
      detail: `Ce crédit coûtera encore ≈ ${Math.round(ri.totalInterest).toLocaleString(
        "fr-FR"
      )} € d'intérêts. Rembourser une dette à ${worst.ratePct.toLocaleString(
        "fr-FR"
      )} % équivaut à un placement garanti au même taux.`,
      severity: "serious",
    };
  }
  if (m.emergencyMonths !== null && m.emergencyMonths < 3) {
    return {
      title: "Renforcer l'épargne de sécurité",
      detail: `Vos liquidités couvrent ${m.emergencyMonths.toFixed(
        1
      )} mois de dépenses. Avant tout nouvel investissement, visez 3 à 6 mois (${Math.round(
        m.liquid
      ).toLocaleString("fr-FR")} € disponibles aujourd'hui).`,
      severity: "serious",
    };
  }
  if (m.debtRatioPct > 35) {
    return {
      title: "Éviter tout nouvel emprunt",
      detail: `Votre taux d'endettement atteint ${m.debtRatioPct.toFixed(
        1
      )} %, au-delà du seuil usuel de 35 %. Priorité : désendettement ou hausse des revenus avant un nouveau projet.`,
      severity: "serious",
    };
  }
  if (m.realEstateSharePct > 70 && m.grossAssets > 50000) {
    return {
      title: "Diversifier hors immobilier",
      detail: `L'immobilier représente ${m.realEstateSharePct.toFixed(
        0
      )} % de votre patrimoine brut. Une diversification progressive (ETF, fonds euros) réduirait le risque de concentration.`,
      severity: "warning",
    };
  }
  if (m.riskySharePct > 25) {
    return {
      title: "Réduire l'exposition aux actifs volatils",
      detail: `${m.riskySharePct.toFixed(
        0
      )} % de votre patrimoine est exposé à des actifs très volatils. Au-delà de 25 %, une correction de marché aurait un impact majeur.`,
      severity: "warning",
    };
  }
  if (m.savingsRatePct < 10 && m.totalIncome > 0) {
    return {
      title: "Augmenter le taux d'épargne",
      detail: `Vous épargnez ${m.savingsRatePct.toFixed(
        1
      )} % de vos revenus. Passer à 15 % (${Math.round(
        m.totalIncome * 0.15
      ).toLocaleString("fr-FR")} €/mois) accélérerait nettement votre progression.`,
      severity: "warning",
    };
  }
  return {
    title: "Investir votre capacité d'épargne",
    detail: `Vos fondations sont saines (endettement ${m.debtRatioPct.toFixed(
      0
    )} %, sécurité ${m.emergencyMonths?.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) ?? "?"} mois). Votre capacité d'investissement estimée est de ${Math.round(
      m.investCapacity
    ).toLocaleString("fr-FR")} €/mois — mettez-la au travail selon votre profil de risque.`,
    severity: "good",
  };
}

export function goalProbability(g: Goal): {
  projected: number;
  onTrack: boolean;
  probability: "élevée" | "moyenne" | "faible";
} {
  const months = Math.max(
    0,
    (new Date(g.targetDate).getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000)
  );
  const r = g.expectedReturnPct / 100 / 12;
  let v = g.currentAmount;
  for (let i = 0; i < Math.round(months); i++) v = v * (1 + r) + g.monthlyContribution;
  const ratio = g.targetAmount > 0 ? v / g.targetAmount : 1;
  return {
    projected: v,
    onTrack: ratio >= 1,
    probability: ratio >= 1.1 ? "élevée" : ratio >= 0.85 ? "moyenne" : "faible",
  };
}
