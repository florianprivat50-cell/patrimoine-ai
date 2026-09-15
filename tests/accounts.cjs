const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
const base='http://127.0.0.1:5203';let server;
const empty=()=>({onboarded:false,profile:null,assets:[],liabilities:[],goals:[],projects:[],snapshots:[],chat:[],pipeline:{}});
const records=new Map();let sequence=0;
const users={alice:{id:'alice',email:'alice@example.test',confirmed_at:'2026-01-01T00:00:00Z',user_metadata:{full_name:'Alice'},app_metadata:{provider:'email'}},bob:{id:'bob',email:'bob@example.test',confirmed_at:'2026-01-01T00:00:00Z',user_metadata:{full_name:'Bob'},app_metadata:{provider:'email'}}};
const expires=Math.floor(Date.now()/1000)+3600;
const token=id=>Buffer.from(JSON.stringify({alg:'none'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,email:users[id].email,exp:expires})).toString('base64url')+'.test';
function owner(req){const auth=req.headers()['authorization']||req.headers()['cookie']||'';return Object.keys(users).find(id=>auth.includes(token(id)));}
async function mock(context,control={}){
 await context.route('**/.netlify/identity/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname.split('/').pop();const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(p==='token'){const data=new URLSearchParams(req.postData());const id=Object.keys(users).find(id=>users[id].email===data.get('username'));if(!id||data.get('password')!=='Correct-password-123')return json({error_description:'Invalid login'},400);return json({access_token:token(id),refresh_token:'refresh-'+id,expires_in:3600,token_type:'bearer',user:users[id]});}
  if(p==='verify')return json({access_token:token('alice'),refresh_token:'refresh-alice',expires_in:3600,token_type:'bearer',user:users.alice});
  if(p==='user'){if(req.method()==='PUT')control.lastPassword=JSON.parse(req.postData()).password;const id=owner(req);return id?json(users[id]):json({msg:'Unauthorized'},401);}
  if(p==='signup')return json({id:'new',email:JSON.parse(req.postData()).email,user_metadata:{},app_metadata:{}});
  if(p==='recover'||p==='logout')return json({});
  if(p==='settings')return json({autoconfirm:false,disable_signup:false,external:{email:true}});
  return json({},404);
 });
 await context.route('**/.netlify/functions/account',async route=>{
  if(control.offline)return route.abort('internetdisconnected');
  const req=route.request(),id=owner(req);const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)});
  if(!id)return json({error:'Reconnectez-vous.'},401);
  const record=records.get(id)||{data:empty(),revision:null,updatedAt:null};
  if(req.method()==='GET')return json({...record,userId:id});
  const body=JSON.parse(req.postData());if(body.revision!==record.revision)return json({error:'Conflit'},409);
  const next={data:body.data,revision:'r'+(++sequence),updatedAt:new Date().toISOString()};records.set(id,next);return json({...next,userId:id});
 });
}
async function login(page,id){await page.goto(base+'/compte');await page.getByLabel('Adresse e-mail',{exact:true}).fill(users[id].email);await page.locator('input[type=password]').fill('Correct-password-123');await page.getByRole('button',{name:'Me connecter',exact:true}).click();await page.getByRole('heading',{name:'Mon compte',exact:true}).waitFor();}
async function saved(page){try{await page.locator('.app-content>.account-status-saved').waitFor();}catch(e){console.log(await page.locator('body').innerText());throw e;}}
async function profile(page,name){await page.goto(base+'/profil');await page.getByText('Prénom',{exact:true}).locator('..').locator('input').fill(name);await saved(page);}
(async()=>{
 server=spawn(process.execPath,['--import','./tests/register.mjs','tests/server.mjs'],{env:{...process.env,QA_PORT:'5203'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const control={};const a=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});await mock(a,control);const page=await a.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/compte');await page.getByLabel('Adresse e-mail',{exact:true}).fill(users.alice.email);await page.locator('input[type=password]').fill('wrong');await page.getByRole('button',{name:'Me connecter',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Créer un compte',exact:true}).click();await page.getByLabel('Adresse e-mail',{exact:true}).fill('new@example.test');await page.locator('input[type=password]').fill('New-password-123');await page.getByRole('button',{name:'Créer mon compte',exact:true}).click();await page.getByText(/Consultez votre boîte e-mail/).waitFor();
  await page.getByRole('button',{name:'Mot de passe oublié ?',exact:true}).click();await page.getByRole('button',{name:'Recevoir un lien',exact:true}).click();await page.getByText(/Si cette adresse correspond/).waitFor();
  console.log('Auth forms checked');await login(page,'alice');console.log('Alice signed in');await profile(page,'Alice privée');
  await page.goto(base);await page.locator('.quick-grid label').filter({hasText:'Prix d’achat'}).locator('input').fill('170000');await page.locator('.quick-grid label').filter({hasText:'Surface'}).locator('input').fill('100');await page.locator('.quick-grid label').filter({hasText:'Loyers / mois'}).locator('input').fill('2000');await page.getByRole('button',{name:'Enregistrer cette opportunité',exact:true}).click();await saved(page);
  await page.goto(base+'/projets');await page.locator('.rank-card select').selectOption('visite');await saved(page);
  assert.equal(records.get('alice').data.projects.length,1);assert.equal(Object.values(records.get('alice').data.pipeline)[0].stage,'visite');
  // A genuinely separate browser context has no local application data.
  const b=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await mock(b);const second=await b.newPage();await login(second,'alice');console.log('Second device signed in');await second.goto(base+'/projets');await second.locator('.rank-card').waitFor();assert.equal(await second.locator('.rank-card select').inputValue(),'visite');await page.goto(base+'/profil');await profile(second,'Alice second appareil');
  // Stale device must preserve its local edit rather than overwrite the server.
  await page.getByText('Prénom',{exact:true}).locator('..').locator('input').fill('Alice conflit');await page.locator('.app-content>.account-status-conflict').waitFor();assert.equal(records.get('alice').data.profile.firstName,'Alice second appareil');
  await page.goto(base+'/compte');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Charger la version du compte',exact:true}).click();await saved(page);
  // A disconnected write survives reload and resumes with the same account.
  control.offline=true;await page.goto(base+'/profil');await page.getByText('Prénom',{exact:true}).locator('..').locator('input').fill('Alice hors ligne');await page.locator('.app-content>.account-status-error').waitFor();await page.reload();await page.getByText('Prénom',{exact:true}).locator('..').locator('input').waitFor();assert.equal(await page.getByText('Prénom',{exact:true}).locator('..').locator('input').inputValue(),'Alice hors ligne');
  control.offline=false;await page.getByRole('button',{name:'Réessayer',exact:true}).click();await saved(page);assert.equal(records.get('alice').data.profile.firstName,'Alice hors ligne');
  await page.goto(base+'/compte');const out=path.resolve(process.env.QA_OUTPUT_DIR||'tests/artifacts');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'account-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await page.getByRole('button',{name:'Me connecter',exact:true}).waitFor();await page.evaluate(data=>localStorage.setItem('patrimoine-ia',JSON.stringify({state:data})),{...empty(),profile:{firstName:'Ancien profil'}});await login(page,'bob');await page.getByRole('button',{name:'Importer mes données locales',exact:true}).click();await saved(page);assert.equal(records.get('bob').data.profile.firstName,'Ancien profil');await page.goto(base+'/projets');await page.getByText('Aucune opportunité enregistrée',{exact:true}).waitFor();assert.equal(await page.locator('.rank-card').count(),0);
  await page.goto(base+'/compte');await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await login(page,'alice');await page.goto(base+'/projets');await page.locator('.rank-card').waitFor();assert.deepEqual(errors,[]);
  await second.goto(base+'/compte');await second.screenshot({path:path.join(out,'account-desktop.png'),fullPage:true});
  const recovery=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});const recoveryControl={};await mock(recovery,recoveryControl);const rp=await recovery.newPage();await rp.goto(base+'/#recovery_token=test');await rp.getByRole('heading',{name:'Choisissez votre mot de passe',exact:true}).waitFor();await rp.locator('input[type=password]').fill('Replacement-password-123');await rp.getByRole('button',{name:'Enregistrer le mot de passe',exact:true}).click();await rp.getByRole('heading',{name:/Un lien d’annonce/}).waitFor();assert.equal(recoveryControl.lastPassword,'Replacement-password-123');
  console.log('PASS: login errors, signup confirmation, recovery request, account save, second-device restoration, pipeline, conflict, offline retry, logout/login isolation, mobile layout. Identity and account transport mocked; production activation remains a separate check.');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);server?.kill();process.exitCode=1;});
