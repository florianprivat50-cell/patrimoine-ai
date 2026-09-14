import type { AnalysisEvidence, SourceEvidence } from '../../../src/lib/evidence';
import { safeGet } from './http';

export function parseCsv(csv: string): Record<string,string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i=0;i<csv.length;i++) {
    const c=csv[i];
    if(c==='"') { if(quoted && csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=rows.shift()??[];
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export function saleComparables(rows: Record<string,string>[], cityCode: string, surface: number, propertyType: string, now = new Date()) {
  const groups = new Map<string, Record<string,string>[]>();
  for(const r of rows){ const k=r.id_mutation; if(k) groups.set(k,[...(groups.get(k)??[]),r]); }
  const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear()-2);
  // Multi-line transactions can bundle land/lots: exclude rather than divide the full price by one unit.
  return [...groups.values()].filter(g=>g.length===1).map(g=>g[0]).filter(r=> {
    const area=Number(r.surface_reelle_bati), price=Number(r.valeur_fonciere), date=new Date(r.date_mutation);
    return r.code_commune===cityCode && r.nature_mutation==='Vente' && r.type_local===propertyType &&
      date>=cutoff && date<=now && area>=surface*.65 && area<=surface*1.35 && price>1000 && price/area>=100 && price/area<=30000;
  }).map(r=>({id:r.id_mutation,date:r.date_mutation,price:Number(r.valeur_fonciere),surface:Number(r.surface_reelle_bati),pricePerSqm:Number(r.valeur_fonciere)/Number(r.surface_reelle_bati)}));
}
export async function enrich(values: Record<string, any>, evidence: AnalysisEvidence, get = safeGet) {
  const record=(name:string,url:string,status:SourceEvidence['status'],detail:string)=>evidence.sources.push({name,url,status,detail,retrievedAt:new Date().toISOString()});
  const query=[values.street??values.address,values.postalCode,values.city].filter(Boolean).join(' ');
  if(!query) {evidence.warnings.push('Adresse ou ville manquante : données locales indisponibles.');return;}
  const geoUrl=`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=3`;
  try {
    const data=JSON.parse((await get(geoUrl)).text);
    const features=(data.features??[]).filter((f:any)=> f.properties?.score>=.7 && (!values.postalCode || f.properties.postcode===values.postalCode));
    const f=features[0];
    if(!f || features.some((x:any)=>x.properties.citycode!==f.properties.citycode && Math.abs(x.properties.score-f.properties.score)<.08)) {
      record('IGN / BAN',geoUrl,'insufficient','Localisation ambiguë : préciser l’adresse.');return;
    }
    const [lng,lat]=f.geometry.coordinates, code=f.properties.citycode;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!/^\d[\dAB]\d{3}$/.test(code)) throw new Error('Localisation invalide');
    evidence.location={lat,lng,cityCode:code,label:f.properties.label,precision:f.properties.type,confidence:f.properties.type==='housenumber'?'high':'medium'};
    values.lat=lat;values.lng=lng;
    record('IGN / BAN',geoUrl,'available',`${f.properties.label} · précision ${f.properties.type} ; ne garantit pas l’adresse réelle de l’annonce.`);
  }catch{record('IGN / BAN',geoUrl,'unavailable','Géocodage indisponible.');return;}
  const code=evidence.location!.cityCode;
  const year=new Date().getFullYear()-1;
  const dep=code.startsWith('97')?code.slice(0,3):code.slice(0,2);
  const riskUrl=`https://www.georisques.gouv.fr/api/v1/gaspar/risques?code_insee=${code}&page_size=100`;
  await Promise.allSettled([
    (async()=>{
      try{
        const json=JSON.parse((await get(riskUrl)).text);
        if(!Array.isArray(json.data)) throw new Error();
        evidence.riskLabels=[...new Set<string>(json.data.filter((d:any)=>d.code_insee===code).flatMap((d:any)=>(d.risques_detail??[]).map((r:any)=>r.libelle_risque_long)).filter((x:any)=>typeof x==='string'))];
        record('Géorisques / GASPAR',riskUrl,'available',`${evidence.riskLabels.length} risques recensés dans la commune. Exposition de la parcelle inconnue ; demander l’ERP.`);
        // Commune hazards are not parcel exposure and never become a fabricated numeric risk score.
      }catch{record('Géorisques / GASPAR',riskUrl,'unavailable','Risques indisponibles ; absence de données ≠ absence de risques.');}
    })(),
    (async()=>{
      const type=/^maison$/i.test(values.propertyType)?'Maison':/^appartement$/i.test(values.propertyType)?'Appartement':null;
      const all:Record<string,string>[]=[];
      for(const y of [year,year-1]){
        const url=`https://files.data.gouv.fr/geo-dvf/latest/csv/${y}/communes/${dep}/${code}.csv`;
        try{const r=await get(url,8_000_000); const rows=parseCsv(r.text); if(!rows[0]?.id_mutation)throw new Error();all.push(...rows);record(`DVF ${y} / DGFiP via Etalab`,url,'available',`${rows.length} lignes communales reçues ; ventes groupées exclues.`);}
        catch{record(`DVF ${y} / DGFiP via Etalab`,url,'unavailable','Millésime indisponible ou réponse trop volumineuse.');}
      }
      const comps=type && values.surface>0 ? saleComparables(all,code,values.surface,type):[];
      evidence.comparables=comps.slice(0,50);
      evidence.market={locationLabel:evidence.location!.label,comparableSaleCount:comps.length,dataConfidence:'low'};
      if(comps.length>=5){const prices=comps.map(c=>c.pricePerSqm).sort((a,b)=>a-b);const middle=Math.floor(prices.length/2);evidence.market.medianSalePricePerSqm=prices.length%2?prices[middle]:(prices[middle-1]+prices[middle])/2;evidence.market.dataConfidence=comps.length>=20?'medium':'low';}
      evidence.warnings.push(type ? `${comps.length} ventes simples comparables sur 24 mois, même commune, surface ±35 %. Médiane seulement à partir de 5 ventes.` : 'Immeuble ou type inconnu : les ventes d’appartements isolés ne sont pas des comparables fiables du bâtiment entier.');
    })(),
  ]);
  evidence.warnings.push('Loyers de marché, vacance locale, travaux et copropriété non vérifiés : fournir baux, comparables locatifs et devis.');
}
