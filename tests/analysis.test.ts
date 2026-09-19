import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractListing } from '../netlify/functions/_shared/extraction';
import { publicIPv4, safeGet } from '../netlify/functions/_shared/http';
import { saleComparables, parseCsv, enrich } from '../netlify/functions/_shared/local-data';
import { computeDeal, effectiveProjectInputs } from '../src/lib/deal';
import { projectFeasibility, targetPriceForScore } from '../src/lib/projectAnalysis';
import { rankProjects } from '../src/lib/dealPipeline';
import { invalidateEvidence } from '../src/lib/evidence';
import { answerDealQuestion } from '../src/lib/dealAdvisor';
import { computeProject } from '../src/lib/realestate';
import type { RealEstateProject } from '../src/types';
export const fixture:RealEstateProject={id:'a',name:'Avranches',createdAt:new Date().toISOString(),price:170000,surface:100,city:'Avranches',postalCode:'50300',propertyType:'Maison',analysisMode:'approfondie',agencyFees:0,notaryFeesPct:8,works:15000,furniture:0,bankFees:1500,downPayment:30000,ratePct:3.5,durationYears:25,insurancePctYearly:.3,monthlyRent:2400,monthlyCharges:100,propertyTaxYearly:1200,ownerInsuranceYearly:200,managementPct:0,maintenancePct:5,vacancyPct:8,taxRatePct:30,rentGrowthPct:1,valueGrowthPct:1};
const listing=(price=170000)=>`<script type="application/ld+json">${JSON.stringify({'@type':'House',name:'Maison Avranches',offers:{price,priceCurrency:'EUR'},floorSize:{value:100},address:{addressLocality:'Avranches',postalCode:'50300'},monthlyRent:2400,energyClass:'D'})}</script>`;
test('extracts primary property; excludes unrelated organisation and recommendations',()=>{
  const r=extractListing(`<script type="application/ld+json">{"@type":"Organization","name":"Agence","price":999}</script>${listing()}<script type="application/json">{"recommended":[{"price":2,"surface":10,"city":"Paris"}]}</script>`,'https://example.com');assert.equal(r.values.price,170000);assert.equal(r.values.title,'Maison Avranches');assert.equal(r.values.monthlyRent,2400);assert.equal(r.fields.find(f=>f.field==='price')?.confidence,'medium');
});
test('conflicting numeric sources stay unresolved; malformed JSON falls back safely',()=>{
 const r=extractListing(listing()+`<meta property="product:price:amount" content="190000">`,'https://example.com');assert.equal(r.values.price,undefined);assert.equal(r.fields.find(f=>f.field==='price')?.status,'conflict');assert.equal(extractListing('<script type="application/ld+json">{bad}</script>','https://example.com').fields.length,0);
});
test('does not confuse five-digit sale price with postal code or annual income with monthly rent',()=>{
 const r=extractListing('<meta name="description" content="Prix : 95000 € ; revenus annuels 12000 € ; DPE inconnu">','https://example.com');assert.equal(r.values.price,95000);assert.equal(r.values.postalCode,undefined);assert.equal(r.values.monthlyRent,undefined);assert.equal(r.values.dpe,undefined);
});
test('SSRF: disallows local, private, link local, mapped IPv6 and non-HTTPS',async()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.0.1','172.31.0.1','100.64.0.1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false);
 await assert.rejects(()=>safeGet('http://example.com'));await assert.rejects(()=>safeGet('https://127.0.0.1'));assert.equal(publicIPv4('8.8.8.8'),true);
});
test('CSV parser handles quoted delimiters; DVF excludes grouped, old, other type/commune/surface',()=>{
 assert.equal(parseCsv('a,b\n"x,y","q""r"\n')[0].a,'x,y');
 const base={id_mutation:'1',code_commune:'50025',date_mutation:'2026-01-01',nature_mutation:'Vente',type_local:'Maison',surface_reelle_bati:'100',valeur_fonciere:'170000'};
 const rows=[base,{...base,id_mutation:'2'},{...base,id_mutation:'2'},{...base,id_mutation:'3',type_local:'Appartement'},{...base,id_mutation:'4',date_mutation:'2010-01-01'},{...base,id_mutation:'5',surface_reelle_bati:'300'}];
 assert.equal(saleComparables(rows,'50025',100,'Maison',new Date('2026-09-14')).length,1);
});
test('report, saved opportunity and assistant have the same score, capped without proof',()=>{
 const p={...fixture};const deal=computeDeal(effectiveProjectInputs(p));assert.equal(deal.score,projectFeasibility(p).score);assert.equal(rankProjects([p])[0].rankScore,deal.score);assert.ok(deal.score<=68);
 assert.match(answerDealQuestion('Compare mes opportunités',[p])!.data[0],new RegExp(`${deal.score}/100`));
 assert.equal(projectFeasibility({...p,monthlyRent:0}).score,0);
});
test('target solver refuses evidence-infeasible target and verifies attainable price',()=>{
 assert.equal(targetPriceForScore(fixture,80).price,null);const result=targetPriceForScore({...fixture,price:300000},60);assert.notEqual(result.price,null);assert.ok(projectFeasibility({...fixture,price:result.price!}).score>=60);assert.equal(targetPriceForScore(fixture,101).price,null);
});
test('editing location invalidates local evidence; price edits preserve location but lower field confidence',()=>{
 const e:any={version:1,retrievedAt:new Date().toISOString(),fields:[{field:'price',value:170000,status:'declared',confidence:'medium'}],location:{cityCode:'50025'},market:{medianSalePricePerSqm:2000},risks:{dpe:'D'},riskLabels:['Inondation'],sources:[],warnings:[]};
 const a=invalidateEvidence(e,{city:'Paris'})!;assert.equal(a.location,undefined);assert.equal(a.market.medianSalePricePerSqm,undefined);
 const b=invalidateEvidence(e,{price:160000})!;assert.equal(b.fields[0].status,'manual');assert.equal(b.location?.cityCode,'50025');assert.equal(e.fields[0].value,170000);
});
test('assistant asks for selection and simulations never mutate saved project',()=>{
 const copy=structuredClone(fixture);const second={...fixture,id:'b',name:'Granville'};
 assert.match(answerDealQuestion('Quel prix pour atteindre 80/100 ?',[fixture,second])!.conclusion,/Sélectionnez/);
 const a=answerDealQuestion('Simule 30 000 € de travaux',[fixture],fixture.id)!;assert.match(a.conclusion,/30/);assert.deepEqual(fixture,copy);
});
test('break-even rent reconciles with after-tax cash flow',()=>{
 const r=computeProject(fixture);assert.notEqual(r.breakEvenRent,null);const at=computeProject({...fixture,monthlyRent:r.breakEvenRent!});assert.ok(Math.abs(at.monthlyCashflow)<.0001);
});
test('local pipeline retains geolocation and flags failed providers rather than inventing values',async()=>{
 const e:any={version:1,retrievedAt:new Date().toISOString(),fields:[],sources:[],market:{},risks:{},riskLabels:[],warnings:[]};
 const get=async(url:string)=>{if(url.includes('geocodage'))return {text:JSON.stringify({features:[{properties:{score:.9,postcode:'50300',citycode:'50025',label:'Avranches',type:'municipality'},geometry:{coordinates:[-1.34,48.67]}}]}),url,type:'application/json'};throw new Error('Source unavailable');};
 await enrich({city:'Avranches',postalCode:'50300',surface:100,propertyType:'Maison'},e,get);
 assert.equal(e.location.cityCode,'50025');assert.equal(e.market.medianSalePricePerSqm,undefined);assert.equal(e.sources.filter((s:any)=>s.status==='unavailable').length,3);assert.equal(e.risks.geoRiskScore,undefined);
});
test('ambiguous geolocation does not fetch data for an arbitrary commune',async()=>{
 const e:any={fields:[],sources:[],market:{},risks:{},riskLabels:[],warnings:[]};let calls=0;
 const get=async(url:string)=>{calls++;return {text:JSON.stringify({features:['50025','50129'].map((citycode,i)=>({properties:{score:.9-i*.01,citycode},geometry:{coordinates:[-1,48]}}))}),url,type:'application/json'};};
 await enrich({city:'Saint Pierre'},e,get);assert.equal(calls,1);assert.equal(e.location,undefined);assert.equal(e.sources[0].status,'insufficient');
});
