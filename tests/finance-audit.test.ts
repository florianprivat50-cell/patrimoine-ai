import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProject, scenarioInputs, maxPriceForTargetYield } from '../src/lib/realestate';
import { irr, monthlyPayment, remainingBalance } from '../src/lib/finance';
import { mobileAnalysis } from '../src/lib/mobileAnalysis';
import { projectFeasibility } from '../src/lib/projectAnalysis';
import type { RealEstateProjectInputs } from '../src/types';

const p: RealEstateProjectInputs = {price:220000,agencyFees:0,notaryFeesPct:8,works:20000,furniture:0,bankFees:1500,downPayment:15000,ratePct:3.5,durationYears:25,insurancePctYearly:.3,monthlyRent:2100,commercialMonthlyRent:0,vacancyPct:8,monthlyCharges:100,propertyTaxYearly:1500,ownerInsuranceYearly:0,managementPct:0,maintenancePct:5,taxRatePct:0,rentGrowthPct:0,valueGrowthPct:0};
const near = (a:number,b:number) => assert.ok(Math.abs(a-b)<.01, `${a} != ${b}`);

test('loan payments match discounted instalments and iterative balances in 60 cases',()=>{
 for(const capital of [50000,200000,500000])for(const rate of [0,1.5,3.5,6,12])for(const years of [1,10,25,40]){
  let annuity=0;for(let m=1;m<=years*12;m++)annuity+=(1+rate/1200)**(-m);
  const pay=capital/annuity;near(monthlyPayment(capital,rate,years),pay);
  let balance=capital;for(let m=1;m<=years*12;m++){balance=balance*(1+rate/1200)-pay;near(remainingBalance(capital,rate,years,m),balance);}
 }
});
test('mobile figures match the independent audit example and remain before tax',()=>{
 const result=mobileAnalysis({...p,taxRatePct:45});near(result.total,259100);near(result.loan,244100);
 near(result.monthlyPayment,1283.047135);near(result.cashflow,327.352865);
 assert.ok(result.checks.some(x=>x.includes('Impôts non calculés')));
});
test('prudent assumptions never improve cash flow, including high vacancy and tiny rents',()=>{
 for(const vacancyPct of [0,8,30,40,99,100])for(const monthlyRent of [.1,.6,2100]){
  const q={...p,vacancyPct,monthlyRent,works:0,downPayment:300000,monthlyCharges:0,propertyTaxYearly:0};const adverse=scenarioInputs(q,'prudent');
  assert.ok(adverse.vacancyPct>=vacancyPct);assert.ok(computeProject(adverse).monthlyCashflow<=computeProject(q).monthlyCashflow+.001);
 }
});
test('equilibrium is impossible at total vacancy; total residential and commercial rent reconciles',()=>{
 assert.equal(computeProject({...p,vacancyPct:100}).breakEvenRent,null);
 assert.equal(computeProject({...p,managementPct:95,maintenancePct:5}).breakEvenRent,null);
 for(const taxRatePct of [0,30]){
  const q={...p,taxRatePct,commercialMonthlyRent:400};const r=computeProject(q);
  assert.notEqual(r.breakEvenRent,null);near(computeProject({...q,monthlyRent:r.breakEvenRent!-400}).monthlyCashflow,0);
 }
});
test('maximum price finds a real boundary beyond the previous fixed search limit',()=>{
 const q={...p,price:50000,monthlyRent:5000};const max=computeProject(q).maxPrice!;
 assert.ok(max>300000);near(computeProject({...q,price:max}).monthlyCashflow,0);
 assert.ok(computeProject({...q,price:max+1}).monthlyCashflow<0);
 const target=maxPriceForTargetYield(q,1)!;assert.ok(target>350000);near(computeProject({...q,price:target}).netAfterTaxYieldPct,1);
 assert.equal(computeProject({...p,monthlyRent:0}).maxPrice,null);
});
test('IRR has no fictitious initial investment or arbitrary root',()=>{
 assert.equal(computeProject({...p,downPayment:0}).irrPct,null);
 near(irr([-100,110])!,10);near(irr([-1,101])!,10000);
 assert.equal(irr([-100,230,-132]),null);assert.equal(irr([0,100]),null);
});
test('expired and future-dated evidence do not affect market or property scores',()=>{
 const evidence:any={retrievedAt:'2000-01-01',fields:[],market:{medianSalePricePerSqm:50000,rentalDemandScore:100,comparableSaleCount:100,dataConfidence:'high'},risks:{dpe:'A',geoRiskScore:0,dataConfidence:'high'},location:{confidence:'high'}};
 const baseline=projectFeasibility(p);
 assert.deepEqual(projectFeasibility({...p,evidence}),baseline);
 evidence.retrievedAt='2099-01-01';assert.deepEqual(projectFeasibility({...p,evidence}),baseline);
});
