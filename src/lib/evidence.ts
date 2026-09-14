import type { MarketEvidence, PropertyRiskEvidence, EvidenceConfidence } from './feasibility';

export interface FieldEvidence {
  field: string;
  value: string | number;
  source: string;
  url: string;
  retrievedAt: string;
  confidence: EvidenceConfidence;
  status: 'declared' | 'conflict' | 'manual';
  alternatives?: Array<string | number>;
}
export interface SourceEvidence {
  name: string;
  url: string;
  status: 'available' | 'unavailable' | 'insufficient';
  detail: string;
  retrievedAt: string;
}
export interface AnalysisEvidence {
  version: 1;
  retrievedAt: string;
  fields: FieldEvidence[];
  sources: SourceEvidence[];
  location?: { lat: number; lng: number; cityCode: string; label: string; precision: string; confidence: EvidenceConfidence };
  market: MarketEvidence;
  risks: PropertyRiskEvidence;
  riskLabels: string[];
  comparables?: Array<{id:string;date:string;price:number;surface:number;pricePerSqm:number}>;
  warnings: string[];
}

/** Editing an address invalidates all geographically dependent evidence. */
export function invalidateEvidence(e: AnalysisEvidence | undefined, changes: Record<string, unknown>): AnalysisEvidence | undefined {
  if (!e) return e;
  const fields = e.fields.map(f => Object.prototype.hasOwnProperty.call(changes, f.field) ? { ...f, value: changes[f.field] as string | number, status: 'manual' as const, confidence: 'low' as const } : f);
  if (['city', 'postalCode', 'address', 'lat', 'lng'].some(k => Object.prototype.hasOwnProperty.call(changes, k))) {
    return { ...e, fields, location: undefined, market: {}, comparables:[], risks: { dpe: e.risks.dpe, dataConfidence: 'low' }, riskLabels: [], sources: [], warnings: ['Localisation modifiée : relancer la collecte des données locales.'] };
  }
  if (['surface','propertyType'].some(k=>Object.prototype.hasOwnProperty.call(changes,k))) return {...e,fields,market:{},comparables:[],warnings:[...e.warnings,'Type ou surface modifiés : relancer les comparables DVF.']};
  return { ...e, fields };
}
