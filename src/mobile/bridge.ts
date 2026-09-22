/** Mobile UI adapter: reuses the existing account store and financial engine.
 * No additional password store or private-data collection is created here.
 */
import { login, signup, requestPasswordRecovery, updateUser, acceptInvite, getSettings } from '@netlify/identity';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RentalComparison from '../components/RentalComparison';
import { rentalDecision } from '../lib/rentalDecision';
import { useStore } from '../store';
import { useAccount, startAccounts, syncAccount, retryAccount, signOut, resolveConflict, downloadAccount } from '../lib/account';
import { mobileAnalysis } from '../lib/mobileAnalysis';
import { invalidateEvidence } from '../lib/evidence';
import type { RealEstateProject } from '../types';

type UI = Record<string, any>;
const numericMap: Record<string, keyof RealEstateProject> = {
  price:'price',surface:'surface',monthlyRent:'monthlyRent',works:'works',
  downPayment:'downPayment',rate:'ratePct',years:'durationYears',notary:'notaryFeesPct',
  fees:'bankFees',insurance:'insurancePctYearly',tax:'propertyTaxYearly',charges:'monthlyCharges',
  vacancy:'vacancyPct',maintenance:'maintenancePct',agency:'agencyFees',furniture:'furniture',
  pno:'ownerInsuranceYearly',management:'managementPct',commercial:'commercialMonthlyRent',
};
function toProject(p:UI):RealEstateProject {
  const previous=useStore.getState().projects.find(x=>x.id===p.id);
  const record:UI={analysisMode:'approfondie',rentalMode:'classique',residentialLots:1,commercialLots:0,
    commercialMonthlyRent:0,ratePct:3.5,durationYears:25,notaryFeesPct:8,insurancePctYearly:.3,
    taxRatePct:0,rentGrowthPct:0,valueGrowthPct:0,agencyFees:0,furniture:0,bankFees:1500,
    ownerInsuranceYearly:0,managementPct:0,maintenancePct:5,vacancyPct:8,
    ...previous,id:p.id,createdAt:p.createdAt||new Date().toISOString(),name:p.name||'Brouillon sans titre',
    city:p.city||'',postalCode:p.postalCode||'',address:p.address||'',propertyType:p.propertyType||'Immeuble',
    listingUrl:p.listingUrl||'',evidence:p.evidence,lat:p.evidence?.location?.lat,lng:p.evidence?.location?.lng,
    mobileDraft:!!p.mobileDraft,favorite:!!p.favorite,localScenario:p.localScenario,
  };
  for(const [key,target] of Object.entries(numericMap)) {
    const value=Number(p[key]??0);if(!Number.isFinite(value))throw new Error('Un montant n’est pas valide.');
    record[target]=value;
  }
  if(Number(record.commercialMonthlyRent)>0)record.commercialLots=Math.max(1,Number(record.commercialLots)||0);
  return record as RealEstateProject;
}
function toUI(p:RealEstateProject):UI {
  const result:UI={...p};for(const[key,target]of Object.entries(numericMap))result[key]=p[target]??0;
  return result;
}
function calculate(p:UI) {
  return mobileAnalysis(toProject(p));
}
function state(){
  const a=useAccount.getState();
  return {user:a.user?{id:a.user.id,email:a.user.email,name:a.user.name}:null,status:a.status,ready:a.ready,
    message:a.message||a.authMessage,updatedAt:a.updatedAt,resetPassword:a.resetPassword,invite:!!a.inviteToken,
    generation:a.generation,projects:a.user&&a.ready?useStore.getState().projects.map(toUI):[]};
}
function emit(){window.dispatchEvent(new CustomEvent('pia:state',{detail:state()}));}
let comparisonRoot:Root|null=null;
const api={
  state,calculate,
  decision:(p:UI)=>rentalDecision(toProject(p)),
  compare:(projects:UI[],demo:boolean)=>{
    if(!demo&&(!useAccount.getState().user||!useAccount.getState().ready))throw new Error('Connectez-vous pour comparer vos dossiers.');
    comparisonRoot??=createRoot(document.getElementById('comparison-content')!);
    comparisonRoot.render(createElement(RentalComparison,{projects:projects.map(toProject),demo}));
  },
  clearComparison:()=>{comparisonRoot?.unmount();comparisonRoot=null;},
  login:async(email:string,password:string)=>{await login(email.trim(),password);},
  signup:async(email:string,password:string)=>{const settings=await getSettings();if(settings.disableSignup||settings.autoconfirm)throw new Error('L’inscription avec confirmation e-mail est momentanément indisponible.');const u=await signup(email.trim(),password);return {confirmed:!!u.confirmedAt};},
  recover:async(email:string)=>{await requestPasswordRecovery(email.trim());},
  reset:async(password:string)=>{const a=useAccount.getState();if(a.inviteToken)await acceptInvite(a.inviteToken,password);else await updateUser({password});useAccount.setState({resetPassword:false,inviteToken:null});},
  logout:signOut,
  save:(p:UI)=>{
    const a=useAccount.getState();if(!a.user||!a.ready)throw new Error('Connectez-vous avant d’enregistrer un dossier personnel.');
    const project=toProject(p);if(!project.id||project.id.length>200)throw new Error('Identifiant de dossier invalide.');
    const s=useStore.getState();s.projects.some(x=>x.id===project.id)?s.updateProject(project):s.addProject(project);
  },
  sync:syncAccount,retry:retryAccount,resolve:resolveConflict,export:downloadAccount,
  invalidate:(e:any,changes:UI)=>invalidateEvidence(e,changes),
  collect:async(p:UI)=>{
    const r=await fetch('/.netlify/functions/analyze-listing',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),
      body:JSON.stringify({mode:'local',manual:{city:p.city,postalCode:p.postalCode,address:p.address,
        surface:p.surface,price:p.price,propertyType:p.propertyType}})});
    const result=await r.json();if(!r.ok)throw new Error(result.error||'Collecte locale indisponible.');return result;
  },
};
(window as any).pia=api;
useAccount.subscribe(emit);
useStore.subscribe(emit);
window.dispatchEvent(new Event('pia:ready'));
void startAccounts().then(emit).catch(()=>{
  useAccount.setState({ready:false,status:'error',message:'Le service de connexion ne répond pas. Réessayez ou utilisez la démonstration sans données personnelles.'});emit();
});
