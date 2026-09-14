const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const at=new Date().toISOString();const evidence={version:1,retrievedAt:at,fields:['price','surface','monthlyRent'].map((field,i)=>({field,value:[170000,100,2400][i],source:'JSON-LD de l’annonce',url:'https://example.com/maison',retrievedAt:at,confidence:'medium',status:'declared'})),sources:[{name:'IGN / BAN',url:'https://data.geopf.fr',status:'available',detail:'Avranches, commune',retrievedAt:at}],location:{lat:48.67,lng:-1.34,cityCode:'50025',label:'Avranches',precision:'municipality',confidence:'medium'},market:{medianSalePricePerSqm:2200,comparableSaleCount:30,dataConfidence:'medium'},risks:{dpe:'D',dataConfidence:'low'},riskLabels:['Inondation'],warnings:['Loyer de marché non vérifié.']};
let blocked=false;
await page.route('**/.netlify/functions/analyze-listing',route=>route.fulfill({status:blocked?422:200,contentType:'application/json',body:JSON.stringify(blocked?{ok:false,error:'Portail inaccessible.'}:{ok:true,title:'Maison Avranches',price:170000,surface:100,monthlyRent:2400,propertyTaxYearly:1200,yearlyCharges:1200,city:'Avranches',postalCode:'50300',evidence,extracted:evidence.fields})}));
await page.goto('http://127.0.0.1:5199');
await page.getByLabel('Type de bien').selectOption('Maison');await page.getByLabel('URL de l’annonce').fill('https://example.com/maison');await page.getByRole('button',{name:'Analyser l’annonce',exact:true}).click();
await page.getByText('Annonce analysée',{exact:true}).waitFor();
assert.equal(await page.locator('.quick-grid label').filter({hasText:'Loyers / mois'}).locator('input').inputValue(),'2400');
assert.equal(await page.locator('.quick-grid label').filter({hasText:'Charges propriétaire / mois'}).locator('input').inputValue(),'100');
await page.getByRole('button',{name:'Calculer le prix cible',exact:true}).click();await page.getByRole('status').filter({hasText:'Objectif inaccessible'}).waitFor();
const score=await page.locator('.score-ring strong').innerText();
await page.getByRole('button',{name:'Enregistrer cette opportunité',exact:true}).click();
for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow home ${width}`);}
await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;});
assert.equal(await page.locator('.invest-hero h1').evaluate(e=>e.getBoundingClientRect().left>=0),true,'Hero clipped');
const output=path.resolve(process.env.QA_OUTPUT_DIR||'tests/artifacts');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'analyse-mobile.png'),fullPage:true});
await page.goto('http://127.0.0.1:5199/projets');assert.equal(await page.locator('.rank-score strong').innerText(),score);await page.getByRole('link',{name:'Maison Avranches →'}).click();assert.equal(await page.locator('.score-ring strong').innerText(),score);await page.getByText('Risques communaux :',{exact:false}).waitFor();
await page.goto('http://127.0.0.1:5199/analyse');await page.getByLabel('Dossier pour les simulations').selectOption({label:'Maison Avranches'});await page.getByRole('button',{name:'Quel prix pour atteindre 80/100 ?',exact:true}).click();await page.getByText(/Maison Avranches : 80\/100 inaccessible/).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow assistant');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'assistant-mobile.png'),fullPage:true});
await page.goto('http://127.0.0.1:5199');blocked=true;await page.getByLabel('URL de l’annonce').fill('https://example.com/blocked');await page.getByRole('button',{name:'Analyser l’annonce',exact:true}).click();await page.getByText('Analyse incomplète',{exact:true}).waitFor();assert.equal(await page.locator('.quick-grid label').filter({hasText:'Loyers / mois'}).locator('input').inputValue(),'0');assert.equal(await page.getByRole('button',{name:'Enregistrer cette opportunité',exact:true}).isDisabled(),true);
assert.deepEqual(errors,[]);await browser.close();console.log('PASS: extraction mapping, score persistence, target infeasible, assistant selection, failed import reset, 360/390/768/1440px without horizontal overflow, no page errors');
})().catch(e=>{console.error(e);process.exit(1)});
