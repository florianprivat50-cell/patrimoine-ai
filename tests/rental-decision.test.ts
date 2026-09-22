import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRentals, rentalDecision } from '../src/lib/rentalDecision';
import { computeProject } from '../src/lib/realestate';
import type { RealEstateProject } from '../src/types';

const p:RealEstateProject={id:'a',createdAt:'2026-09-22',name:'Immeuble',city:'Avranches',surface:180,price:220000,agencyFees:0,notaryFeesPct:8,works:20000,furniture:0,bankFees:1500,downPayment:15000,ratePct:3.5,durationYears:25,insurancePctYearly:.3,monthlyRent:2100,commercialMonthlyRent:0,vacancyPct:8,monthlyCharges:100,propertyTaxYearly:1500,ownerInsuranceYearly:0,managementPct:0,maintenancePct:5,taxRatePct:45,rentGrowthPct:0,valueGrowthPct:0};

test('comparison applies common credit without altering either saved dossier',()=>{
 const projects=[structuredClone(p),{...p,id:'b',price:185000,downPayment:25000,ratePct:4.5}];
 const before=structuredClone(projects),finance={downPayment:20000,ratePct:3,durationYears:20,insurancePctYearly:.2};
 const rows=compareRentals(projects,finance);
 for(const {decision:d} of rows){assert.ok(d.calculable);for(const [key,value]of Object.entries(finance))assert.equal(d.input[key],value);assert.equal(d.input.taxRatePct,0);assert.deepEqual(d.result,computeProject({...d.input,taxRatePct:0}));}
 assert.deepEqual(projects,before);
 assert.notEqual(rows[0].decision.result.monthlyLoanPayment,rows[1].decision.result.monthlyLoanPayment);
});

test('missing, invalid, seasonal and unfinished dossiers cannot receive a verdict',()=>{
 for(const change of [{price:0},{surface:undefined},{monthlyRent:0},{ratePct:NaN},{downPayment:1000000},{durationYears:20.5},{vacancyPct:101},{managementPct:95},{rentalMode:'saisonnier'},{mobileDraft:true}]){
  const d=rentalDecision({...p,...change} as RealEstateProject);assert.equal(d.calculable,false,JSON.stringify(change));assert.ok(d.issues.length);assert.equal('status' in d,false);
 }
 assert.equal(rentalDecision({...p,monthlyRent:0,commercialMonthlyRent:2100}).calculable,true);
});

test('verdict distinguishes monthly effort from a fragile or positive margin',()=>{
 for(const [monthlyRent,status]of [[1000,'Effort mensuel à prévoir'],[1750,'Équilibre sensible aux imprévus'],[3000,'Marge positive dans les deux scénarios']] as const){
  const d=rentalDecision({...p,monthlyRent});assert.ok(d.calculable);assert.equal(d.status,status);assert.ok(d.stress.monthlyCashflow<=d.result.monthlyCashflow);
 }
});

test('equilibrium price is a real before-tax boundary, not a market valuation',()=>{
 const d=rentalDecision({...p,monthlyRent:1300});assert.ok(d.calculable);assert.notEqual(d.targetPrice,null);
 assert.ok(d.targetPrice!<p.price);assert.ok(computeProject({...d.input,price:d.targetPrice!}).monthlyCashflow>=0);
 assert.ok(computeProject({...d.input,price:d.targetPrice!+1}).monthlyCashflow<0);
 const vacant=rentalDecision({...p,vacancyPct:100});assert.ok(vacant.calculable);assert.equal(vacant.result.breakEvenRent,null);assert.equal(vacant.targetPrice,null);
});

test('expired or future evidence never counts as recent references',()=>{
 const now=Date.parse('2026-09-22T12:00:00Z');
 const evidence:any={retrievedAt:'2026-09-22T00:00:00Z',fields:[{field:'monthlyRent',status:'conflict'}],market:{comparableSaleCount:12,comparableRentCount:3},location:{label:'Avranches'}};
 const current=rentalDecision({...p,evidence},now);assert.ok(current.calculable);assert.equal(current.saleCount,12);assert.equal(current.rentCount,3);assert.ok(current.gaps.some(x=>x.includes('contradictoires : loyer')));
 for(const date of ['2026-06-24T12:00:00Z','2026-09-23','invalid']){
  const d=rentalDecision({...p,evidence:{...evidence,retrievedAt:date}},now);assert.ok(d.calculable);assert.equal(d.saleCount,0);assert.equal(d.rentCount,0);assert.equal(d.referenceDate,null);
 }
});
