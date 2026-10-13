import { defaultConfiguration } from "../src/components/atomic-crm/root/defaultConfiguration";
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { describe,it,expect,vi } from 'vitest';
import { CoreAdminContext,RecordContextProvider,ResourceContextProvider,memoryStore } from 'ra-core';
import { QueryClient } from '@tanstack/react-query';
import { Form,HouseDraftProvider,useBusinessReset } from '../src/house-form';
import { TextInput } from '../src/components/admin/text-input';
import { NumberInput } from '../src/components/admin/number-input';
import { fixture } from './fixtures/business-runtime';
describe('mounted donor CRM forms',()=>{
 it('restores ordinary drafts and incomplete numeric text; observes other tabs and saves locally',async()=>{
  const f=fixture(),row=(await f.provider.getOne('companies',{id:'c1'})).data;const errors:any[]=[];
  const submit=vi.fn(async(data:any,meta:any)=>{try{await f.provider.update('companies',{id:'c1',previousData:row,data,meta})}catch(error){errors.push(error)}});
  const view=()=>render(<CoreAdminContext dataProvider={f.provider} store={memoryStore()} queryClient={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><HouseDraftProvider value={f.provider}><ResourceContextProvider value="companies"><RecordContextProvider value={row}><Form record={row} onBusinessSubmit={submit}><TextInput source="name" label="Company name"/><TextInput source="city" label="City"/><NumberInput source="size" label="Size"/><button type="submit">Save document</button></Form></RecordContextProvider></ResourceContextProvider></HouseDraftProvider></CoreAdminContext>);
  let mounted=view();await waitFor(()=>expect(f.md.observe).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Company name'),{target:{value:'Typed company'}});fireEvent.change(screen.getByLabelText('Size'),{target:{value:'-'}});
  await waitFor(()=>expect(f.drafts.get(row._house.path)?.parts.fields.size.value).toBe('-'));expect(f.md.save).not.toHaveBeenCalled();
  mounted.unmount();mounted=view();await waitFor(()=>{expect(screen.getByLabelText('Company name')).toHaveValue('Typed company');expect(screen.getByLabelText('Size')).toHaveValue('-')});
  fireEvent.click(screen.getByText('Save document'));await waitFor(()=>expect(errors.length).toBe(1));expect(f.md.save).not.toHaveBeenCalled();expect(f.drafts.get(row._house.path).parts.fields.size.value).toBe('-');
  const other=await f.provider.openFormDraft('companies',row,row);await act(async()=>{await other.stage('city','Other tab city')});expect(screen.getByLabelText('City')).toHaveValue('Other tab city');
  fireEvent.change(screen.getByLabelText('Size'),{target:{value:'12.50'}});await waitFor(()=>expect(f.drafts.get(row._house.path).parts.fields.size.value).toBe('12.50'));
  fireEvent.click(screen.getByText('Save document'));await waitFor(()=>expect(f.md.save).toHaveBeenCalledOnce());expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.size.value).toBe(12.5);other.close();mounted.unmount();expect(f.md.query).not.toHaveBeenCalled();
 });
 it('preserves a new record across real form unmount and resume without creating UI documents',async()=>{
  const f=fixture();const view=()=>render(<CoreAdminContext dataProvider={f.provider} store={memoryStore()}><HouseDraftProvider value={f.provider}><ResourceContextProvider value="companies"><Form><TextInput source="name" label="New company"/></Form></ResourceContextProvider></HouseDraftProvider></CoreAdminContext>);
  let mounted=view();await waitFor(()=>expect(f.md.observe).toHaveBeenCalled());fireEvent.change(screen.getByLabelText('New company'),{target:{value:'Unfinished creation'}});await waitFor(()=>expect(f.drafts.size).toBe(1));const draft=[...f.drafts.values()][0];expect(draft.parts.creation.type).toBe('crm_company');expect(draft.path).toMatch(/^crm\/companies\//);mounted.unmount();mounted=view();await waitFor(()=>expect(screen.getByLabelText('New company')).toHaveValue('Unfinished creation'));expect(f.drafts.size).toBe(1);expect(f.md.save).not.toHaveBeenCalled();mounted.unmount();
 });
});

it('persists the Settings form’s flattened controls in the actual config field',async()=>{
 const f=fixture();f.documents.push({room:'crm-test',path:'crm/configuration/1.md',type:'crm_configuration',fields:{id:'1',config:JSON.stringify(defaultConfiguration)}});f.provider.setObservedSnapshot({documents:f.documents});const row=(await f.provider.getOne('configuration',{id:'1'})).data;
 const view=()=>render(<CoreAdminContext dataProvider={f.provider} store={memoryStore()}><HouseDraftProvider value={f.provider}><ResourceContextProvider value="configuration"><RecordContextProvider value={row}><Form record={row} defaultValues={{title:defaultConfiguration.title}}><TextInput source="title" label="CRM title"/></Form></RecordContextProvider></ResourceContextProvider></HouseDraftProvider></CoreAdminContext>);
 let mounted=view();await waitFor(()=>expect(f.md.observe).toHaveBeenCalled());fireEvent.change(screen.getByLabelText('CRM title'),{target:{value:'My unfinished title'}});await waitFor(()=>expect(JSON.parse(f.drafts.get(row._house.path)?.parts.fields.config.value).title).toBe('My unfinished title'));mounted.unmount();mounted=view();await waitFor(()=>expect(screen.getByLabelText('CRM title')).toHaveValue('My unfinished title'));expect(f.drafts.size).toBe(1);expect(f.md.save).not.toHaveBeenCalled();mounted.unmount();
});


it('persists explicit Settings Reset defaults on the actual document and saves the reset values',async()=>{
 const f=fixture();const custom={...defaultConfiguration,title:'Custom title'};f.documents.push({room:'crm-test',path:'crm/configuration/1.md',type:'crm_configuration',fields:{id:'1',config:JSON.stringify(custom)}});f.provider.setObservedSnapshot({documents:f.documents});const row=(await f.provider.getOne('configuration',{id:'1'})).data;
 function Reset(){const reset=useBusinessReset();return <button type="button" onClick={()=>reset(defaultConfiguration)}>Reset defaults</button>}
 const submit=async(data:any,meta:any)=>f.provider.update('configuration',{id:'1',previousData:row,data:{config:data},meta});
 const view=()=>render(<CoreAdminContext dataProvider={f.provider} store={memoryStore()}><HouseDraftProvider value={f.provider}><ResourceContextProvider value="configuration"><Form record={row} defaultValues={custom} onBusinessSubmit={submit}><TextInput source="title" label="Title"/><Reset/><button type="submit">Save reset</button></Form></ResourceContextProvider></HouseDraftProvider></CoreAdminContext>);
 let mounted=view();await waitFor(()=>expect(screen.getByLabelText('Title')).toHaveValue('Custom title'));fireEvent.click(screen.getByText('Reset defaults'));await waitFor(()=>expect(JSON.parse(f.drafts.get(row._house.path).parts.fields.config.value).title).toBe(defaultConfiguration.title));mounted.unmount();mounted=view();await waitFor(()=>expect(screen.getByLabelText('Title')).toHaveValue(defaultConfiguration.title));fireEvent.click(screen.getByText('Save reset'));await waitFor(()=>expect(f.md.save).toHaveBeenCalledOnce());expect(JSON.parse(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.config.value).title).toBe(defaultConfiguration.title);mounted.unmount();
});
