import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
interface InstallEvent extends Event { prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}>; }
export default function AppExperience(){
 const [prompt,setPrompt]=useState<InstallEvent|null>(null);
 const [standalone,setStandalone]=useState(()=>matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone);
 const [online,setOnline]=useState(navigator.onLine && document.documentElement.dataset.offline!=="true");
 const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
 const [installing,setInstalling]=useState(false);
 const [notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 const location=useLocation();
 useEffect(()=>{
  const capture=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent)};
  const installed=()=>{setStandalone(true);setPrompt(null);dialog.current?.close();setNotice('Application installée. Retrouvez-la depuis votre écran d’accueil.');};
  const net=()=>setOnline(navigator.onLine);
  addEventListener('beforeinstallprompt',capture);addEventListener('appinstalled',installed);addEventListener('online',net);addEventListener('offline',net);
  let disposed=false;let registration:ServiceWorkerRegistration|undefined;
  const track=()=>{const worker=registration?.installing;if(worker)worker.addEventListener('statechange',()=>{if(!disposed&&worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(registration?.waiting??null);});};
  if('serviceWorker' in navigator && (locationSafe() && import.meta.env.PROD)) navigator.serviceWorker.register('/sw.js').then(r=>{registration=r;if(disposed)return;if(r.waiting)setWaiting(r.waiting);r.addEventListener('updatefound',track);r.update().catch(()=>{});}).catch(()=>{});
  return()=>{disposed=true;removeEventListener('beforeinstallprompt',capture);removeEventListener('appinstalled',installed);removeEventListener('online',net);removeEventListener('offline',net);registration?.removeEventListener('updatefound',track);};
 },[]);
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});},[location.pathname]);
 async function install(){if(!prompt){dialog.current?.showModal();return;}setInstalling(true);try{await prompt.prompt();const result=await prompt.userChoice;setPrompt(null);if(result.outcome==='accepted')setNotice('Installation demandée. Confirmez les étapes proposées par votre navigateur.');}catch{dialog.current?.showModal();}finally{setInstalling(false);}}
 function update(){if(!waiting)return; navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});waiting.postMessage({type:'SKIP_WAITING'});}
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 return <>
  <header className="app-toolbar"><a href="#main-content" className="skip-link">Aller au contenu</a><div><span className="toolbar-brand">Patrimoine <b>AI</b></span><span className="toolbar-caption">Votre espace d’investissement</span></div><div className="toolbar-actions"><span className="connection-state"><i className={online?'':'offline'}/>{online?'Espace personnel':'Hors connexion'}</span>{!standalone&&<button className="install-button" disabled={installing} onClick={install}>{installing?'Installation…':'Installer l’application'}</button>}{standalone&&<span className="standalone-label">Application</span>}</div></header>
  {!online&&<div className="app-notice" role="status">Vous êtes hors connexion. Vos dossiers restent consultables sur cet appareil. L’analyse d’annonces et les données locales nécessitent Internet.</div>}
  {waiting&&<div className="app-notice update-notice" role="status"><span>Une nouvelle version est prête. Enregistrez votre dossier avant de l’ouvrir.</span><button onClick={update}>Mettre à jour</button></div>}
  {notice&&<div className="app-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Fermer la notification">Fermer</button></div>}
  <dialog ref={dialog} className="install-dialog" aria-labelledby="install-title" onClick={e=>{if(e.target===dialog.current)dialog.current.close()}}><button className="dialog-close" onClick={()=>dialog.current?.close()} aria-label="Fermer les instructions">Fermer</button><img src="/icon-192.png" alt="" width="64" height="64"/><span className="eyebrow">VOTRE ESPACE, À PORTÉE DE MAIN</span><h2 id="install-title">Patrimoine AI.<br/>Comme une application.</h2><p>Une fenêtre dédiée, un accès depuis votre écran d’accueil et vos dossiers accessibles hors connexion après une première visite.</p><ol>{ios?<><li>Ouvrez le site dans Safari.</li><li>Ouvrez le menu Partager.</li><li>Choisissez « Sur l’écran d’accueil », puis « Ajouter ».</li></>:<><li>Ouvrez le menu de votre navigateur.</li><li>Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil » si l’option est proposée.</li><li>Confirmez l’installation. Si l’option n’apparaît pas, essayez Chrome ou Edge.</li></>}</ol><p className="install-privacy">Les dossiers sont conservés sur cet appareil. L’installation ne crée pas de synchronisation entre ordinateur et téléphone.</p><button className="btn-primary" onClick={()=>dialog.current?.close()}>J’ai compris</button></dialog>
 </>;
}
function locationSafe(){return window.isSecureContext;}
