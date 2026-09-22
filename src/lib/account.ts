import { create } from 'zustand';
import { getUser, handleAuthCallback, onAuthChange, logout, refreshSession, type User } from '@netlify/identity';
import { useStore } from '../store';
import { emptyAccount, pickAccount, validAccount, type AccountData } from './accountData';
import { accountTransport, type Envelope } from './accountTransport';

type Status='loading'|'guest'|'saved'|'pending'|'saving'|'error'|'conflict';
interface Draft extends Envelope { savedLocallyAt:string }
export const useAccount=create<{user:User|null;status:Status;ready:boolean;message:string;authMessage:string;updatedAt:string|null;resetPassword:boolean;inviteToken:string|null;generation:number}>(()=>({user:null,status:'loading',ready:false,message:'',authMessage:'',updatedAt:null,resetPassword:false,inviteToken:null,generation:0}));
let revision:string|null=null,applying=false,pending:AccountData|null=null,epoch=0,timer:ReturnType<typeof setTimeout>|undefined,busy=false,refreshing=false;
let tabId:string;try{tabId=sessionStorage.getItem('pia-tab')||crypto.randomUUID();sessionStorage.setItem('pia-tab',tabId);}catch{tabId=crypto.randomUUID();}
const cacheKey=(id:string)=>`pia-account-cache:${id}`;
const draftKey=(id:string)=>`pia-account-draft:${id}:${tabId}`;
const parse=(key:string)=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
function write(key:string,value:unknown){localStorage.setItem(key,JSON.stringify(value));}
function hydrate(data:AccountData){applying=true;useStore.setState({...data,demoMode:false,realBackup:null});applying=false;}
export function guestData():AccountData {
 const raw=parse('patrimoine-ia')?.state;
 const real=raw?.demoMode&&raw.realBackup?(()=>{try{return JSON.parse(raw.realBackup)}catch{return null}})():raw;
 const data={...emptyAccount(),...pickAccount({...emptyAccount(),...real}),pipeline:real?.pipeline??parse('patrimoine-ai-deal-pipeline-v1')??{}};
 return validAccount(data)?data:emptyAccount();
}
export function downloadAccount(data=pickAccount(useStore.getState())) {
 const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=`patrimoine-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const request=accountTransport(()=>({userId:useAccount.getState().user?.id??null,generation:epoch}),refreshSession);
function storePending(data:AccountData){
 const user=useAccount.getState().user;if(!user)return;
 pending=data;
 try{write(draftKey(user.id),{data,revision,updatedAt:useAccount.getState().updatedAt,savedLocallyAt:new Date().toISOString()});}
 catch{useAccount.setState({status:'error',message:'Stockage local saturé. Gardez cette page ouverte et exportez vos données.'});}
}
export async function syncAccount():Promise<boolean> {
 const state=useAccount.getState();if(!state.user||!state.ready||state.status==='conflict'||busy)return false;
 if(!pending)return state.status==='saved';
 const owner=state.user.id,run=epoch,sent=pending,base=revision;busy=true;useAccount.setState({status:'saving',message:''});
 try{
  const saved=await request('PUT',{data:sent,revision:base});if(run!==epoch)return false;
  revision=saved.revision;
  write(cacheKey(owner),{...saved,data:sent});
  useAccount.setState({updatedAt:saved.updatedAt});
  if(pending===sent){pending=null;localStorage.removeItem(draftKey(owner));useAccount.setState({status:'saved',message:''});}
  else{storePending(pending!);useAccount.setState({status:'pending'});}
  return !pending;
 }catch(e:any){if(run===epoch)useAccount.setState({status:e.status===409?'conflict':'error',message:e.status===409?'Ce compte a changé sur un autre appareil. Vos modifications locales sont conservées.':e.message||'Connexion indisponible. Sauvegarde en attente sur cet appareil.'});return false;}
 finally{busy=false;if(run===epoch&&pending&&useAccount.getState().status==='pending')timer=setTimeout(syncAccount,600);}
}
async function openAccount(user:User|null) {
 const current=useAccount.getState();if(current.ready&&current.user?.id===user?.id)return;
 const run=++epoch;clearTimeout(timer);pending=null;revision=null;
 useAccount.setState({user,ready:false,status:'loading',message:'',updatedAt:null,generation:run});hydrate(emptyAccount());
 if(!user){hydrate(guestData());useAccount.setState({ready:true,status:'guest'});return;}
 const cached=parse(cacheKey(user.id)),draft=parse(draftKey(user.id));
 try {
  const remote=await request();if(run!==epoch)return;revision=remote.revision;
  if(draft&&validAccount(draft.data)) {
   hydrate(draft.data);pending=draft.data;
   // An acknowledgement may have been lost after the server accepted the save.
   if(JSON.stringify(remote.data)===JSON.stringify(draft.data)){pending=null;localStorage.removeItem(draftKey(user.id));}
   else if(draft.revision!==remote.revision){revision=draft.revision;useAccount.setState({ready:true,status:'conflict',message:'Des modifications locales et une autre version du compte ont été retrouvées.'});return;}
  }else hydrate(remote.data);
  write(cacheKey(user.id),remote);useAccount.setState({ready:true,status:pending?'pending':'saved',updatedAt:remote.updatedAt});if(pending)void syncAccount();
 }catch(e:any){if(run!==epoch)return;
  const fallback=draft??cached;
  if(e.status!==401&&fallback&&validAccount(fallback.data)){hydrate(fallback.data);revision=fallback.revision;pending=draft?.data??null;useAccount.setState({ready:true,status:'error',message:'Version locale affichée. Reconnexion nécessaire pour synchroniser.'});}
  else useAccount.setState({ready:false,status:'error',message:e.message||'Impossible de charger le compte. Réessayez avant de modifier vos données.'});
 }
}
export async function retryAccount(){if(!useAccount.getState().ready){const user=useAccount.getState().user;await openAccount(user);}else if(pending)await syncAccount();else await refreshAccount();}
export async function refreshAccount(){
 if(!useAccount.getState().user||pending||busy||refreshing||useStore.getState().demoMode)return;
 const run=epoch,base=revision;refreshing=true;
 try{const remote=await request();if(run!==epoch||pending||revision!==base||useStore.getState().demoMode)return;if(remote.revision!==revision){revision=remote.revision;hydrate(remote.data);}write(cacheKey(remote.userId),remote);useAccount.setState({status:'saved',updatedAt:remote.updatedAt,message:''});}
 catch(e:any){if(run===epoch)useAccount.setState({status:'error',message:e.message||'Synchronisation indisponible.'});}
 finally{refreshing=false;}
}
export async function resolveConflict(keepLocal:boolean){
 const run=epoch,local=pending;const remote=await request();if(run!==epoch)return;
 revision=remote.revision;
 if(keepLocal&&local){storePending(local);useAccount.setState({status:'pending',message:''});await syncAccount();}
 else {pending=null;hydrate(remote.data);localStorage.removeItem(draftKey(remote.userId!));write(cacheKey(remote.userId!),remote);useAccount.setState({status:'saved',message:'',updatedAt:remote.updatedAt,generation:run+1});}
}
export async function signOut(){
 if(pending && !await syncAccount())throw new Error('Des modifications attendent leur sauvegarde. Synchronisez ou résolvez le conflit avant de vous déconnecter.');
 const owner=useAccount.getState().user?.id;await logout();if(owner)localStorage.removeItem(cacheKey(owner));await openAccount(null);
}
export function importGuest(){
 const data=guestData();const current=pickAccount(useStore.getState());
 // Import only missing IDs; never replace a record already present in the account.
 for(const key of ['assets','liabilities','goals','projects','chat'] as const){const ids=new Set(current[key].map(x=>x.id));(current[key] as any[])=[...current[key],...data[key].filter(x=>!ids.has(x.id))];}
 current.profile??=data.profile;current.onboarded ||=data.onboarded;
 const dates=new Set(current.snapshots.map(x=>x.date));current.snapshots=[...current.snapshots,...data.snapshots.filter(x=>!dates.has(x.date))].sort((a,b)=>a.date.localeCompare(b.date));current.pipeline={...data.pipeline,...current.pipeline};
 useStore.setState(current);
}
export function recoverableDrafts():{key:string;draft:Draft}[]{
 const user=useAccount.getState().user;if(!user)return [];
 return Object.keys(localStorage).filter(k=>k.startsWith(`pia-account-draft:${user.id}:`)&&k!==draftKey(user.id)).map(key=>({key,draft:parse(key)})).filter(x=>x.draft&&validAccount(x.draft.data));
}
export function restoreDraft(key:string){const user=useAccount.getState().user;if(!user||!key.startsWith(`pia-account-draft:${user.id}:`))return;const draft=parse(key);if(!draft||!validAccount(draft.data))return;hydrate(draft.data);revision=draft.revision;storePending(draft.data);useAccount.setState({status:'conflict',message:'Brouillon récupéré. Choisissez la version à conserver après comparaison.',generation:useAccount.getState().generation+1});}
let started=false;
export async function startAccounts(){
 if(started)return;started=true;
 useStore.subscribe(state=>{
  if(applying||!useAccount.getState().ready||state.demoMode)return;
  const data=pickAccount(state);
  if(!useAccount.getState().user){try{write('patrimoine-ia',{state:data,version:0});}catch{useAccount.setState({message:'Stockage local indisponible. Exportez vos données.'});}return;}
  storePending(data);if(useAccount.getState().status!=='conflict'){useAccount.setState({status:'pending'});clearTimeout(timer);timer=setTimeout(syncAccount,800);}
 });
 let booting=true;
 onAuthChange((event,user)=>{if(booting||event==='token_refresh'||event==='user_updated')return;if(event==='recovery')useAccount.setState({resetPassword:true});void openAccount(user);});
 try{const callback=await handleAuthCallback();if(callback?.type==='confirmation')useAccount.setState({authMessage:'Votre adresse e-mail est confirmée. Bienvenue dans votre espace personnel.'});if(callback?.type==='recovery')useAccount.setState({resetPassword:true});if(callback?.type==='invite')useAccount.setState({inviteToken:callback.token??null});}
 catch{useAccount.setState({authMessage:'Ce lien de connexion est invalide ou expiré. Demandez un nouveau lien depuis Mon compte.'});history.replaceState(history.state,'',location.pathname+location.search);}
 booting=false;await openAccount(await getUser());
 addEventListener('online',()=>{if(pending||!useAccount.getState().ready)void retryAccount();});
 addEventListener('focus',()=>{if(useAccount.getState().user)void retryAccount();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&useAccount.getState().user)void retryAccount();});
 addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
 // Identity's in-memory session is not cross-tab reactive. Reload on another tab's auth change.
 addEventListener('storage',e=>{if(e.key==='gotrue.user'){window.location.reload();}});
 setInterval(()=>{if(document.visibilityState==='visible'&&useAccount.getState().user)void retryAccount();},30000);
}
