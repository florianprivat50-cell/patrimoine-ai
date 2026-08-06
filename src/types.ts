// Modèle de données de Patrimoine IA
export type AssetCategory =
  | "immobilier"
  | "liquidites"
  | "financier"
  | "crypto"
  | "societe"
  | "autre";

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  immobilier: "Immobilier",
  liquidites: "Liquidités",
  financier: "Actions & placements",
  crypto: "Cryptomonnaies",
  societe: "Sociétés",
  autre: "Autres actifs",
};

// Couleurs catégorielles — ordre fixe, jamais recyclé. Le vert est réservé à la couleur
// de marque (boutons, accents) : aucune catégorie ne l'utilise, pour éviter toute confusion
// entre « action principale » et « classe d'actif ». « Autres actifs » reste volontairement
// neutre (gris chaud) pour ne pas rivaliser visuellement avec les vraies catégories.
export const CATEGORY_COLORS_LIGHT: Record<AssetCategory, string> = {
  immobilier: "#2a78d6",
  liquidites: "#eb6834",
  financier: "#5b3fc4",
  crypto: "#c98500",
  societe: "#c94f89",
  autre: "#8a7d6a",
};
export const CATEGORY_COLORS_DARK: Record<AssetCategory, string> = {
  immobilier: "#3987e5",
  liquidites: "#d95926",
  financier: "#8b7ae6",
  crypto: "#d99a1f",
  societe: "#d9709f",
  autre: "#9c9382",
};

export interface Asset {
  id: string;
  category: AssetCategory;
  subtype: string; // ex : "Résidence principale", "Livret A", "PEA", "Bitcoin"…
  name: string;
  currentValue: number; // valeur actuelle estimée (part détenue incluse)
  ownershipPct: number; // % de détention (100 par défaut)
  updatedAt: string; // ISO
  notes?: string;
  // Immobilier
  city?: string;
  postalCode?: string;
  address?: string;
  lat?: number;
  lng?: number;
  surface?: number;
  purchasePrice?: number;
  notaryFees?: number;
  works?: number;
  monthlyRent?: number;
  monthlyCharges?: number;
  propertyTax?: number; // annuelle
  insuranceYearly?: number;
  managementPct?: number; // % des loyers
  vacancyPct?: number; // % du temps
  taxRegime?: string;
  linkedLoanId?: string;
  // Financier / crypto
  envelope?: string; // PEA, CTO, AV, PER…
  invested?: number; // prix de revient
  monthlyContribution?: number;
  riskLevel?: "faible" | "modéré" | "élevé";
  platform?: string;
  quantity?: number;
  avgPrice?: number;
  custody?: "plateforme" | "portefeuille personnel";
  // Liquidités
  bank?: string;
  ratePct?: number;
  // Société
  companyForm?: string;
  revenue?: number;
  profit?: number;
}

export type LiabilityType =
  | "Crédit immobilier"
  | "Crédit automobile"
  | "Crédit à la consommation"
  | "Prêt étudiant"
  | "Crédit professionnel"
  | "Prêt familial"
  | "Dette fiscale"
  | "Crédit renouvelable"
  | "Prêt in fine"
  | "Autre dette";

export interface Liability {
  id: string;
  type: LiabilityType;
  name: string;
  initialCapital: number;
  remainingCapital: number;
  monthlyPayment: number; // hors assurance
  insuranceMonthly: number;
  ratePct: number;
  endDate?: string; // ISO
  rateType: "fixe" | "variable";
  linkedAssetId?: string;
  updatedAt: string;
}

export interface Profile {
  firstName: string;
  age?: number;
  familyStatus?: string;
  children?: number;
  country?: string;
  jobStatus?: string;
  netMonthlyIncome: number;
  partnerMonthlyIncome: number;
  incomeStability?: "stable" | "variable";
  monthlySavings: number; // capacité d'épargne déclarée
  monthlyExpenses?: number;
  knowledgeLevel?: "débutant" | "intermédiaire" | "avancé";
  objectives: string[];
  riskTolerance?: "prudent" | "équilibré" | "dynamique";
  horizonYears?: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string; // ISO
  expectedReturnPct: number; // hypothèse de rendement annuel, modifiable
  createdAt: string;
}

export interface RealEstateProjectInputs {
  name: string;
  // Contexte du bien
  city?: string;
  postalCode?: string;
  address?: string;
  listingUrl?: string;
  propertyType?: string; // immeuble, appartement, maison…
  surface?: number;
  residentialLots?: number;
  commercialLots?: number;
  commercialMonthlyRent?: number;
  lat?: number;
  lng?: number;
  // Mode d'analyse et d'exploitation
  analysisMode?: "express" | "approfondie";
  rentalMode?: "classique" | "saisonnier";
  nightlyRate?: number; // saisonnier
  occupancyPct?: number; // saisonnier
  targetNetYieldPct?: number; // rentabilité nette cible pour le prix max
  price: number;
  agencyFees: number;
  notaryFeesPct: number; // % du prix
  works: number;
  furniture: number;
  bankFees: number;
  downPayment: number; // apport
  ratePct: number;
  durationYears: number;
  insurancePctYearly: number; // % du capital emprunté / an
  monthlyRent: number;
  monthlyCharges: number;
  propertyTaxYearly: number;
  ownerInsuranceYearly: number;
  managementPct: number; // % loyers
  maintenancePct: number; // % loyers
  vacancyPct: number; // % du temps
  taxRatePct: number; // fiscalité estimée sur le résultat locatif
  rentGrowthPct: number; // revalorisation annuelle
  valueGrowthPct: number; // évolution annuelle du bien
}

export interface RealEstateProject extends RealEstateProjectInputs {
  id: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface Snapshot {
  date: string; // YYYY-MM-DD
  netWorth: number;
  gross: number;
  debts: number;
}
