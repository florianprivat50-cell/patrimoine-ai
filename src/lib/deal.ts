import { RealEstateProject, RealEstateProjectInputs } from "../types";
import { fmtEUR, fmtPct } from "./finance";
import { CityMarket, compareToMarket, MarketComparison } from "./market";
import {
  computeProject,
  maxPriceForTargetYield,
  ProjectResults,
  ScenarioKind,
  scenarioInputs,
} from "./realestate";

// Moteur de décision « investisseur » : score /100, verdict et argumentaire.
// Chaque point du score est traçable (voir scoreDetails) — aucune boîte noire.

export type Verdict = "refuser" | "negocier" | "accepter";

export interface ScorePart {
  label: string;
  points: number;
  max: number;
  comment: string;
}

export interface DealAnalysis {
  results: Record<ScenarioKind, ProjectResults>;
  score: number;
  scoreParts: ScorePart[];
  verdict: Verdict;
  headline: string;
  advice: string;
  strengths: string[];
  risks: string[];
  visitQuestions: string[];
  maxPriceCashflow: number | null; // prix max pour cash-flow neutre
  maxPriceTarget: number | null; // prix max pour la rentabilité nette cible
  offerPrice: number | null; // offre de déclenchement conseillée (marge de négo 3 %)
  pricePerSqm: number | null;
  costPerLot: number | null;
  commercialSharePct: number; // part du loyer commercial dans les loyers totaux
  rentMarginPct: number | null; // marge des loyers sur le loyer d'équilibre
  market: MarketComparison | null; // comparaison au prix/m² du marché local (null si ville non référencée)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Hypothèses réellement envoyées au moteur de calcul :
 * - mode saisonnier → loyer dérivé du tarif nuitée × occupation
 * - mode express → garde-fous prudents appliqués d'office (vacance, assurances, fiscalité…)
 * Source unique utilisée par la page Projets ET la carte, pour que le verdict affiché
 * soit toujours identique quel que soit l'endroit où le bien est consulté.
 */
export function effectiveProjectInputs(p: RealEstateProject): RealEstateProjectInputs {
  let q: RealEstateProjectInputs = { ...p };
  // Pas de local commercial déclaré → aucun loyer commercial, même si un montant est resté saisi
  if (!p.commercialLots || p.commercialLots <= 0) q.commercialMonthlyRent = 0;
  if (p.rentalMode === "saisonnier") {
    const occ = p.occupancyPct ?? 60;
    q.monthlyRent = Math.round(((p.nightlyRate ?? 0) * 30.44 * occ) / 100);
    q.vacancyPct = 0; // le taux d'occupation intègre déjà la vacance
    q.maintenancePct = Math.max(q.maintenancePct, 10); // usure, ménage, consommables
    q.commercialMonthlyRent = 0;
  }
  if (p.analysisMode !== "approfondie") {
    const lots = Math.max(1, (p.residentialLots ?? 1) + (p.commercialLots ?? 0));
    q = {
      ...q,
      vacancyPct: p.rentalMode === "saisonnier" ? 0 : 8,
      insurancePctYearly: 0.3,
      maintenancePct: p.rentalMode === "saisonnier" ? 12 : 5,
      managementPct: 0,
      ownerInsuranceYearly: 150 * lots,
      taxRatePct: 30,
      bankFees: 1500,
    };
  }
  return q;
}

export function computeDeal(p: RealEstateProjectInputs): DealAnalysis {
  const results = {
    prudent: computeProject(scenarioInputs(p, "prudent")),
    realiste: computeProject(scenarioInputs(p, "realiste")),
    optimiste: computeProject(scenarioInputs(p, "optimiste")),
  };
  const r = results.realiste;
  const target = p.targetNetYieldPct ?? 7;
  const pricePerSqm = p.surface && p.surface > 0 ? p.price / p.surface : null;
  const market = compareToMarket(p.city, p.postalCode, pricePerSqm);

  // ——— Score /100, décomposé ———
  const parts: ScorePart[] = [];

  // 1. Cash-flow réaliste (22 pts)
  const cf = r.monthlyCashflow;
  let cfPts: number;
  if (cf >= 150) cfPts = 22;
  else if (cf >= 0) cfPts = 13 + (9 * cf) / 150;
  else if (cf >= -300) cfPts = 9 * (1 + cf / 300);
  else cfPts = 0;
  parts.push({
    label: "Cash-flow (réaliste)",
    points: Math.round(cfPts),
    max: 22,
    comment:
      cf >= 0
        ? `${fmtEUR(cf)}/mois après fiscalité estimée.`
        : `Effort d'épargne de ${fmtEUR(-cf)}/mois après fiscalité.`,
  });

  // 2. Résistance au scénario prudent (15 pts)
  const cfP = results.prudent.monthlyCashflow;
  const resPts = cfP >= 0 ? 15 : cfP >= -150 ? 7 : cfP >= -300 ? 3 : 0;
  parts.push({
    label: "Résistance (prudent)",
    points: resPts,
    max: 15,
    comment:
      cfP >= 0
        ? "Le projet reste autofinancé même en scénario dégradé."
        : `Effort de ${fmtEUR(-cfP)}/mois si vacance +5 pts, loyers −5 %, travaux +15 %.`,
  });

  // 3. Rentabilité nette après fiscalité vs cible (14 pts)
  const yieldRatio = target > 0 ? r.netAfterTaxYieldPct / target : 1;
  const yieldPts = clamp(yieldRatio * 14, 0, 14);
  parts.push({
    label: `Rentabilité vs cible ${fmtPct(target, 1)}`,
    points: Math.round(yieldPts),
    max: 14,
    comment: `${fmtPct(r.netAfterTaxYieldPct)} net après fiscalité pour ${fmtPct(target, 1)} visés.`,
  });

  // 4. TRI 20 ans (10 pts)
  const irr = r.irrPct;
  const irrPts = irr === null ? 3 : irr >= 8 ? 10 : irr >= 5 ? 7 : irr >= 3 ? 3 : irr >= 0 ? 1 : 0;
  parts.push({
    label: "TRI 20 ans",
    points: irrPts,
    max: 10,
    comment: irr === null ? "TRI non calculable." : `${fmtPct(irr)} avec revente estimée (frais 7 % déduits).`,
  });

  // 5. Marge des loyers sur le loyer d'équilibre (15 pts)
  const rentMarginPct =
    r.breakEvenRent > 0 ? ((r.grossMonthlyRent - r.breakEvenRent) / r.breakEvenRent) * 100 : null;
  const mgPts =
    rentMarginPct === null ? 5 : rentMarginPct >= 10 ? 15 : rentMarginPct >= 0 ? 8 + (7 * rentMarginPct) / 10 : clamp(8 + rentMarginPct, 0, 8);
  parts.push({
    label: "Marge sur loyer d'équilibre",
    points: Math.round(mgPts),
    max: 15,
    comment:
      rentMarginPct === null
        ? "Non calculable."
        : rentMarginPct >= 0
          ? `Loyers ${fmtPct(rentMarginPct, 0)} au-dessus du point d'équilibre.`
          : `Loyers ${fmtPct(-rentMarginPct, 0)} SOUS le point d'équilibre.`,
  });

  // 6. Position vs marché local (24 pts) — poids renforcé, et surtout une échelle beaucoup
  //    plus exigeante : avant, une décote de -22 % (Avranches) et une décote de -67 % (Rennes)
  //    obtenaient quasiment le même score (86 % vs 100 % du max). Or ce ne sont pas deux
  //    variantes d'une même bonne affaire — l'une est correcte, l'autre est exceptionnelle.
  //    Nouvelle échelle : une décote « normale » (0 à -15 %, la plupart des négociations
  //    réussies) ne rapporte que peu de points ; il faut une décote vraiment rare (au-delà de
  //    -40/-50 %) pour approcher le maximum. Deux composantes toujours distinctes :
  //    a) l'écart de prix (16 pts) — courbe non linéaire, saturant seulement à -55 %.
  //    b) la tension locative du marché (8 pts) — un même écart vaut plus dans un marché très
  //       demandé (revente facile, vacance rare) que dans un marché atone.
  let mispricingPts: number;
  if (!market) mispricingPts = 5;
  else if (market.gapPct >= 0) mispricingPts = clamp(4 - (4 * market.gapPct) / 20, 0, 4);
  else {
    // 0 % → 4 pts (prix dans le marché, ordinaire) ; -55 % ou plus → 16 pts (exceptionnel).
    // Exposant 1.6 : les 20 premiers points de décote comptent peu, les suivants comptent
    // de plus en plus — reflète qu'une décote de -20 % est courante alors qu'une décote de
    // -60 % est rarissime et mérite un score très supérieur, pas seulement proportionnel.
    const depth = clamp(-market.gapPct / 55, 0, 1);
    mispricingPts = 4 + 12 * Math.pow(depth, 1.6);
  }

  const tensionScore = (t: CityMarket["tension"] | null): number =>
    t === "très forte" ? 8 : t === "forte" ? 5 : t === "modérée" ? 3 : t === "faible" ? 0 : 4;
  // Tension inconnue au niveau département : approximée par le niveau de prix de référence
  // (un département cher est statistiquement un marché plus tendu) — même logique indicative
  // que le reste du référentiel, jamais présentée comme une mesure directe.
  const tensionPts = !market
    ? 4
    : market.tension !== null
      ? tensionScore(market.tension)
      : market.refPricePerSqm >= 4000
        ? 8
        : market.refPricePerSqm >= 2500
          ? 5
          : market.refPricePerSqm >= 1500
            ? 3
            : 0;

  const marketPts = mispricingPts + tensionPts;
  parts.push({
    label: "Position vs marché local",
    points: Math.round(marketPts),
    max: 24,
    comment: !market
      ? "Ville et code postal non identifiables dans notre base — comparaison indisponible."
      : `${fmtEUR(market.yourPricePerSqm)}/m² payé pour ${fmtEUR(market.refPricePerSqm)}/m² ${market.precision === "departement" ? "en moyenne dans le département" : "en moyenne à"} ${market.place} (écart ${market.gapPct >= 0 ? "+" : ""}${fmtPct(market.gapPct, 0)}) · tension ${market.tension ?? "estimée depuis le niveau de prix"}.`,
  });

  const score = clamp(
    Math.round(parts.reduce((s, x) => s + x.points, 0)),
    0,
    100
  );
  const verdict: Verdict = score < 45 ? "refuser" : score < 65 ? "negocier" : "accepter";

  // ——— Prix cibles ———
  const maxPriceCashflow = r.maxPrice;
  const maxPriceTarget = maxPriceForTargetYield(p, target);
  const anchors = [maxPriceCashflow, maxPriceTarget].filter((x): x is number => x !== null);
  const offerPrice = anchors.length ? Math.round((Math.min(...anchors) * 0.97) / 500) * 500 : null;

  // ——— Contexte ———
  const totalRentMonthly = r.grossMonthlyRent;
  const commercialSharePct =
    totalRentMonthly > 0 ? (((p.commercialMonthlyRent ?? 0) / totalRentMonthly) * 100) : 0;
  const lots = (p.residentialLots ?? 0) + (p.commercialLots ?? 0);
  const costPerLot = lots > 0 ? r.totalCost / lots : null;

  // ——— Verdict rédigé ———
  let headline: string;
  let advice: string;
  if (verdict === "refuser") {
    headline = "Au prix actuel, le risque dépasse le potentiel.";
    advice = offerPrice
      ? `Passer, sauf baisse forte sous ${fmtEUR(offerPrice)} ou hausse prouvée des loyers. À ce prix, le scénario réaliste ${cf < 0 ? `impose ${fmtEUR(-cf)}/mois d'effort` : "ne rémunère pas le risque"}.`
      : "Passer : même à prix très réduit, les hypothèses actuelles ne permettent pas d'atteindre vos critères.";
  } else if (verdict === "negocier") {
    headline = "Le dossier peut fonctionner — pas à ce prix, ou pas sans garanties.";
    advice = offerPrice
      ? `Négocier autour de ${fmtEUR(offerPrice)} (offre de déclenchement) et sécuriser les points de risque listés avant d'engager.`
      : "Négocier le prix et vérifier les hypothèses de loyers avant d'engager.";
  } else {
    headline = "Les fondamentaux sont solides au prix actuel.";
    advice = `Avancer : cash-flow ${cf >= 0 ? "positif" : "maîtrisé"}, cible de rentabilité ${yieldRatio >= 1 ? "atteinte" : "approchée"}. Verrouiller le financement et vérifier les points de visite.`;
  }

  // ——— Points forts ———
  const strengths: string[] = [];
  if (r.grossYieldPct >= 8) strengths.push(`Rendement brut élevé : ${fmtPct(r.grossYieldPct)}.`);
  if (r.netAfterTaxYieldPct >= target) strengths.push(`Cible de rentabilité nette atteinte (${fmtPct(r.netAfterTaxYieldPct)} ≥ ${fmtPct(target, 1)}).`);
  if (cf >= 0) strengths.push(`Autofinancé en scénario réaliste (+${fmtEUR(cf)}/mois).`);
  if (cfP >= 0) strengths.push("Résiste au scénario prudent : vraie marge de sécurité.");
  if (lots >= 3) strengths.push(`${lots} lots : le risque locatif est réparti.`);
  if (rentMarginPct !== null && rentMarginPct >= 10)
    strengths.push(`Loyers ${fmtPct(rentMarginPct, 0)} au-dessus du loyer d'équilibre.`);
  if (r.returnOnEquityPct !== null && r.returnOnEquityPct >= 10)
    strengths.push(`Effet de levier efficace : ${fmtPct(r.returnOnEquityPct)} de rentabilité des fonds propres.`);
  if (market && market.gapPct <= -5)
    strengths.push(`Prix ${fmtPct(-market.gapPct, 0)} sous la moyenne du marché à ${market.place} (${fmtEUR(market.refPricePerSqm)}/m²).`);
  if (market && market.tension === "très forte")
    strengths.push(`Tension locative très forte à ${market.place} : risque de vacance limité.`);
  if (strengths.length === 0) strengths.push("Aucun point fort décisif aux hypothèses actuelles.");

  // ——— Risques & challenges ———
  const risks: string[] = [];
  if (cf < 0) risks.push(`Cash-flow négatif : ${fmtEUR(-cf)}/mois à sortir de votre poche.`);
  if (cfP < 0 && cf >= 0)
    risks.push(`Fragile : l'autofinancement disparaît en scénario prudent (${fmtEUR(cfP)}/mois).`);
  if (results.optimiste.monthlyCashflow >= 0 && cf < -20)
    risks.push("Rentable uniquement en scénario optimiste — signal d'alerte majeur.");
  if (commercialSharePct > 40)
    risks.push(`${fmtPct(commercialSharePct, 0)} des loyers dépendent du local commercial : un départ = déséquilibre immédiat.`);
  if (lots === 1) risks.push("Mono-lot : une vacance = 100 % des loyers en moins.");
  if (p.works > 0 && p.works < p.price * 0.03)
    risks.push("Budget travaux faible vs prix : risque de sous-estimation (toiture, électricité, plomberie).");
  if (p.vacancyPct < 5 && p.rentalMode !== "saisonnier")
    risks.push(`Vacance supposée ${fmtPct(p.vacancyPct, 0)} : optimiste pour la plupart des marchés.`);
  if (p.rentalMode === "saisonnier")
    risks.push("Location saisonnière : revenus volatils, réglementation locale à vérifier (autorisation, quotas, changement d'usage).");
  if (rentMarginPct !== null && rentMarginPct < 0)
    risks.push(`Loyers sous le point d'équilibre : il manque ${fmtEUR(r.breakEvenRent - r.grossMonthlyRent)}/mois.`);
  if (market && market.gapPct >= 15)
    risks.push(`Prix ${fmtPct(market.gapPct, 0)} au-dessus de la moyenne du marché à ${market.place} (${fmtEUR(market.refPricePerSqm)}/m²) : potentiel de plus-value limité.`);
  if (market && market.tension === "faible")
    risks.push(`Tension locative faible à ${market.place} : délai de relocation potentiellement plus long.`);
  if (market && market.precision === "departement")
    risks.push(`Comparaison au niveau départemental (${market.place}) — la ville n'est pas répertoriée précisément, l'écart réel peut différer.`);
  if (risks.length === 0) risks.push("Pas de risque structurel détecté — restent les risques d'exécution (travaux, locataires).");

  // ——— Questions de visite ———
  const visitQuestions: string[] = [
    "DPE réel, mode de chauffage, isolation — impact direct sur la vacance et la valeur.",
    "État de la toiture, façade, électricité et plomberie (devis à l'appui, pas d'estimation orale).",
    "Taxe foncière : demander l'avis réel, pas le montant annoncé.",
  ];
  if ((p.commercialLots ?? 0) > 0)
    visitQuestions.push("Bail commercial : durée restante, indexation, historique d'impayés et santé du locataire.");
  if ((p.residentialLots ?? 0) >= 2)
    visitQuestions.push("Baux en cours : loyers réels encaissés (quittances), dépôts de garantie, impayés.");
  visitQuestions.push(
    market
      ? `Confirmer le prix/m² auprès d'agences locales à ${market.place} : notre référentiel (${fmtEUR(market.refPricePerSqm)}/m²) est une estimation, pas une donnée DVF vérifiée.`
      : "Marché local : annonces comparables actives, délai de relocation constaté, tension locative. Renseignez le code postal pour une comparaison automatique."
  );
  if (p.works > 0) visitQuestions.push("Travaux : faire chiffrer par un artisan AVANT l'offre, pas après le compromis.");

  return {
    results,
    score,
    scoreParts: parts,
    verdict,
    headline,
    advice,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    visitQuestions: visitQuestions.slice(0, 5),
    maxPriceCashflow,
    maxPriceTarget,
    offerPrice,
    pricePerSqm,
    costPerLot,
    commercialSharePct,
    rentMarginPct,
    market,
  };
}

export const VERDICT_META: Record<Verdict, { label: string; color: string }> = {
  refuser: { label: "REFUSER", color: "#e2603d" },
  negocier: { label: "NÉGOCIER", color: "#d9a514" },
  accepter: { label: "ACCEPTER", color: "#3ecf8e" },
};
