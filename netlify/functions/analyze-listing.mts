import type { Config } from '@netlify/functions';
import type { AnalysisEvidence } from '../../src/lib/evidence';
import { safeGet } from './_shared/http';
import { extractListing } from './_shared/extraction';
import { enrich } from './_shared/local-data';
export default async (req: Request) => {
  if(req.method!=='POST')return Response.json({ok:false,error:'Méthode non autorisée.'},{status:405});
  let url: URL; let body: any;
  try { const raw=await req.text();if(raw.length>20000)throw new Error();body=JSON.parse(raw); }
  catch{return Response.json({ok:false,error:'Requête invalide.'},{status:400});}
  if(body.mode==='local'){
    const manual=body.manual??{};
    const values:Record<string,any>={};
    for(const key of ['city','postalCode','address','propertyType'])if(typeof manual[key]==='string')values[key]=manual[key].slice(0,200);
    for(const key of ['surface','price'])if(Number.isFinite(manual[key])&&manual[key]>0)values[key]=manual[key];
    const evidence:AnalysisEvidence={version:1,retrievedAt:new Date().toISOString(),fields:[],sources:[],market:{},risks:{dataConfidence:'unknown'},riskLabels:[],warnings:[]};
    await enrich(values,evidence);
    return Response.json({ok:!!evidence.location,evidence,lat:values.lat,lng:values.lng,warnings:evidence.warnings,error:evidence.location?undefined:'Localisation non confirmée : préciser l’adresse.'});
  }
  try { url=new URL(String(body.url??''));if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw new Error(); }
  catch{return Response.json({ok:false,error:'Lien HTTPS d’annonce invalide.'},{status:400});}
  const at=new Date().toISOString();
  const evidence:AnalysisEvidence={version:1,retrievedAt:at,fields:[],sources:[],market:{},risks:{dataConfidence:'unknown'},riskLabels:[],warnings:[]};
  try {
    const page=await safeGet(url.href);
    if(!/text\/html|application\/xhtml/.test(page.type))throw new Error('La source n’est pas une page HTML.');
    const {values,fields}=extractListing(page.text,page.url);
    // Explicit user-selected type controls DVF comparability, never inferred from a default building size.
    values.propertyType=['Maison','Appartement','Immeuble'].includes(body.propertyType)?body.propertyType:undefined;
    evidence.fields=fields;
    evidence.sources.push({name:url.hostname,url:page.url,status:'available',detail:'Déclarations du vendeur, non vérifiées indépendamment.',retrievedAt:at});
    evidence.risks={dpe:values.dpe,dataConfidence:'low'};
    await enrich(values,evidence);
    for(const key of ['price','surface','monthlyRent','city'])if(values[key]==null)evidence.warnings.push(`${key} : information manquante ou contradictoire, à renseigner.`);
    return Response.json({ok:fields.some(f=>['price','surface','city'].includes(f.field)),source:url.hostname,...values,confidence:'low',extracted:fields,evidence,warnings:evidence.warnings});
  }catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:'Annonce inaccessible.',source:url.hostname},{status:422});}
};
export const config:Config={path:'/.netlify/functions/analyze-listing'};
