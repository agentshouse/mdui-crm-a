import type { HouseRuntime } from './house';
import { DraftSession, type RoomDraft } from './draft-session';
export type DraftRow = Record<string, any>;
type Codec = {
 fields: readonly string[];
 storageKey(name: string): string;
 encode(name: string, value: unknown): unknown;
 decode(name: string, value: unknown): unknown;
 forSave?(name:string,value:unknown):unknown;
};
function putPath(value: unknown, path: string[], next: unknown): unknown {
 if (!path.length) return next;
 const [key,...rest]=path;
 const copy: any = Array.isArray(value) ? [...value] : value && typeof value==='object' ? {...value} : /^\d+$/.test(key) ? [] : {};
 if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Invalid form field path.');
 copy[key]=putPath(copy[key],rest,next);return copy;
}
export class BusinessDraft {
 readonly token=crypto.randomUUID();
 readonly session: DraftSession;
 row: DraftRow;
 readonly codec: Codec;
 readonly type: string;
 openedFields: Readonly<Record<string, unknown>> | null;
 private stop: (()=>void) | undefined;
 private inputSequence=0;
 private latestInput=new Map<string,number>();
 private failedInputs=new Map<string,unknown>();
 get inputFailure(){return this.failedInputs.size?"Some input could not be written to the local Room draft. Keep this form open and retry that input before Save.":"";}
 onClose: (()=>void) | undefined;
 constructor(runtime: HouseRuntime,room:string,path:string,row:DraftRow,type:string,openedFields:Readonly<Record<string,unknown>>|null,codec:Codec) {
  this.session=new DraftSession(runtime,room,path);this.row=row;this.type=type;this.openedFields=openedFields;this.codec=codec;
 }
 adopt(row:DraftRow,fields:Readonly<Record<string,unknown>>){this.row=row;this.openedFields=fields;this.session.accept(this.session.current())}
 get id(){return this.row.id}
 get path(){return this.session.path}
 values(draft=this.session.current(),fallback:DraftRow=this.row):DraftRow {
  const result:DraftRow={...fallback,id:this.id};const creation=draft?.parts.creation;
  for(const key of this.codec.fields){
   const stored=this.codec.storageKey(key);
   if(creation && 'fields' in creation && Object.hasOwn(creation.fields,stored))result[key]=this.codec.decode(key,creation.fields[stored]);
   if(draft?.parts.fields && Object.hasOwn(draft.parts.fields,stored))result[key]=this.codec.decode(key,draft.parts.fields[stored].value);
  }
  return result;
 }
 async observe(){
  const observation=await this.session.runtime.observe('room-drafts');
  const accept=(drafts:readonly RoomDraft[])=>this.session.accept(drafts.find(d=>d.room===this.session.room&&d.path===this.path)??null);
  accept(observation.current());const unsub=observation.subscribe(accept);this.stop=()=>{unsub();observation.close()};await this.session.read();return this;
 }
 close(){this.stop?.();this.stop=undefined;this.onClose?.();this.onClose=undefined}
 subscribe(fn:()=>void){return this.session.subscribe(fn)}
 stage(name:string,value:unknown){
  const [key,...tail]=name.split('.');if(key==='id'||!this.codec.fields.includes(key))return Promise.resolve(this.session.current());
  const opened=this.openedFields;const sequence=++this.inputSequence;this.latestInput.set(name,sequence);
  return this.session.stage(current=>{
   const view=this.values(current);const next=tail.length?putPath(view[key],tail,value):value;
   const stored=this.codec.storageKey(key),encoded=this.codec.encode(key,next);
   if(opened)return{fields:{[stored]:{value:encoded,base:Object.hasOwn(opened,stored)?{value:opened[stored]}:null}}};
   const fields=Object.fromEntries(this.codec.fields.filter(field=>view[field]!==undefined).map(field=>[this.codec.storageKey(field),this.codec.encode(field,view[field])]));
   fields[stored]=encoded;
   return{creation:{type:this.type,fields,sections:{}}};
  }).then(result=>{
   if(this.latestInput.get(name)===sequence){this.failedInputs.delete(name);for(const key of this.failedInputs.keys())if(key.startsWith(name+'.'))this.failedInputs.delete(key);}
   return result;
  },error=>{if(this.latestInput.get(name)===sequence)this.failedInputs.set(name,error);throw error});
 }
 async prepare(input:DraftRow){
  await this.session.flush();if(this.failedInputs.size)throw new Error(this.inputFailure);const draft=await this.session.runtime.roomDraft.read(this.session.room,this.path);this.session.accept(draft);
  const data=this.values(draft,{...input,...this.row});
  for(const key of this.codec.fields)if(Object.hasOwn(data,key)&&this.codec.forSave)data[key]=this.codec.forSave(key,data[key]);
  // A valid numeric round trip may be semantically unchanged but its draft still
  // contains raw input. Normalize that exact draft too, preserving revision/bases.
  const normalized:any=draft?structuredClone(draft):null;
  if(normalized)for(const key of this.codec.fields){
   const stored=this.codec.storageKey(key);
   if(normalized.parts.fields&&Object.hasOwn(normalized.parts.fields,stored))normalized.parts.fields[stored].value=this.codec.encode(key,data[key]);
   if(normalized.parts.creation&&'fields' in normalized.parts.creation&&Object.hasOwn(normalized.parts.creation.fields,stored))normalized.parts.creation.fields[stored]=this.codec.encode(key,data[key]);
  }
  return{draft:normalized,data};
 }
}
