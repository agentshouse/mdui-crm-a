import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ observations: new Map<string, any>(), provider: vi.fn(), available: (() => false) as () => boolean }));
function observation(key: string, value: any) {
 const listeners = new Set<(value:any)=>void>();
 const item = { current:()=>value, subscribe:(fn:(value:any)=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},close:vi.fn(),emit:(next:any)=>{value=next;listeners.forEach(fn=>fn(next));}};
 harness.observations.set(key,item); return item;
}
vi.mock('../src/house', () => ({
 houseRuntime:async()=>({}), createHouseDataProvider:(_runtime:any,room:string,options:any)=>{harness.provider(room);harness.available=options.isAvailable;return {room,setObservedSnapshot:vi.fn(),getLocalResult:()=>({handled:false})};},
 observeRooms:async()=>harness.observations.get('rooms'), observeCrm:async()=>harness.observations.get('query'),
 observeSyncStatus:async()=>harness.observations.get('sync'),observeRoomDrafts:async()=>harness.observations.get('drafts'),
 observeServiceMode:async()=>harness.observations.get('mode'),observeStorageLoss:async()=>harness.observations.get('storage'),observeConnectionRefusal:async()=>harness.observations.get('refusal'),
}));
vi.mock('../src/components/atomic-crm/root/CRM',()=>({CRM:()=> <main>CRM content<input aria-label="Unsaved CRM edit" defaultValue="" /></main>}));
import App from '../src/App';
beforeEach(()=>{
 harness.observations.clear();harness.provider.mockClear();
 observation('rooms',[{name:'crm-port',locator:'r_18.t'}]);observation('query',{});
 observation('sync',{state:'synced',lastCompleted:'2026-10-11T13:00:00Z',providerUnreachable:false,attentionRequired:[]});observation('drafts',[]);observation('mode','open');observation('storage',null);observation('refusal',null);
});
it('uses the exact sole host binding without exposing Room names or added sync chrome',async()=>{
 render(<App/>);await screen.findByText('CRM content');expect(harness.provider).toHaveBeenCalledWith('r_18.t');
 expect(screen.queryByRole('combobox')).not.toBeInTheDocument();expect(screen.queryByText('crm-port')).not.toBeInTheDocument();expect(screen.queryByText(/Synced to House|Offline|Changes queued/)).not.toBeInTheDocument();
 act(()=>harness.observations.get('sync').emit({state:'syncing',lastCompleted:'2026-10-11T13:00:00Z',providerUnreachable:true,attentionRequired:[]}));
 expect(screen.queryByText(/Offline|Syncing to House/)).not.toBeInTheDocument();
});
it('refuses an ambiguous host list rather than selecting its first Room',async()=>{
 harness.observations.get('rooms').emit([{name:'/private',locator:'private'},{name:'crm-port',locator:'r_18.t'}]);render(<App/>);
 await screen.findByText(/received multiple data bindings/);expect(harness.provider).not.toHaveBeenCalled();expect(screen.queryByText('CRM content')).not.toBeInTheDocument();expect(screen.queryByText('/private')).not.toBeInTheDocument();
 act(()=>harness.observations.get('rooms').emit([{name:'crm-port',locator:'r_18.t'}]));await screen.findByText('CRM content');
});
it('retains refusal, returned-draft, storage-loss and read-only warnings',async()=>{
 render(<App/>);await screen.findByText('CRM content');
 act(()=>{harness.observations.get('sync').emit({lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[{}]});harness.observations.get('mode').emit('write-halted');});
 expect(screen.getByText(/returned changes that need attention/)).toBeInTheDocument();expect(screen.getByText(/uploads are paused/)).toBeInTheDocument();
 act(()=>harness.observations.get('storage').emit('storage-loss'));expect(screen.getByText(/storage-loss/)).toBeInTheDocument();
 act(()=>harness.observations.get('refusal').emit({code:'revoked-authorization',retryable:false}));await waitFor(()=>expect(screen.getByText('CRM content')).not.toBeVisible());expect(screen.getByRole('alert')).toHaveTextContent('revoked-authorization');
});

it('waits for completed sync and recovers when the sole Room arrives later',async()=>{
 harness.observations.get('rooms').emit([]);harness.observations.get('sync').emit({lastCompleted:null,attentionRequired:[]});render(<App/>);
 await screen.findByText('Loading CRM…');expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(harness.provider).not.toHaveBeenCalled();
 act(()=>harness.observations.get('sync').emit({lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[]}));
 await screen.findByText('Bind a CRM Room to this App in House to begin.');
 act(()=>harness.observations.get('rooms').emit([{name:'crm-port',locator:'r_18.t'}]));await screen.findByText('CRM content');expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(harness.available()).toBe(true);
});
it('does not read a Room that arrives before the initial sync completes',async()=>{
 harness.observations.get('sync').emit({lastCompleted:null,attentionRequired:[]});render(<App/>);await screen.findByText('Loading CRM…');expect(harness.provider).not.toHaveBeenCalled();
 act(()=>harness.observations.get('sync').emit({lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[]}));await screen.findByText('CRM content');
});
it('keeps unsaved edits mounted and blocks access while reach is lost, then recovers',async()=>{
 render(<App/>);const input=await screen.findByLabelText('Unsaved CRM edit');fireEvent.change(input,{target:{value:'unsubmitted text'}});
 act(()=>harness.observations.get('rooms').emit([]));expect(harness.available()).toBe(false);expect(input).not.toBeVisible();expect(input).toHaveValue('unsubmitted text');
 act(()=>harness.observations.get('rooms').emit([{name:'crm-port',locator:'r_18.t'}]));await waitFor(()=>expect(input).toBeVisible());expect(input).toHaveValue('unsubmitted text');expect(harness.available()).toBe(true);
 act(()=>harness.observations.get('rooms').emit([{name:'other',locator:'other'}]));expect(harness.available()).toBe(false);expect(screen.getByText(/binding changed/)).toBeInTheDocument();expect(input).toHaveValue('unsubmitted text');expect(harness.provider).toHaveBeenCalledTimes(1);
});
