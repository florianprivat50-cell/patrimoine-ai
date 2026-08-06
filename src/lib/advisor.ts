import { Asset, Liability, Profile } from "../types";
import { fmtEUR, fmtPct, monthsToTarget, remainingInterest } from "./finance";
import { computeHealthScore, computeMetrics, Metrics } from "./metrics";

// Conseiller patrimonial « IA » de démonstration.
// Moteur de règles local et transparent : il n'utilise QUE les données saisies,
// cite ses hypothèses et signale les données manquantes. Ce n'est pas un LLM.

export interface AdvisorAnswer {
  conclusion: string;
  data: string[]; // données utilisées (faits)
  hypotheses: string[]; // hypothèses retenues
  risks: string[];
  alternatives: string[];
  actions: string[];
  missing?: string[]; // données manquantes et leur impact
}

interface Ctx {
  m: Metrics;
  profile: Profile | null;
  assets: Asset[];
  liabilities: Liability[];
}

export const SUGGESTED_QUESTIONS = [
  "Mon taux d'endettement est-il trop élevé ?",
  "Puis-je financer un nouveau projet immobilier ?",
  "Mon patrimoine est-il suffisamment diversifié ?",
  "Combien dois-je épargner chaque mois ?",
  "Dois-je rembourser mon crédit ou investir ?",
  "Quand pourrais-je atteindre l'indépendance financière ?",
  "Quel est le principal risque de ma stratégie ?",
];

export function answerQuestion(
  question: string,
  profile: Profile | null,
  assets: Asset[],
  liabilities: Liability[]
): AdvisorAnswer {
  const m = computeMetrics(assets, liabilities, profile);
  const ctx: Ctx = { m, profile, assets, liabilities };
  const q = question.toLowerCase();

  if (q.includes("endettement") || q.includes("taux d'endettement")) return debtRatio(ctx);
  if (q.includes("financer") || q.includes("acheter") || q.includes("nouveau projet"))
    return canFinance(ctx);
  if (q.includes("diversifi")) return diversification(ctx);
  if (q.includes("épargner") || q.includes("epargner") || q.includes("combien")) return howMuchSave(ctx);
  if (q.includes("rembourser") && q.includes("investir")) return repayOrInvest(ctx);
  if (q.includes("indépendance") || q.includes("independance") || q.includes("retraite"))
    return financialFreedom(ctx);
  if (q.includes("risque")) return mainRisk(ctx);
  if (q.includes("vendre")) return sell(ctx);
  return fallback(ctx);
}

const noIncome = (m: Metrics) => m.totalIncome === 0;

function debtRatio({ m }: Ctx): AdvisorAnswer {
  if (noIncome(m)) {
    return {
      conclusion: "Impossible de conclure : vos revenus ne sont pas renseignés.",
      data: [`Mensualités de crédit totales : ${fmtEUR(m.totalLoanPayments)}`],
      hypotheses: [],
      risks: [],
      alternatives: [],
      actions: ["Renseignez vos revenus nets mensuels dans Profil."],
      missing: [
        "Revenus du foyer — sans eux, le taux d'endettement ne peut pas être calculé. Avec 3 000 €/mois de revenus, vos mensualités actuelles représenteraient " +
          (3000 > 0 ? fmtPct((m.totalLoanPayments / 3000) * 100) : "—") +
          ".",
      ],
    };
  }
  const ok = m.debtRatioPct <= 35;
  return {
    conclusion: ok
      ? `Non : votre taux d'endettement est de ${fmtPct(m.debtRatioPct)}, sous le seuil usuel de 35 %.`
      : `Oui : ${fmtPct(m.debtRatioPct)} dépasse le seuil usuel de 35 % retenu par les banques.`,
    data: [
      `Revenus du foyer : ${fmtEUR(m.totalIncome)}/mois`,
      `Mensualités (assurances incluses) : ${fmtEUR(m.totalLoanPayments)}/mois`,
      `Reste à vivre : ${fmtEUR(m.resteAVivre)}/mois`,
    ],
    hypotheses: ["Seuil de référence : 35 % (pratique bancaire courante, non réglementaire au sens strict)."],
    risks: ok
      ? ["Un nouveau crédit pourrait vous faire dépasser le seuil : simulez avant de vous engager."]
      : ["Capacité d'emprunt quasi nulle ; vulnérabilité en cas de baisse de revenus."],
    alternatives: ok
      ? [`Marge disponible avant 35 % : ${fmtEUR(Math.max(0, m.totalIncome * 0.35 - m.totalLoanPayments))}/mois de mensualité supplémentaire.`]
      : ["Rembourser par anticipation un petit crédit, allonger une durée, ou augmenter les revenus."],
    actions: ok
      ? ["Vous pouvez envisager un projet, en le simulant d'abord dans l'onglet Projets."]
      : ["Réduire les mensualités avant tout nouvel engagement."],
  };
}

