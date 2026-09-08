import { RealEstateProject } from "../types";
import { computeDeal, effectiveProjectInputs } from "./deal";

export type DealStage = "a_etudier" | "visite" | "offre" | "financement" | "acquis" | "refuse";
export const DEAL_STAGE_LABELS: Record<DealStage,string> = { a_etudier:"À étudier", visite:"Visite", offre:"Offre", financement:"Financement", acquis:"Acquis", refuse:"Refusé" };
export interface DealPipelineMeta { stage: DealStage; updatedAt: string; note?: string; }
const KEY="patrimoine-ai-deal-pipeline-v1";
export function readPipeline():Record<string,DealPipelineMeta>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return {}}}
export function setDealStage(id:string,stage:DealStage){const all=readPipeline();all[id]={...(all[id]||{}),stage,updatedAt:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(all));return all}
export function rankProjects(projects:RealEstateProject[]){return projects.map(p=>{const deal=computeDeal(effectiveProjectInputs(p));const r=deal.results.realiste;const prudent=deal.results.prudent;let score=deal.score; if(prudent.monthlyCashflow<0)score-=8;if(r.monthlyCashflow<0)score-=12;return {project:p,deal,rankScore:Math.max(0,Math.round(score))}}).sort((a,b)=>b.rankScore-a.rankScore)}
