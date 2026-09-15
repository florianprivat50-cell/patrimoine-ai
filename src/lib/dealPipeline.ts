import { useStore } from "../store";
import { RealEstateProject } from "../types";
import { computeDeal, effectiveProjectInputs } from "./deal";

export type DealStage = "a_etudier" | "visite" | "offre" | "financement" | "acquis" | "refuse";
export const DEAL_STAGE_LABELS: Record<DealStage,string> = { a_etudier:"À étudier", visite:"Visite", offre:"Offre", financement:"Financement", acquis:"Acquis", refuse:"Refusé" };
export interface DealPipelineMeta { stage: DealStage; updatedAt: string; note?: string; }
export function readPipeline(){return useStore.getState().pipeline as Record<string,DealPipelineMeta>}
export function setDealStage(id:string,stage:DealStage){const all={...readPipeline(),[id]:{...(readPipeline()[id]||{}),stage,updatedAt:new Date().toISOString()}};useStore.getState().setPipeline(all);return all}
export function rankProjects(projects:RealEstateProject[]){return projects.map(p=>{const deal=computeDeal(effectiveProjectInputs(p));const r=deal.results.realiste;const prudent=deal.results.prudent;const score=deal.score;return {project:p,deal,rankScore:Math.max(0,Math.round(score))}}).sort((a,b)=>b.rankScore-a.rankScore)}
