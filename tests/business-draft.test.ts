import { defaultConfiguration } from "../src/components/atomic-crm/root/defaultConfiguration";
import { describe,it,expect } from 'vitest';
import { fixture } from './fixtures/business-runtime';
describe('actual CRM document form drafts',()=>{
 it('persists partial fields and merges live same-browser edits with original bases',async()=>{
  const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;
  const a=await f.provider.openFormDraft('companies',row,row),b=await f.provider.openFormDraft('companies',row,row);
  await a.stage('name','First tab');await b.stage('city','Later city');await b.stage('name','Later name');
  expect(a.values()).toMatchObject({name:'Later name',city:'Later city'});expect(f.md.save).not.toHaveBeenCalled();
  expect(f.drafts.get(a.path).parts.fields.name.base).toEqual({value:'Opened company'});
  a.close();const reload=await f.provider.openFormDraft('companies',row,row);expect(reload.values().name).toBe('Later name');
  await reload.stage('size','unfinished number');expect(f.drafts.get(a.path).parts.fields.size.value).toBe('unfinished number');
  await expect(f.provider.update('companies',{id:'c1',previousData:row,data:{name:'stale submitted value'},meta:{houseFormDraft:reload.token}})).rejects.toThrow(/size/);expect(f.md.save).not.toHaveBeenCalled();
  await reload.stage('size',4);await f.provider.update('companies',{id:'c1',previousData:row,data:{name:'stale submitted value'},meta:{houseFormDraft:reload.token}});
  expect(f.md.save).toHaveBeenCalledOnce();expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.name.value).toBe('Later name');expect(f.drafts.size).toBe(0);
  reload.close();b.close();expect(f.md.query).not.toHaveBeenCalled();
 });
 it('resumes ordinary creation drafts at the final business path and saves only explicitly',async()=>{
  const f=fixture();const a=await f.provider.openFormDraft('companies',undefined,{name:'',city:'Paris'});
  await a.stage('name','Incomplete new company');const path=a.path;a.close();
  const resumed=await f.provider.openFormDraft('companies',undefined,{name:''});expect(resumed.path).toBe(path);expect(resumed.values().name).toBe('Incomplete new company');expect(f.md.save).not.toHaveBeenCalled();
  await f.provider.create('companies',{data:{id:resumed.id,name:'stale input'},meta:{houseFormDraft:resumed.token}});expect(f.md.save).toHaveBeenCalledOnce();expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].creation.fields.name).toBe('Incomplete new company');resumed.close();
 });
 it('retains a draft changed after validation instead of blindly overwriting or saving it',async()=>{
  const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;const editor=await f.provider.openFormDraft('companies',row,row);await editor.stage('name','Mine');
  const write=f.md.roomDraft.write.getMockImplementation()!;
  f.md.roomDraft.write.mockImplementationOnce(async(...args)=>{const existing=f.drafts.get(editor.path);f.drafts.set(editor.path,{...existing,revision:'other-tab-later',parts:{fields:{name:{value:'Other latest',base:{value:'Opened company'}}}}});f.emit();return write(...args)});
  await expect(f.provider.update('companies',{id:'c1',previousData:row,data:editor.values(),meta:{houseFormDraft:editor.token}})).rejects.toThrow(/changed in another tab/);
  expect(f.md.save).not.toHaveBeenCalled();expect(f.drafts.get(editor.path).parts.fields.name.value).toBe('Other latest');expect(f.md.roomDraft.discard).not.toHaveBeenCalled();editor.close();
 });
 it('keeps different nested values of one structured business field',async()=>{
  const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;const a=await f.provider.openFormDraft('companies',row,row),b=await f.provider.openFormDraft('companies',row,row);
  await a.stage('context_links.0.url','https://example.test/a');await b.stage('context_links.0.title','Other title');
  expect(a.values().context_links).toEqual([{url:'https://example.test/a',title:'Other title'}]);a.close();b.close();
 });
});