function canFinance(ctx: Ctx): AdvisorAnswer {
  const { m } = ctx;
  if (noIncome(m)) return debtRatio(ctx);
  const headroom = Math.max(0, m.totalIncome * 0.35 - m.totalLoanPayments);
  const okSecurity = (m.emergencyMonths ?? 0) >= 3;
  const ok = headroom > 100 && okSecurity;
  return {
    conclusion: ok
      ? `Oui, sous conditions : vous disposez d'environ ${fmtEUR(headroom)}/mois de capacité de mensualité avant le seuil de 35 %.`
      : okSecurity
        ? "Non pour l'instant : votre capacité d'emprunt résiduelle est trop faible."
        : "Pas encore : votre épargne de sécurité est insuffisante pour absorber les imprévus d'un nouveau projet.",
    data: [
      `Taux d'endettement actuel : ${fmtPct(m.debtRatioPct)}`,
      `Marge de mensualité avant 35 % : ${fmtEUR(headroom)}/mois`,
      `Épargne de sécurité : ${m.emergencyMonths === null ? "inconnue" : `${m.emergencyMonths.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mois de dépenses`}`,
      `Liquidités mobilisables : ${fmtEUR(m.liquid)}`,
    ],
    hypotheses: [
      "Seuil d'endettement : 35 % des revenus nets.",
      "Sécurité minimale avant projet : 3 mois de dépenses conservés APRÈS l'apport.",
    ],
    risks: [
      "Vacance locative, travaux imprévus ou hausse de charges peuvent transformer un cash-flow positif en effort d'épargne.",
      "Un projet rentable seulement en scénario optimiste est un projet fragile.",
    ],
    alternatives: [
      "Augmenter l'apport pour réduire la mensualité.",
      "Viser un bien moins cher ou mieux négocié (utilisez le « prix maximal » du calculateur).",
      "Investir en ETF programmés si l'immobilier est déjà dominant.",
    ],
    actions: [
      "Simulez le projet précis dans Projets → Calculateur : le scénario prudent doit rester supportable.",
    ],
  };
}

function diversification({ m }: Ctx): AdvisorAnswer {
  const max = m.allocation.length ? m.allocation.reduce((a, b) => (a.pct > b.pct ? a : b)) : null;
  const ok = m.allocation.length >= 3 && (max?.pct ?? 100) <= 60;
  return {
    conclusion: ok
      ? `Votre diversification est correcte : ${m.allocation.length} classes d'actifs, la plus importante pèse ${fmtPct(max?.pct ?? 0, 0)}.`
      : m.allocation.length === 0
        ? "Aucun actif enregistré : impossible d'évaluer la diversification."
        : `Votre patrimoine est concentré : ${max ? `${fmtPct(max.pct, 0)} sur une seule classe (${max.category})` : ""}. Une diversification progressive est recommandée.`,
    data: m.allocation.map((a) => `${a.category} : ${fmtEUR(a.value)} (${fmtPct(a.pct, 0)})`),
    hypotheses: ["Repères pédagogiques : ≥ 3 classes d'actifs, aucune au-delà de 60 % du brut."],
    risks: ok
      ? ["La diversification réduit le risque mais ne l'élimine pas."]
      : ["Une correction sur la classe dominante impacterait fortement votre patrimoine net."],
    alternatives: ["ETF diversifiés via PEA ou assurance-vie, fonds euros pour la part sécurisée."],
    actions: ok
      ? ["Maintenez l'équilibre lors de vos prochains investissements."]
      : ["Orientez les prochains versements vers les classes sous-représentées."],
  };
}

function howMuchSave({ m, profile }: Ctx): AdvisorAnswer {
  if (noIncome(m)) {
    return {
      conclusion: "Renseignez vos revenus pour obtenir un montant personnalisé.",
      data: [],
      hypotheses: ["Repère générique : 15 à 20 % des revenus nets."],
      risks: [],
      alternatives: [],
      actions: ["Complétez votre profil."],
      missing: ["Revenus du foyer — le montant cible en dépend directement."],
    };
  }
  const target = m.totalIncome * 0.15;
  const current = profile?.monthlySavings ?? 0;
  return {
    conclusion:
      current >= target
        ? `Votre épargne actuelle (${fmtEUR(current)}/mois, soit ${fmtPct(m.savingsRatePct)}) est au niveau ou au-dessus du repère de 15 %.`
        : `Visez environ ${fmtEUR(target)}/mois (15 % de vos revenus). Vous déclarez ${fmtEUR(current)}/mois aujourd'hui.`,
    data: [
      `Revenus du foyer : ${fmtEUR(m.totalIncome)}/mois`,
      `Épargne déclarée : ${fmtEUR(current)}/mois (${fmtPct(m.savingsRatePct)})`,
    ],
    hypotheses: ["Repère pédagogique : 15–20 % des revenus nets ; à adapter à votre situation."],
    risks: ["Une épargne forcée intenable est contre-productive : augmentez par paliers."],
    alternatives: ["Automatiser un virement le jour de la paie ; augmenter de 1 point tous les 3 mois."],
    actions: [
      (m.emergencyMonths ?? 0) < 6
        ? "Dirigez d'abord l'épargne vers le fonds de sécurité (livrets), puis vers l'investissement."
        : "Votre sécurité est constituée : orientez l'épargne vers l'investissement selon votre profil.",
    ],
  };
}

function repayOrInvest({ m, liabilities }: Ctx): AdvisorAnswer {
  const sorted = [...liabilities]
    .filter((l) => l.remainingCapital > 0)
    .sort((a, b) => b.ratePct - a.ratePct);
  if (sorted.length === 0) {
    return {
      conclusion: "Vous n'avez aucun crédit enregistré : la question du remboursement ne se pose pas — investissez selon votre profil.",
      data: [],
      hypotheses: [],
      risks: [],
      alternatives: [],
      actions: ["Ajoutez vos crédits éventuels dans Patrimoine → Crédits."],
    };
  }
  const worst = sorted[0];
  const threshold = 4; // rendement long terme prudent d'un portefeuille diversifié
  const repay = worst.ratePct >= threshold;
  const ri = remainingInterest(worst.remainingCapital, worst.monthlyPayment, worst.ratePct);
  return {
    conclusion: repay
      ? `Priorité au remboursement : votre crédit « ${worst.name} » à ${fmtPct(worst.ratePct)} coûte plus cher qu'un rendement prudent attendu des marchés (≈ 4 %/an).`
      : `Priorité à l'investissement : votre crédit le plus cher est à ${fmtPct(worst.ratePct)}, en dessous du rendement prudent attendu (≈ 4 %/an). Conserver ce crédit et investir est mathématiquement favorable.`,
    data: [
      `Crédit au taux le plus élevé : ${worst.name}, ${fmtPct(worst.ratePct)}, CRD ${fmtEUR(worst.remainingCapital)}`,
      `Intérêts restants estimés : ${Number.isFinite(ri.totalInterest) ? fmtEUR(ri.totalInterest) : "—"}`,
    ],
    hypotheses: [
      "Rendement de comparaison : 4 %/an net (portefeuille diversifié, hypothèse prudente et NON garantie).",
      "Hors effets fiscaux (intérêts déductibles en locatif, fiscalité des placements).",
    ],
    risks: [
      "Les rendements de marché sont volatils : la comparaison vaut en moyenne longue, pas chaque année.",
      "Rembourser par anticipation peut comporter des indemnités (IRA) — vérifiez votre contrat.",
    ],
    alternatives: ["Solution mixte : rembourser partiellement et investir le solde."],
    actions: [
      repay
        ? `Étudier un remboursement anticipé partiel de « ${worst.name} ».`
        : "Mettre en place un investissement programmé mensuel.",
    ],
  };
}

function financialFreedom({ m, profile }: Ctx): AdvisorAnswer {
  const expenses =
    profile?.monthlyExpenses && profile.monthlyExpenses > 0
      ? profile.monthlyExpenses
      : m.totalIncome > 0
        ? m.totalIncome - (profile?.monthlySavings ?? 0)
        : null;
  if (!expenses) {
    return {
      conclusion: "Impossible d'estimer : vos dépenses mensuelles sont inconnues.",
      data: [],
      hypotheses: [],
      risks: [],
      alternatives: [],
      actions: ["Renseignez revenus et capacité d'épargne dans Profil."],
      missing: ["Dépenses mensuelles — l'indépendance financière se mesure par rapport à elles."],
    };
  }
  const targetCapital = expenses * 12 * 25; // règle des 4 %
  const investable = m.grossAssets - m.liquid * 0; // tout le patrimoine brut productif — simplification affichée
  const months = monthsToTarget(
    m.netWorth,
    targetCapital,
    profile?.monthlySavings ?? 0,
    4
  );
  const years = months === null ? null : Math.round((months / 12) * 10) / 10;
  return {
    conclusion:
      months === 0
        ? "Selon la règle des 4 %, votre patrimoine net couvre déjà vos dépenses annuelles ×25."
        : years === null
          ? "Au rythme actuel, la cible n'est pas atteignable en moins de 100 ans : il faut augmenter l'épargne ou le rendement."
          : `Ordre de grandeur : environ ${years.toLocaleString("fr-FR")} ans pour atteindre ${fmtEUR(targetCapital)} (règle des 4 %), au rythme d'épargne actuel.`,
    data: [
      `Dépenses estimées : ${fmtEUR(expenses)}/mois`,
      `Capital cible (25 × dépenses annuelles) : ${fmtEUR(targetCapital)}`,
      `Patrimoine net actuel : ${fmtEUR(m.netWorth)}`,
      `Épargne mensuelle : ${fmtEUR(profile?.monthlySavings ?? 0)}`,
      `Revenus passifs actuels : ${fmtEUR(m.passiveIncomeMonthly)}/mois`,
    ],
    hypotheses: [
      "Règle des 4 % : retirer 4 %/an d'un capital diversifié (étude Trinity, non garantie).",
      "Rendement moyen supposé : 4 %/an net sur l'ensemble du patrimoine — hypothèse modifiable et incertaine.",
      "Le calcul projette le patrimoine NET total, y compris la résidence principale : la part réellement mobilisable est plus faible.",
    ],
    risks: [
      "Inflation, fiscalité et séquences de rendements peuvent décaler la cible de plusieurs années.",
      "La résidence principale ne produit pas de revenus : la cible « mobilisable » est plus exigeante.",
    ],
    alternatives: [
      "Réduire les dépenses cibles (chaque −100 €/mois de dépenses réduit le capital requis de 30 000 €).",
      "Augmenter les revenus passifs (immobilier locatif, dividendes).",
    ],
    actions: ["Créez un objectif dédié dans Objectifs pour suivre la trajectoire."],
  };
}

function mainRisk(ctx: Ctx): AdvisorAnswer {
  const { m } = ctx;
  const risks: { label: string; detail: string; score: number }[] = [
    {
      label: "Concentration immobilière",
      detail: `${fmtPct(m.realEstateSharePct, 0)} du patrimoine brut en immobilier.`,
      score: m.realEstateSharePct,
    },
    {
      label: "Manque de liquidité",
      detail: `Seulement ${fmtPct(m.liquidSharePct, 0)} du patrimoine immédiatement disponible.`,
      score: m.liquidSharePct < 10 ? 80 - m.liquidSharePct * 5 : 0,
    },
    {
      label: "Endettement élevé",
      detail: `Taux d'endettement de ${fmtPct(m.debtRatioPct, 0)}.`,
      score: m.debtRatioPct > 30 ? m.debtRatioPct * 1.5 : 0,
    },
    {
      label: "Exposition aux actifs volatils",
      detail: `${fmtPct(m.riskySharePct, 0)} en crypto / actions risquées.`,
      score: m.riskySharePct * 1.5,
    },
    {
      label: "Épargne de sécurité insuffisante",
      detail:
        m.emergencyMonths === null
          ? "Non mesurable (dépenses inconnues)."
          : `${m.emergencyMonths.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mois de dépenses couverts.`,
      score: m.emergencyMonths !== null && m.emergencyMonths < 3 ? 90 - m.emergencyMonths * 20 : 0,
    },
  ];
  const top = risks.sort((a, b) => b.score - a.score)[0];
  return {
    conclusion:
      top.score <= 10
        ? "Aucun risque majeur détecté dans les données saisies — votre structure est équilibrée."
        : `Principal risque identifié : ${top.label.toLowerCase()}. ${top.detail}`,
    data: risks.filter((r) => r.score > 0).map((r) => `${r.label} — ${r.detail}`),
    hypotheses: ["Analyse limitée aux données saisies : assurances, santé et risques professionnels non couverts."],
    risks: ["Un risque non saisi (revenus instables, absence de prévoyance) peut dominer ceux listés ici."],
    alternatives: [],
    actions: ["Consultez le Score de santé pour le détail par dimension et les actions correctives."],
  };
}

function sell({ assets, m }: Ctx): AdvisorAnswer {
  const re = assets.filter((a) => a.category === "immobilier" && a.monthlyRent);
  return {
    conclusion:
      re.length === 0
        ? "Aucun bien locatif enregistré : je ne peux pas évaluer une vente. La décision dépend du rendement net réel du bien comparé à vos alternatives."
        : "La décision de vendre dépend du rendement net de chaque bien comparé à vos alternatives — voici les éléments par bien.",
    data: re.map((a) => {
      const rent = (a.monthlyRent ?? 0) * (1 - (a.vacancyPct ?? 0) / 100);
      const costs =
        (a.monthlyCharges ?? 0) + (a.propertyTax ?? 0) / 12 + (a.insuranceYearly ?? 0) / 12;
      const netYield = a.currentValue > 0 ? (((rent - costs) * 12) / a.currentValue) * 100 : 0;
      return `${a.name} : valeur ${fmtEUR(a.currentValue)}, rendement net sur valeur actuelle ≈ ${fmtPct(netYield)}`;
    }),
    hypotheses: ["Rendement de comparaison : ≈ 4 %/an sur un portefeuille diversifié (non garanti)."],
    risks: [
      "Frais de vente (6–8 %), fiscalité sur plus-value éventuelle, délai de vente.",
      "Vendre un bien financé à crédit à taux bas détruit un levier peu coûteux.",
    ],
    alternatives: ["Améliorer le rendement (loyer, charges, fiscalité) avant d'envisager la vente."],
    actions: ["Comparez « conserver » vs « vendre et réinvestir » avec le calculateur de l'onglet Projets."],
  };
}

function fallback(ctx: Ctx): AdvisorAnswer {
  const { m, profile } = ctx;
  const score = computeHealthScore(m, profile);
  return {
    conclusion: `Vue d'ensemble : patrimoine net de ${fmtEUR(m.netWorth)}, score de santé ${score.total}/100. Posez une question précise ou choisissez une suggestion ci-dessous.`,
    data: [
      `Patrimoine brut : ${fmtEUR(m.grossAssets)} · Dettes : ${fmtEUR(m.totalDebts)}`,
      `Taux d'endettement : ${fmtPct(m.debtRatioPct)} · Taux d'épargne : ${fmtPct(m.savingsRatePct)}`,
    ],
    hypotheses: [],
    risks: [],
    alternatives: [],
    actions: score.actions.slice(0, 3),
  };
}
