/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { Form as DonorForm, type FormProps, useRecordContext, useResourceContext, useRegisterMutationMiddleware } from 'ra-core';
import { useFormContext } from 'react-hook-form';
import type { CrmDataProvider } from './house';
import type { BusinessDraft } from './business-draft';
export const HouseDraftProvider=createContext<CrmDataProvider|null>(null);
type Opening=RefObject<Promise<BusinessDraft>|null>;
export type BusinessFormMeta={houseFormDraft?:string};
const FormDraftContext=createContext<Opening|null>(null);
export function BusinessFields({openingRef}:{openingRef:Opening}){
 const provider=useContext(HouseDraftProvider);const resource=useResourceContext();const record=useRecordContext();
 const {watch,setValue,getValues}=useFormContext();const [error,setError]=useState('');
 const recordPath=record?._house?.path;
 useEffect(()=>{
  if(!provider||!resource)return;
  let disposed=false,applying=false;let editor:BusinessDraft|undefined;let stop:(()=>unknown)|undefined;
  const pending=new Map<string,number>();
  const opening=provider.openFormDraft(resource,record,getValues());openingRef.current=opening;
  const redraw=()=>{
   if(!editor||disposed)return;applying=true;
   try{for(const [key,value] of Object.entries(resource==='configuration'?{...editor.values(),...editor.values().config}:editor.values()))if(key!=='_house'&&!pending.has(key))setValue(key,value,{shouldDirty:true});}finally{applying=false;}
  };
  const subscription=watch((values,{name})=>{
   if(applying||!name||disposed)return;
   const root=name.split('.')[0];if(root==='id'||root==='_house')return;
   const sequence=(pending.get(root)??0)+1;pending.set(root,sequence);
   const value=name.split('.').reduce((value:any,part)=>value?.[part],values);
   void opening.then(current=>current.stage(resource==='configuration'&&!name.startsWith('config.')?'config.'+name:name,value)).then(()=>{
    if(disposed)return;
    if(pending.get(root)===sequence){pending.delete(root);redraw();}
    setError(editor?.inputFailure??'');
   }).catch(value=>{if(!disposed)setError(value instanceof Error?value.message:String(value))});
  });
  void opening.then(current=>{
   if(disposed){current.close();return;}editor=current;stop=current.subscribe(redraw);redraw();
  }).catch(value=>{if(!disposed)setError(value instanceof Error?value.message:String(value))});
  return()=>{disposed=true;subscription.unsubscribe();stop?.();editor?.close();if(openingRef.current===opening)openingRef.current=null;};
  // Record content remains the opened conflict baseline; the path identifies the editor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[provider,resource,recordPath,watch,setValue,getValues]);
 const middleware=useCallback(async(name:string,params:any,next:(name:string,params:any)=>Promise<any>)=>{
  if(!provider)return next(name,params);
  if(!openingRef.current)throw new Error('The local business draft is not ready.');
  const editor=await openingRef.current;
  return next(name,{...params,data:{...params.data,id:editor.id},meta:{...params.meta,houseFormDraft:editor.token}});
 },[provider,openingRef]);
 useRegisterMutationMiddleware(middleware);
 return error?<p role="alert" className="text-destructive">{error}</p>:null;
}
// Custom inline-note submitters opt in explicitly, just like SaveContext middleware.
// No ordinary provider action is allowed to discover or consume an editor by ID.
export function Form({children,onBusinessSubmit,...props}:FormProps & {onBusinessSubmit?:(values:any,meta:BusinessFormMeta)=>unknown}){
 const opening=useRef<Promise<BusinessDraft>|null>(null);
 const provider=useContext(HouseDraftProvider);
 const submit=onBusinessSubmit?async(values:any)=>{
  if(!provider){await onBusinessSubmit(values,{});return;}
  if(!opening.current)throw new Error('The local business draft is not ready.');
  const editor=await opening.current;await onBusinessSubmit({...values,id:editor.id},{houseFormDraft:editor.token});
 }:undefined;
 return <FormDraftContext.Provider value={opening}><DonorForm {...props} onSubmit={submit??props.onSubmit} warnWhenUnsavedChanges={false}><BusinessFields openingRef={opening}/>{children}</DonorForm></FormDraftContext.Provider>
}
/** Explicit donor reset action: change actual fields, rather than silently resetting UI. */
export function useBusinessReset(){
 const opening=useContext(FormDraftContext);const resource=useResourceContext();const {reset,setError}=useFormContext();
 return(values:Record<string,any>)=>{
  reset(values);
  void (async()=>{
   if(!opening?.current)throw new Error('The local business draft is not ready.');
   const editor=await opening.current;
   if(resource==='configuration')await editor.stage('config',values);
   else for(const [name,value] of Object.entries(values))await editor.stage(name,value);
  })().catch(error=>setError('root',{message:error instanceof Error?error.message:String(error)}));
 };
}
export function useBusinessDrafting(){return useContext(HouseDraftProvider)!==null}
