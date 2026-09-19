'use strict';
/* DOM presentation only. Identity, per-account persistence and finance run in the shared bridge. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const icon=n=>'<svg class="icon" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>Number.isFinite(n)?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n):'—';
const dec=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n);
const signed=n=>(n>=0?'+':'−')+euro(Math.abs(n));
const num=['surface','price','monthlyRent','works','downPayment','rate','years','notary','fees','insurance','tax','charges','vacancy','maintenance','agency','furniture','pno','management','commercial'];
const base={name:'',city:'',postalCode:'',address:'',propertyType:'Immeuble',surface:'',price:'',monthlyRent:'',works:0,downPayment:15000,rate:3.5,years:25,notary:8,fees:1500,insurance:.3,tax:1500,charges:100,vacancy:8,maintenance:5,agency:0,furniture:0,pno:0,management:0,commercial:0,listingUrl:''};
let backend=null,auth={user:null,status:'loading',ready:false,projects:[]},mode='mine',authMode='login',authBusy=false;
let favoritesOnly=false,sort='recent',editing=null,step=1,activeTrigger=null,toastTimer,resultMode='declared',requestSequence=0;
let demos=[{...base,id:'demo-1',name:'L’immeuble du centre',city:'Avranches',postalCode:'50300',surface:180,price:220000,monthlyRent:2100,works:15000,tax:2100,createdAt:'2026-09-19T10:00:00Z',mobileDraft:false},
{...base,id:'demo-2',name:'L’appartement lumineux',city:'Rennes',postalCode:'35000',propertyType:'Appartement',surface:62,price:185000,monthlyRent:850,works:5000,downPayment:25000,tax:1100,charges:80,createdAt:'2026-09-18T10:00:00Z',mobileDraft:false}];
const id=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const budget=p=>Number(p.price)*(1+Number(p.notary)/100)+Number(p.works)+Number(p.fees)+Number(p.agency)+Number(p.furniture);
const locality=p=>[p.city,p.postalCode,p.address,p.propertyType,p.surface].map(x=>String(x??'').trim().toLowerCase()).join('|');
function usable(p){return p&&String(p.name).trim()&&String(p.city).trim()&&Number(p.price)>0&&Number(p.surface)>0&&num.every(k=>Number.isFinite(Number(p[k]))&&Number(p[k])>=0)&&p.years>=1&&p.years<=40&&Number.isInteger(Number(p.years))&&p.rate<=30&&p.notary<=30&&p.insurance<=10&&p.vacancy<=100&&Number(p.maintenance)+Number(p.management)<100&&p.downPayment<=budget(p);}
function calculate(p){if(!backend)throw Error('Le moteur n’est pas encore chargé.');return backend.calculate(p);}
function today(){return new Date().toISOString().slice(0,10);}
function localReady(p){const x=p.localScenario;return !!(x&&x.locationKey===locality(p)&&x.rent!==''&&x.vacancy!==''&&Number.isFinite(Number(x.rent))&&Number(x.rent)>=0&&Number(x.rent)<=1000000&&Number(x.vacancy)>=0&&Number(x.vacancy)<=100&&String(x.source||'').trim()&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')&&Number.isFinite(Date.parse(x.date))&&x.date<=today());}
function evaluated(p){return resultMode==='local'&&localReady(p)?{...p,monthlyRent:Number(p.localScenario.rent),commercial:0,vacancy:Number(p.localScenario.vacancy)}:p;}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function showDialog(id){activeTrigger=document.activeElement;$('#'+id).showModal();}
function closeDialog(id){$('#'+id).close();if(id==='editor'){requestSequence++;editing=null;}if(activeTrigger?.isConnected)activeTrigger.focus();}
function label(){if(mode==='demo')return 'Démonstration · rien n’est envoyé au compte';if(!auth.user)return auth.status==='loading'?'Initialisation…':'Connectez-vous pour conserver vos dossiers';return ({loading:'Chargement du compte…',saved:'Sauvegardé dans mon compte',saving:'Sauvegarde en cours…',pending:'Sauvegarde en attente',conflict:'Deux versions à départager',error:'Sauvegarde non confirmée'})[auth.status]||'Sauvegarde en attente';}
function renderAccount(){
 const text=label();$('#sync-label').textContent=text;$('.local-tag').textContent=text;$('#sync-line').classList.toggle('sync-error',['error','conflict'].includes(auth.status));
 $('#account-email').textContent=auth.user?.email||'Aucun compte connecté';$('#account-state').textContent=(auth.message?auth.message+' ': '')+text;
 $('#conflict-actions').hidden=auth.status!=='conflict';$('#sync-account').disabled=!auth.user||auth.status==='conflict';
 $('#save-hint').textContent=mode==='demo'?'Démo en mémoire uniquement, effacée à la fermeture.':text+(auth.message?' · '+auth.message:'');
 if(auth.message&&auth.user){$('#storage-warning').textContent=auth.message;$('#storage-warning').hidden=false;}else $('#storage-warning').hidden=true;
 $('#auth-submit').disabled=!backend||authBusy;
}
function render(){
 const open=mode==='demo'||(auth.user&&auth.ready&&!auth.resetPassword&&!auth.invite);
 document.body.classList.toggle('workspace-open',!!open);$('#workspace-content').hidden=!open;$('#auth-gate').hidden=!!open;
 $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 $('#favorite-filter').setAttribute('aria-pressed',String(favoritesOnly));$('#sort-label').textContent=sort==='recent'?'Récents':'Cash-flow';
 $('#sort-button').setAttribute('aria-label',sort==='recent'?'Trier les dossiers par cash-flow':'Trier les dossiers par date');
 $('#list-heading').firstChild.textContent=mode==='demo'?'Exemples fictifs ':'Vos analyses ';
 $('#list-subtitle').textContent=mode==='demo'?'Des exemples inventés pour tester, sans données personnelles.':'Vos dossiers et brouillons, repris après connexion.';
 const query=$('#search').value.trim().toLocaleLowerCase('fr');
 let list=(mode==='demo'?demos:auth.projects||[]).filter(p=>(!favoritesOnly||p.favorite)&&(!query||[p.name,p.city,p.postalCode].join(' ').toLocaleLowerCase('fr').includes(query)));
 list=[...list].sort((a,b)=>sort==='cashflow'?(usable(b)?calculate(b).cashflow:-Infinity)-(usable(a)?calculate(a).cashflow:-Infinity):String(b.createdAt).localeCompare(String(a.createdAt)));
 $('#count').textContent=list.length;
 $('#cards').innerHTML=list.map((p,i)=>{const valid=usable(p)&&!p.mobileDraft,m=valid?calculate(p):null;return '<article class="property-card"><div class="card-art art-'+(i%3+1)+'"><span class="card-tag">'+esc(p.propertyType)+(mode==='demo'?' · Fictif':'')+'</span><svg class="scene" aria-hidden="true"><use href="#architecture"/></svg><button class="favorite" data-favorite="'+esc(p.id)+'" aria-pressed="'+!!p.favorite+'" aria-label="Favori : '+esc(p.name)+'">'+icon('heart')+'</button></div><div class="card-body"><div class="card-city">'+icon('pin')+esc(p.city||'Lieu à renseigner')+'</div><h3 class="card-title">'+esc(p.name||'Brouillon sans titre')+'</h3><p class="card-meta">'+(p.surface?dec(p.surface)+' m² · ':'')+euro(Number(p.price))+' à l’achat</p><div class="card-numbers"><div><small>Cash-flow avant impôt</small><strong class="'+(m?(m.cashflow>=0?'positive':'negative'):'draft-label')+'">'+(m?signed(m.cashflow):'À compléter')+(m?'<em> /mois</em>':'')+'</strong></div><div><small>Rendement brut</small><strong>'+(m?dec(m.grossYield)+' <em>%</em>':'—')+'</strong></div></div></div><div class="card-footer"><span>'+(mode==='demo'?'Fictif · non enregistré':valid?'Dossier personnel':'Brouillon personnel')+'</span><button data-open="'+esc(p.id)+'">'+(valid?'Voir l’analyse':'Reprendre')+' '+icon('arrow')+'</button></div></article>';}).join('');
 if(!list.length)$('#cards').innerHTML='<div class="empty">'+icon('building')+'<h3>'+(query||favoritesOnly?'Aucun dossier correspondant.':'Votre premier projet commence ici.')+'</h3><p>Un bien, son financement et des références locales pour comparer vos hypothèses.</p><button class="primary" data-action="'+(query||favoritesOnly?'clear':'new')+'">'+(query||favoritesOnly?'Réinitialiser les filtres':'Analyser un bien')+icon('arrow')+'</button></div>';
 renderAccount();
}
function setAuthMode(value){
 authMode=value;$('#auth-tabs').hidden=value==='reset';$('#email-field').hidden=value==='reset';$('#password-field').hidden=value==='forgot';
 $('#auth-email').required=value!=='reset';$('#auth-password').required=value!=='forgot';$('#auth-password').minLength=['signup','reset'].includes(value)?12:1;
 $('#auth-password').autocomplete=value==='login'?'current-password':'new-password';$('#password-hint').hidden=!['signup','reset'].includes(value);
 $('#auth-submit').textContent=({login:'Me connecter',signup:'Créer mon compte',forgot:'Recevoir le lien',reset:'Enregistrer mon mot de passe'})[value];
 $$('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===value)));
 $('#auth-error').hidden=true;$('#auth-feedback').textContent='';
}
function handleState(next){
 const switched=auth.user?.id!==next.user?.id||auth.generation!==next.generation;
 auth=next;
 if(switched){if($('#editor').open)closeDialog('editor');if($('#account-dialog').open)closeDialog('account-dialog');editing=null;mode='mine';favoritesOnly=false;$('#search').value='';}
 if(next.resetPassword||next.invite){mode='mine';setAuthMode('reset');}
 render();
}
function initBridge(){backend=window.pia;if(backend)handleState(backend.state());}
addEventListener('pia:ready',initBridge);addEventListener('pia:state',e=>handleState(e.detail));
function readForm(){
 const p={...base,...editing};for(const[k,v]of new FormData($('#project-form')))if(!k.startsWith('local'))p[k]=num.includes(k)?Number(v):String(v).trim();
 const f=$('#project-form').elements;
 p.localScenario={rent:f.localRent.value,vacancy:f.localVacancy.value,source:f.localSource.value.trim(),date:f.localDate.value,locationKey:locality(p)};
 return p;
}
function fillForm(p){const f=$('#project-form');for(const[k,v]of Object.entries({...base,...p})){if(f.elements.namedItem(k)&&!k.startsWith('local'))f.elements.namedItem(k).value=String(v??'');}
 const local=p.localScenario||{};f.elements.localRent.value=local.rent??'';f.elements.localVacancy.value=local.vacancy??'';f.elements.localSource.value=local.source||'';f.elements.localDate.value=local.date||'';f.elements.localDate.max=today();$('#advanced').open=false;$('#local-scenario-panel').open=false;updateAssumptions();renderEvidence();}
function stash(field){if(!editing)return;const previous=editing,p=readForm();
 if(['city','postalCode','address','propertyType','surface'].includes(field)){
   const changed=String(previous[field]??'')!==String(p[field]??'');if(changed){requestSequence++;p.evidence=backend?.invalidate(previous.evidence,{[field]:p[field]});p.localScenario=undefined;for(const k of ['localRent','localVacancy','localSource','localDate'])$('#project-form').elements[k].value='';resultMode='declared';renderEvidence(p);}
 }else if(field&&backend)p.evidence=backend.invalidate(previous.evidence,{[field]:p[field]});
 p.mobileDraft=!usable(p);editing=p;
 if(mode==='demo'){const i=demos.findIndex(x=>x.id===p.id);if(i>=0)demos[i]=p;else demos.unshift(p);render();return;}
 try{backend.save(p);}catch(e){toast(e.message||'Sauvegarde impossible.');}
}
function updateAssumptions(){const p=readForm();$('#assumptions-summary').textContent='Crédit '+dec(Number(p.rate))+' % sur '+p.years+' ans · acquisition '+dec(Number(p.notary))+' % · vacance '+dec(Number(p.vacancy))+' %. Hypothèses à confirmer.';}
function showStep(n){step=n;$$('[data-panel]').forEach(el=>el.hidden=Number(el.dataset.panel)!==n);$$('[data-step]').forEach(el=>{const k=Number(el.dataset.step);el.classList.toggle('current',k===n);el.classList.toggle('complete',k<n);k===n?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current');});$('#form-error').hidden=true;$('#editor').scrollTop=0;const heading=$('[data-panel="'+n+'"] .form-title');heading.tabIndex=-1;heading.focus({preventScroll:true});}
function validate(n){const controls=$$('[data-panel="'+n+'"] input,[data-panel="'+n+'"] select').filter(x=>!x.name.startsWith('local'));controls.forEach(x=>x.removeAttribute('aria-invalid'));for(const input of controls){if(!input.checkValidity()||(input.required&&!input.value.trim())){input.closest('details')?.setAttribute('open','');input.setAttribute('aria-invalid','true');$('#form-error').textContent='Vérifiez « '+input.closest('label').querySelector('span').textContent+' ».';$('#form-error').hidden=false;input.focus();return false;}}
 const p=readForm();if(n===2&&(p.downPayment>budget(p)||Number(p.management)+Number(p.maintenance)>=100)){$('#form-error').textContent=p.downPayment>budget(p)?'L’apport ne peut pas dépasser le budget total ('+euro(budget(p))+').':'Gestion et entretien doivent totaliser moins de 100 % des loyers.';$('#form-error').hidden=false;return false;}return true;}
function startNew(){if(!backend){toast('Le moteur est en cours de chargement.');return;}if(mode!=='demo'&&(!auth.user||!auth.ready)){mode='mine';render();return;}editing={...base,id:id(),createdAt:new Date().toISOString(),mobileDraft:true};resultMode='declared';fillForm(editing);$('#editor-title').textContent='Nouvelle analyse';$('#editor-label').textContent=mode==='demo'?'DÉMONSTRATION · NON ENREGISTRÉE':'BROUILLON · SAUVEGARDE AUTOMATIQUE';showDialog('editor');showStep(1);}
function openProject(identifier){const p=(mode==='demo'?demos:auth.projects).find(x=>x.id===identifier);if(!p)return;editing={...base,...p};resultMode='declared';fillForm(editing);$('#editor-title').textContent=editing.name||'Brouillon';$('#editor-label').textContent=mode==='demo'?'EXEMPLE FICTIF':'DOSSIER PERSONNEL';showDialog('editor');if(usable(editing)&&!editing.mobileDraft)showResult();else showStep(1);}
function safeUrl(x){try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function evidenceHTML(p){const e=p.evidence;if(!e)return 'Aucune référence locale collectée pour ce lieu.';
 const location=e.location;let html='<strong>'+esc(location?location.label:'Localisation non confirmée')+'</strong>';
 if(location)html+='<p>Précision : '+esc(location.precision)+' · cela ne certifie pas l’adresse de l’annonce.</p>';
 const market=e.market||{};if(market.comparableSaleCount!=null)html+='<span class="source-chip">'+esc(market.comparableSaleCount)+' ventes comparables</span>';
 if(Number(market.medianSalePricePerSqm)>0){html+='<p>Médiane DVF : <b>'+esc(euro(market.medianSalePricePerSqm))+'/m²</b>.';if(p.price>0&&p.surface>0)html+=' Votre prix : '+esc(euro(p.price/p.surface))+'/m² ('+((p.price/p.surface/market.medianSalePricePerSqm-1)*100>=0?'+':'')+dec((p.price/p.surface/market.medianSalePricePerSqm-1)*100)+' %).';html+=' Même commune et filtres du service, pas une expertise du bien.</p>';}
 if(e.riskLabels?.length)html+='<p>Risques signalés dans la commune : '+esc(e.riskLabels.join(', '))+'. Exposition de la parcelle non déterminée.</p>';
 html+='<ul>'+(e.sources||[]).map(x=>{const url=safeUrl(x.url);return '<li>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.name)+'</a>':esc(x.name))+' · '+esc(x.status)+'<br>'+esc(x.detail)+'</li>';}).join('')+'</ul>';
 html+='<p class="source-note">'+esc((e.warnings||[]).join(' '))+'</p>';return html;}
function renderEvidence(p=editing){const html=evidenceHTML(p||{});$('#local-evidence').innerHTML=html;$('#summary-evidence').innerHTML=html;}
async function collectLocal(){if(!editing||!backend)return;const p=readForm();if(!p.city.trim()&&!p.postalCode.trim()&&!p.address.trim()){toast('Renseignez au moins la ville, le code postal ou l’adresse.');return;}
 const seq=++requestSequence,owner=auth.user?.id,projectId=editing.id,key=locality(p);$('#collect-local').disabled=true;$('#collect-local').textContent='Recherche des références…';
 try{const res=await backend.collect(p);if(seq!==requestSequence||owner!==auth.user?.id||editing?.id!==projectId||locality(readForm())!==key)return;
 editing={...readForm(),evidence:res.evidence};renderEvidence();stash();if(!res.ok)toast(res.error||'Références insuffisantes : précisez le lieu.');else toast('Collecte terminée. Vérifiez les sources et leur précision.');
 }catch(e){if(seq===requestSequence&&editing?.id===projectId){$('#local-evidence').textContent='Collecte indisponible. Aucun loyer ni risque n’a été inventé.';toast(e.name==='TimeoutError'?'La collecte a expiré. Vous pouvez réessayer.':'Les services locaux ne répondent pas.');}}
 finally{$('#collect-local').disabled=false;$('#collect-local').textContent='Rechercher les références locales';}}
function renderNumbers(){if(!editing)return;const p=readForm();if(!usable(p))return;if(resultMode==='local'&&!localReady(p))resultMode='declared';const q=evaluated(p),m=calculate(q);
 $('#result-title').textContent=p.name;$('#result-subtitle').textContent=[p.city,p.propertyType,dec(p.surface)+' m²'].join(' · ')+(mode==='demo'?' · Fictif':'');
 $$('[data-result-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.resultMode===resultMode)));
 $('#result-basis').textContent=resultMode==='local'?'Scénario local selon votre référence du '+p.localScenario.date+' ; source déclarée, non vérifiée automatiquement.':'Selon vos loyers et votre vacance renseignés. Aucun ajustement local automatique.';
 $('#cashflow').innerHTML=esc(signed(m.cashflow))+' <span>/mois</span>';$('#yield').textContent=dec(m.grossYield)+' %';$('#net-yield').textContent=dec(m.netYield)+' %';$('#total-cost').textContent=euro(m.total);$('#monthly-payment').textContent=euro(m.credit+m.insurance);
 $('#ledger').innerHTML=[['Loyers après vacance',m.effectiveRent],['Charges, taxe et entretien',-m.operating],['Crédit hors assurance',-m.credit],['Assurance emprunteur',-m.insurance]].map(([name,value])=>'<div><span>'+name+'</span><strong>'+esc((value<0?'−':'')+euro(Math.abs(value)))+'</strong></div>').join('')+'<div class="total"><span>Capital emprunté</span><strong>'+esc(euro(m.loan))+'</strong></div>';
 $('#scenario-city').textContent='Références pour : '+(p.city||'lieu à renseigner')+(p.address?' · '+p.address:'');
 const local=localReady(p);$('#local-scenario-feedback').textContent=local?'Scénario disponible. Utilisez « Scénario local » pour recalculer avec ces hypothèses.':'Pour comparer, complétez les deux montants, la référence et sa date (pas de date future).';
 $('#save').textContent=mode==='demo'?'Terminer la démo':'Enregistrer et synchroniser';scenario();renderEvidence(p);renderAccount();}
function showResult(){showStep(3);$('#price-slider').value='0';renderNumbers();}
function scenario(){if(!editing)return;const p=readForm(),q=evaluated(p),delta=Number($('#price-slider').value),test={...q,price:q.price*(1+delta/100)};$('#price-delta').textContent=(delta>0?'+':'')+delta+' %';if(test.downPayment>budget(test)){$('#scenario-output').textContent='À ce prix, l’apport dépasse le coût total. Ajustez l’apport.';return;}const m=calculate(test);$('#scenario-output').innerHTML='À <strong>'+esc(euro(test.price))+'</strong>, cash-flow : <strong>'+esc(signed(m.cashflow))+'/mois</strong>. Même apport, autres hypothèses inchangées.';}
async function save(){if(!validate(1)){showStep(1);validate(1);return;}if(!validate(2)){showStep(2);validate(2);return;}stash();if(mode==='demo'){closeDialog('editor');toast('Démonstration terminée. Aucun dossier envoyé au compte.');return;}$('#save').disabled=true;try{const done=await backend.sync();closeDialog('editor');toast(done?'Dossier sauvegardé dans votre compte.':'Dossier en attente : vérifiez le statut de sauvegarde.');}catch(e){toast(e.message||'Sauvegarde non confirmée.');}finally{$('#save').disabled=false;}}
function accountOpen(){if(!auth.user){mode='mine';setAuthMode('login');render();$('#auth-email').focus();return;}renderAccount();showDialog('account-dialog');}
async function accountAction(fn){$('#account-error').hidden=true;try{await fn();}catch(e){$('#account-error').textContent=e.message||'Action non effectuée.';$('#account-error').hidden=false;}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.close){closeDialog(b.dataset.close);return;}if(b.dataset.authMode){setAuthMode(b.dataset.authMode);return;}
 if(b.dataset.mode){if(!backend){toast('Chargement du moteur…');return;}mode=b.dataset.mode;favoritesOnly=false;render();return;}
 if(b.dataset.open){openProject(b.dataset.open);return;}if(b.dataset.back){showStep(Number(b.dataset.back));return;}
 if(b.dataset.resultMode){if(b.dataset.resultMode==='local'&&!localReady(readForm())){$('#local-scenario-panel').open=true;$('#local-scenario-panel').scrollIntoView({block:'center'});toast('Documentez d’abord les loyers locaux et la vacance retenue.');return;}resultMode=b.dataset.resultMode;renderNumbers();return;}
 if(b.dataset.favorite){const list=mode==='demo'?demos:auth.projects,p=list.find(x=>x.id===b.dataset.favorite);if(p){const next={...p,favorite:!p.favorite};if(mode==='demo'){demos=demos.map(x=>x.id===p.id?next:x);render();}else try{backend.save(next);}catch(e){toast(e.message);}}return;}
 const a=b.dataset.action;if(a==='new')startNew();if(a==='help')showDialog('help');if(a==='account')accountOpen();
 if(a==='favorites'){favoritesOnly=!favoritesOnly;render();}if(a==='all'){favoritesOnly=false;render();}if(a==='clear'){favoritesOnly=false;$('#search').value='';render();}if(a==='sort'){sort=sort==='recent'?'cashflow':'recent';render();}
});
$('#auth-form').addEventListener('submit',async e=>{e.preventDefault();if(!backend)return;authBusy=true;renderAccount();$('#auth-error').hidden=true;$('#auth-feedback').textContent='';const email=$('#auth-email').value.trim(),password=$('#auth-password').value;
 try{if(authMode==='login'){await backend.login(email,password);$('#auth-feedback').textContent='Connexion effectuée ; chargement du compte…';}
 else if(authMode==='signup'){const r=await backend.signup(email,password);$('#auth-feedback').textContent=r.confirmed?'Compte créé. Vous pouvez vous connecter.':'Consultez votre e-mail pour confirmer votre inscription avant de vous connecter.';}
 else if(authMode==='forgot'){await backend.recover(email);$('#auth-feedback').textContent='Si un compte correspond, un e-mail de récupération vous a été envoyé.';}
 else {await backend.reset(password);setAuthMode('login');$('#auth-feedback').textContent='Mot de passe enregistré.';}
 }catch(err){$('#auth-error').textContent=[400,401].includes(err.status)?'Connexion refusée : vérifiez votre e-mail, votre mot de passe et la confirmation de votre adresse.':err.status===403?'L’inscription n’est pas autorisée sur ce service.':err.message||'Service de connexion indisponible. Il doit être activé sur ce site Netlify.';$('#auth-error').hidden=false;}
 finally{authBusy=false;$('#auth-password').value='';renderAccount();}});
$('#next').addEventListener('click',()=>{if(validate(1)){stash();showStep(2);}});
$('#project-form').addEventListener('submit',e=>{e.preventDefault();if(step===1){if(validate(1)){stash();showStep(2);}}else if(step===2&&validate(2)){stash();showResult();}});
$('#project-form').addEventListener('input',e=>{if(!editing||e.target.id==='price-slider')return;stash(e.target.name);updateAssumptions();if(step===3)renderNumbers();});
$('#project-form').addEventListener('change',e=>{if(!editing)return;stash(e.target.name);if(step===3)renderNumbers();});
$('#editor').addEventListener('cancel',()=>{requestSequence++;editing=null;});
$('#collect-local').addEventListener('click',collectLocal);$('#save').addEventListener('click',save);$('#price-slider').addEventListener('input',scenario);$('#search').addEventListener('input',render);
$('#sync-account').addEventListener('click',()=>accountAction(()=>backend.retry()));$('#export-account').addEventListener('click',()=>backend.export());
$('#logout').addEventListener('click',()=>accountAction(async()=>{await backend.logout();if($('#account-dialog').open)closeDialog('account-dialog');mode='mine';render();}));
$('#remote-version').addEventListener('click',()=>accountAction(async()=>{if(confirm('Charger les données du compte et remplacer votre version locale ? Exportez-la avant de continuer.'))await backend.resolve(false);}));
$('#local-version').addEventListener('click',()=>accountAction(async()=>{if(confirm('Remplacer la version du compte par vos données locales, y compris les modifications faites ailleurs ?'))await backend.resolve(true);}));
setAuthMode('login');render();initBridge();
