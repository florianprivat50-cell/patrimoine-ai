const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {spawn}=require('node:child_process');
let server;
async function startServer(){server=spawn(process.execPath,['--import','./tests/register.mjs','tests/server.mjs'],{cwd:process.cwd(),env:{...process.env,QA_PORT:'5201'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.on('data',()=>resolve());server.once('error',reject);server.once('exit',code=>code&&reject(new Error('QA server exited '+code)));});}
async function stopServer(){if(!server)return;const child=server;server=null;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
(async()=>{await startServer();
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5201',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const cdp=await context.newCDPSession(page);const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors.filter(e=>e.errorId!=="in-incognito"),[],'Chromium installability');
 // Suppress the browser prompt in this test so that we can verify the fallback instructions.
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Installer l’application',exact:true}).waitFor();
 // Test manual instructions without displaying any OS installation dialog.
 await page.addInitScript(()=>window.addEventListener('beforeinstallprompt',e=>e.stopImmediatePropagation()));await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Installer l’application',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').evaluate(d=>d.contains(document.activeElement)),true,'Dialog focus');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 const output=path.resolve(process.env.QA_OUTPUT_DIR||'tests/artifacts');fs.mkdirSync(output,{recursive:true});
 for(const width of [360,390,768,1024,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}`);assert.ok(await page.locator('.invest-hero h1').evaluate(e=>e.getBoundingClientRect().left>=0));if(width===390||width===1440)await page.screenshot({timeout:10000,path:path.join(output,`experience-${width}.png`)});}
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Installer l’application',exact:true}).click();await page.screenshot({path:path.join(output,'installation-mobile.png')});await page.keyboard.press('Escape');
 const reduced=await page.locator('.page-stage').evaluate(e=>getComputedStyle(e).animationName);assert.equal(reduced,'none');
 // A new worker must wait without discarding form input; only the explicit update reloads.
 const swPath=path.resolve('dist/sw.js'),originalWorker=fs.readFileSync(swPath,'utf8');
 try{
  await page.locator('.quick-grid label').filter({hasText:'Prix d’achat'}).locator('input').fill('123456');
  fs.writeFileSync(swPath,originalWorker.replace(/const CACHE = '([^']+)'/,(_m,key)=>"const CACHE = '"+key+"-update-test'"));
  await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update()});
  await page.getByRole('button',{name:'Mettre à jour',exact:true}).waitFor();
  assert.equal(await page.locator('.quick-grid label').filter({hasText:'Prix d’achat'}).locator('input').inputValue(),'123456');
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Mettre à jour',exact:true}).click()]);
  await page.getByRole('heading',{name:/Un lien d’annonce/}).waitFor();
 }finally{fs.writeFileSync(swPath,originalWorker);}
 await page.locator('.quick-grid label').filter({hasText:'Prix d’achat'}).locator('input').fill('170000');
 await page.locator('.quick-grid label').filter({hasText:'Surface'}).locator('input').fill('100');
 await page.locator('.quick-grid label').filter({hasText:'Loyers / mois'}).locator('input').fill('2000');
 await page.getByRole('button',{name:'Enregistrer cette opportunité',exact:true}).click();
 // Test navigation to an unvisited lazy route while offline, then a cold page reload.
 console.log('Checking offline navigation');await stopServer();await context.setOffline(true);await page.goto('http://127.0.0.1:5201/projets',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Mes analyses',exact:true}).waitFor();await page.getByRole('link',{name:'Nouvelle opportunité →',exact:true}).waitFor();await page.getByText('Vous êtes hors connexion.',{exact:false}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Mes analyses',exact:true}).waitFor();
 const api=await page.evaluate(async()=>{try{await fetch('/.netlify/functions/analyze-listing',{method:'POST',body:'{}',signal:AbortSignal.timeout(3000)});return false;}catch{return true;}});assert.equal(api,true,'Offline API must not return cached HTML');
 const cachesUsed=await page.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('patrimoine-app-'));const cache=await caches.open(key);return(await cache.keys()).map(x=>new URL(x.url).pathname);});assert.ok(cachesUsed.some(k=>k.includes('Opportunites')));assert.ok(cachesUsed.every(k=>!k.startsWith('/.netlify/')));
 console.log('Offline checks passed');await startServer();await context.setOffline(false);assert.deepEqual(errors,[]);
 await context.close();
 // iPhone help text is independently checked; this does not simulate an actual iOS installation.
 const iphone=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',serviceWorkers:'block',reducedMotion:'reduce'});await iphone.addInitScript(()=>window.addEventListener('beforeinstallprompt',e=>e.stopImmediatePropagation()));const ip=await iphone.newPage();await ip.goto('http://127.0.0.1:5201',{waitUntil:'domcontentloaded'});await ip.getByRole('button',{name:'Installer l’application',exact:true}).click();await ip.getByText('Ouvrez le site dans Safari.',{exact:true}).waitFor();await ip.keyboard.press('Escape');
 await ip.emulateMedia({reducedMotion:'no-preference'});
 let release;const gate=new Promise(resolve=>release=resolve);await ip.route('**/.netlify/functions/analyze-listing',async route=>{await gate;await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:false,error:'Fixture: source indisponible'})});});
 await ip.getByLabel('URL de l’annonce').fill('https://example.com/motion-test');await ip.getByRole('button',{name:'Analyser l’annonce',exact:true}).click();await ip.getByText('Votre dossier prend forme',{exact:true}).waitFor();
 assert.equal(await ip.locator('.progress-orbit').evaluate(e=>getComputedStyle(e).animationName),'orbit');
 await ip.emulateMedia({reducedMotion:'reduce'});assert.equal(await ip.locator('.progress-orbit').evaluate(e=>getComputedStyle(e).animationName),'none');release();await ip.getByText('Analyse incomplète',{exact:true}).waitFor();
 console.log('Closing browser');await browser.close();await stopServer();console.log('PASS: installable manifest, install guidance + focus/Escape, iPhone instructions, 5 widths, reduced motion, offline lazy route + reload, API excluded from cache, explicit worker update, loading motion and reduced-motion override.');
})().catch(async e=>{console.error(e);await stopServer();process.exit(1)});