it('follows another tab saving an open creation without recreating or losing later input',async()=>{
 const f=fixture();const editor=await f.provider.openFormDraft('companies',undefined,{name:''});await editor.stage('name','Initial new company');
 const draft=f.drafts.get(editor.path);f.drafts.delete(editor.path);f.emit();
 f.documents.push({room:draft.room,path:draft.path,type:draft.parts.creation.type,fields:{...draft.parts.creation.fields,name:'Saved by the other tab'}});f.provider.setObservedSnapshot({documents:f.documents});
 expect(editor.values().name).toBe('Saved by the other tab');await editor.stage('name','Later edit');expect(f.drafts.get(editor.path).parts.creation).toBeUndefined();expect(f.drafts.get(editor.path).parts.fields.name.base).toEqual({value:'Saved by the other tab'});
 await f.provider.create('companies',{data:{id:editor.id,name:'Later edit'},meta:{houseFormDraft:editor.token}});expect(f.md.save).toHaveBeenCalledOnce();expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].creation).toBeUndefined();editor.close();
});
it('advances shown field bases after observed Save while retaining already-drafted first bases',async()=>{
 const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;const editor=await f.provider.openFormDraft('companies',row,row);
 await editor.stage('name','First local edit');f.documents[0].fields.city='Updated visible city';f.provider.setObservedSnapshot({documents:f.documents});await editor.stage('city','Second local field');
 expect(f.drafts.get(editor.path).parts.fields.name.base).toEqual({value:'Opened company'});expect(f.drafts.get(editor.path).parts.fields.city.base).toEqual({value:'Updated visible city'});
 await f.provider.update('companies',{id:'c1',previousData:row,data:editor.values(),meta:{houseFormDraft:editor.token}});f.documents[0].fields.name='First local edit';f.documents[0].fields.city='Second local field';f.provider.setObservedSnapshot({documents:f.documents});await editor.stage('name','A later edit');expect(f.drafts.get(editor.path).parts.fields.name.base).toEqual({value:'First local edit'});editor.close();
});

it('normalizes donor Settings entries only on explicit Save from their current business draft',async()=>{
 const f=fixture();f.documents.push({room:'crm-test',path:'crm/configuration/1.md',type:'crm_configuration',fields:{id:'1',config:JSON.stringify(defaultConfiguration)}});f.provider.setObservedSnapshot({documents:f.documents});
 const row=(await f.provider.getOne('configuration',{id:'1'})).data;const editor=await f.provider.openFormDraft('configuration',row,{title:row.config.title});
 await editor.stage('config.title','Draft title');await editor.stage('config.companySectors',[...row.config.companySectors,{label:'A new sector'}]);
 expect(JSON.parse(f.drafts.get(editor.path).parts.fields.config.value).companySectors.at(-1)).toEqual({label:'A new sector'});
 await f.provider.update('configuration',{id:'1',previousData:row,data:{config:{...defaultConfiguration,title:'Old submitted title'}},meta:{houseFormDraft:editor.token}});
 const config=JSON.parse(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.config.value);expect(config.title).toBe('Draft title');expect(config.companySectors.at(-1)).toEqual({label:'A new sector',value:'a-new-sector'});editor.close();
});


it('applies donor Save cleanup to current shared values rather than a stale submit transform',async()=>{
 const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;const editor=await f.provider.openFormDraft('companies',row,row);
 await editor.stage('website','latest.example.test');await f.provider.update('companies',{id:'c1',previousData:row,data:{website:'https://stale.example.test'},meta:{houseFormDraft:editor.token}});
 expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.website.value).toBe('https://latest.example.test');editor.close();
});


it('does not save an older draft after one field write fails and a different field later succeeds',async()=>{
 const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;const editor=await f.provider.openFormDraft('companies',row,row);
 await editor.stage('name','Durable earlier name');f.md.roomDraft.write.mockRejectedValueOnce(new Error('local storage unavailable'));
 await expect(editor.stage('name','Newest visible name')).rejects.toThrow('local storage');await editor.stage('city','Different field succeeds');
 await expect(f.provider.update('companies',{id:'c1',previousData:row,data:editor.values(),meta:{houseFormDraft:editor.token}})).rejects.toThrow('Some input could not');expect(f.md.save).not.toHaveBeenCalled();
 await editor.stage('name','Retried visible name');await f.provider.update('companies',{id:'c1',previousData:row,data:editor.values(),meta:{houseFormDraft:editor.token}});expect(f.md.save).toHaveBeenCalledOnce();expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.name.value).toBe('Retried visible name');editor.close();
});
