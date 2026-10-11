import { vi } from 'vitest';
import { createHouseDataProvider,type HouseRuntime } from '../../src/house';
export const room='crm-test',stamp='2026-10-11T12:00:00Z';
export function fixture(){
 let revision=0;const drafts=new Map<string,any>(),listeners=new Set<(drafts:readonly any[])=>void>();
 const documents:any[]=[{room,path:'crm/companies/c1.md',type:'crm_company',fields:{id:'c1',name:'Opened company',created_at:stamp,city:'Paris',size:3,context_links:'[]',logo:'null'}}];
 const emit=()=>listeners.forEach(fn=>fn([...drafts.values()].map(d=>structuredClone(d))));
 const md={
  query:vi.fn(async()=>{throw new Error('No per-form database query')}),
  observe:vi.fn(async(kind:string)=>kind==='room-drafts'?{current:()=>[...drafts.values()].map(d=>structuredClone(d)),subscribe:(fn:any)=>{listeners.add(fn);return()=>listeners.delete(fn)},close(){}}:{current:()=> 'write-halted',subscribe:()=>()=>{},close(){}}),
  roomDraft:{
   read:vi.fn(async(_room:string,path:string)=>structuredClone(drafts.get(path)??null)),
   write:vi.fn(async(_room:string,path:string,seen:string|null,parts:any)=>{
    const prior=drafts.get(path);if((prior?.revision??null)!==seen)return{outcome:'stale',roomDraft:structuredClone(prior)};
    const next={room,path,revision:String(++revision),parts:structuredClone(parts),returned:prior?.returned??null,changedUnderneath:{}};
    for(const group of ['fields','sections'])for(const key of Object.keys(next.parts[group]??{}))if(prior?.parts[group]?.[key])next.parts[group][key].base=prior.parts[group][key].base;
    drafts.set(path,next);emit();return{outcome:'written',roomDraft:structuredClone(next)};
   }),discard:vi.fn(),
  },
  save:vi.fn(async(_room:string,items:any[])=>{for(const item of items){const d=drafts.get(item.path);if(d?.revision!==item.revision)return{outcome:'refused',rule:'stale'};}for(const item of items)drafts.delete(item.path);emit();return{outcome:'saved',identifier:'local-only'}}),
 };
 const provider=createHouseDataProvider(md as unknown as HouseRuntime,room,{observed:true});provider.setObservedSnapshot({documents});
 return{provider,md,drafts,emit,documents};
}
