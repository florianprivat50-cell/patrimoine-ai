import type { Asset, Liability, Goal, Profile, RealEstateProject, Snapshot, ChatMessage } from '../types';

export interface AccountData {
  onboarded: boolean;
  profile: Profile | null;
  assets: Asset[];
  liabilities: Liability[];
  goals: Goal[];
  projects: RealEstateProject[];
  snapshots: Snapshot[];
  chat: ChatMessage[];
  pipeline: Record<string, { stage: string; updatedAt: string; note?: string }>;
}
export const emptyAccount = (): AccountData => ({ onboarded:false, profile:null, assets:[], liabilities:[], goals:[], projects:[], snapshots:[], chat:[], pipeline:{} });
export const accountFields = Object.keys(emptyAccount()) as (keyof AccountData)[];
export function pickAccount(state: AccountData): AccountData {
  return Object.fromEntries(accountFields.map(key=>[key,state[key]])) as unknown as AccountData;
}
// Reject malformed documents before saving or hydrating application state.
export function validAccount(value: unknown): value is AccountData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!accountFields.includes(k as keyof AccountData)))return false;
  if(typeof v.onboarded!=='boolean' || (v.profile!==null && (!v.profile || typeof v.profile!=='object' || Array.isArray(v.profile))))return false;
  for(const key of ['assets','liabilities','goals','projects','snapshots','chat']) {
    const list=v[key]; if(!Array.isArray(list)||list.length>10000)return false;
    if(list.some(item=>!item||typeof item!=='object'||Array.isArray(item)))return false;
    if(key!=='snapshots' && list.some(item=>typeof item.id!=='string'||!item.id||item.id.length>200))return false;
    if(key!=='snapshots' && new Set(list.map(item=>item.id)).size!==list.length)return false;
  }
  if(!v.pipeline||typeof v.pipeline!=='object'||Array.isArray(v.pipeline))return false;
  if(Object.entries(v.pipeline).some(([key,item]:[string,any])=>['__proto__','constructor','prototype'].includes(key)||!item||!['a_etudier','visite','offre','financement','acquis','refuse'].includes(item.stage)||typeof item.updatedAt!=='string'))return false;
  return true;
}
