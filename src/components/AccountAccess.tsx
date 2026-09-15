import { useStore } from '../store';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { login, signup, requestPasswordRecovery, updateUser, acceptInvite } from '@netlify/identity';
import { Link } from 'react-router-dom';
import { useAccount, syncAccount, retryAccount, signOut, resolveConflict, downloadAccount, importGuest, guestData, recoverableDrafts, restoreDraft } from '../lib/account';

export function AccountBoundary({children}:{children:ReactNode}) {
 const {ready,user,status,message,resetPassword,inviteToken,generation}=useAccount();
 if(resetPassword||inviteToken)return <div className="account-shell"><AccountPage/></div>;
 if(!ready)return <div className="account-shell"><section className="account-card"><span className="eyebrow">PATRIMOINE AI</span><h1>{status==='loading'?'Ouverture de votre espace…':'Votre compte est protégé'}</h1><p role="status">{message||'Chargement de vos données personnelles.'}</p>{status==='error'&&<><button className="btn-primary" onClick={()=>void retryAccount()}>Réessayer</button><button className="btn-ghost" onClick={()=>void signOut()}>Se déconnecter</button></>}</section></div>;
 return <div key={`${user?.id??'guest'}:${generation}`}>{children}</div>;
}
export function AccountStatus(){
 const {user,status,updatedAt,message}=useAccount();
 const label=!user?'Mode local · Se connecter':status==='saved'?'Sauvegardé dans mon compte':status==='saving'?'Sauvegarde en cours…':status==='conflict'?'Conflit à résoudre':'Sauvegarde en attente';
 return <div className={`account-status account-status-${status}`}><Link to="/compte">{label}</Link>{user&&<span>{user.email}</span>}{status==='saved'&&updatedAt&&<small>{new Date(updatedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small>}{user&&['error','pending'].includes(status)&&<button onClick={()=>void retryAccount()}>Réessayer</button>}{message&&<p role="status">{message}</p>}</div>;
}
export default function AccountPage(){
 const account=useAccount();const [reauth,setReauth]=useState(false);
 useEffect(()=>{if(useStore.getState().demoMode)useStore.getState().exitDemo();},[]);const [mode,setMode]=useState<'login'|'signup'|'forgot'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const reset=account.resetPassword||!!account.inviteToken;
 async function action(fn:()=>Promise<unknown>|unknown){setBusy(true);setError('');setNotice('');try{await fn();}catch(e:any){setError(e.status===401||e.status===400?'Adresse e-mail ou mot de passe incorrect, ou lien expiré.':e.status===422?'Vérifiez votre adresse e-mail et choisissez un mot de passe plus robuste.':e.status===403?'Cette inscription n’est pas autorisée. Vérifiez votre e-mail ou contactez le gestionnaire du site.':e.message||'Service indisponible. Réessayez.');}finally{setBusy(false);setPassword('');}}
 function submit(e:FormEvent){e.preventDefault();void action(async()=>{
  if(reset){if(account.inviteToken)await acceptInvite(account.inviteToken,password);else await updateUser({password});useAccount.setState({resetPassword:false,inviteToken:null});setNotice('Votre mot de passe a été enregistré.');}
  else if(mode==='signup'){const user=await signup(email.trim(),password,{full_name:name.trim()});setNotice(user.confirmedAt?'Compte créé.':'Consultez votre boîte e-mail pour confirmer votre inscription avant de vous connecter.');}
  else if(mode==='forgot'){await requestPasswordRecovery(email.trim());setNotice('Si cette adresse correspond à un compte, un e-mail vous permettra de choisir un nouveau mot de passe.');}
  else {await login(email.trim(),password);if(reauth)await retryAccount();setReauth(false);}
 });}
 const old=guestData(),hasGuest=old.projects.length+old.assets.length+old.goals.length+old.liabilities.length+old.chat.length>0||!!old.profile;
 const drafts=account.user?recoverableDrafts():[];
 return <div className="account-page"><header><span className="eyebrow">VOTRE ESPACE PERSONNEL</span><h1>{reset?'Choisissez votre mot de passe':account.user?'Mon compte':'Vos projets vous suivent.'}</h1><p>Analyses immobilières, patrimoine, objectifs et échanges : retrouvez vos données sur ordinateur et téléphone.</p></header>
 <section className="account-card">
 {(!account.user||reset||reauth)?<>
  {!reset&&<div className="account-tabs"><button aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError('');}}>Connexion</button><button aria-pressed={mode==='signup'} onClick={()=>{setMode('signup');setError('');}}>Créer un compte</button></div>}
  <form onSubmit={submit}>
   {!reset&&mode==='signup'&&<label>Votre prénom<input autoComplete="given-name" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>}
   {!reset&&<label>Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>}
   {(reset||mode!=='forgot')&&<label>{reset?'Nouveau mot de passe':'Mot de passe'}<input type="password" autoComplete={reset||mode==='signup'?'new-password':'current-password'} required minLength={reset||mode==='signup'?12:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>{(reset||mode==='signup')&&<small>Au moins 12 caractères. Utilisez un mot de passe unique.</small>}</label>}
   <button className="btn-primary" disabled={busy}>{busy?'Un instant…':reset?'Enregistrer le mot de passe':mode==='signup'?'Créer mon compte':mode==='forgot'?'Recevoir un lien':'Me connecter'}</button>
  </form>
  {!reset&&<button className="btn-ghost" onClick={()=>setMode(mode==='forgot'?'login':'forgot')}>{mode==='forgot'?'Retour à la connexion':'Mot de passe oublié ?'}</button>}
  {!reset&&<p className="account-muted">Les données du mode local ne sont importées qu’à votre demande, après connexion.</p>}
 </>:<>
  {account.status==='error'&&<button className="btn-ghost" onClick={()=>{setEmail(account.user?.email||'');setMode('login');setReauth(true);}}>Renouveler ma connexion</button>}<h2>{account.user.name||'Mon espace privé'}</h2><p className="account-email">{account.user.email}</p><AccountStatus/>
  {account.status==='conflict'&&<div className="account-conflict"><h3>Deux versions à départager</h3><p>Exportez votre version locale avant de choisir. « Garder ma version » remplace la version du compte, y compris les changements réalisés ailleurs.</p><button className="btn-ghost" onClick={()=>downloadAccount()}>Exporter ma version locale</button><button disabled={busy} className="btn-primary" onClick={()=>void action(async()=>{if(confirm('Remplacer la version locale par celle du compte ? Exportez vos modifications locales avant de continuer.'))await resolveConflict(false);})}>Charger la version du compte</button><button disabled={busy} className="btn-ghost" onClick={()=>void action(async()=>{if(confirm('Remplacer les données du compte par votre version locale, y compris les modifications faites ailleurs ?'))await resolveConflict(true);})}>Garder ma version locale</button></div>}
  <div className="account-actions"><button className="btn-primary" disabled={busy||account.status==='conflict'} onClick={()=>void action(async()=>{await retryAccount();})}>Synchroniser maintenant</button><button className="btn-ghost" onClick={()=>downloadAccount()}>Exporter toutes mes données</button><button className="btn-ghost" disabled={busy} onClick={()=>void action(signOut)}>Se déconnecter</button></div>
  {hasGuest&&<div className="account-import"><h3>Vos anciens dossiers sur cet appareil</h3><p>{old.projects.length} analyse(s), {old.assets.length} actif(s). L’import ajoute les éléments absents et conserve les dossiers déjà présents dans votre compte.</p><button className="btn-ghost" disabled={busy||account.status==='conflict'} onClick={()=>void action(async()=>{importGuest();if(await syncAccount())setNotice('Les données locales ont été importées et sauvegardées dans votre compte.');})}>Importer mes données locales</button></div>}
  {drafts.length>0&&<div className="account-import"><h3>Brouillons non synchronisés retrouvés</h3><p>Ces copies proviennent d’autres onglets de ce compte sur cet appareil. Exportez-les ou récupérez-les pour choisir la version à conserver.</p>{drafts.map(({key,draft})=><div key={key}><span>{new Date(draft.savedLocallyAt).toLocaleString('fr-FR')}</span><button className="btn-ghost" onClick={()=>downloadAccount(draft.data)}>Exporter</button><button className="btn-ghost" disabled={busy} onClick={()=>{if(confirm('Charger ce brouillon ? Exportez d’abord vos modifications en cours.'))restoreDraft(key);}}>Récupérer</button></div>)}</div>}
  <p className="account-muted">La mention « Sauvegardé dans mon compte » confirme la sauvegarde sur le serveur. Hors connexion, les changements restent sur cet appareil jusqu’à leur synchronisation.</p>
 </>}
 {notice&&<p role="status" className="account-feedback">{notice}</p>}{error&&<p role="alert" className="account-error">{error}</p>}
 </section><Link to="/" className="btn-ghost">Retour à l’analyse immobilière →</Link></div>;
}
