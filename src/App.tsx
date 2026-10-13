import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { connectLocalQueryProjection } from './local-query-projection';
import { HouseDraftProvider } from './house-form';
import { CRM } from '@/components/atomic-crm/root/CRM';
import { createHouseDataProvider, houseRuntime, observeRooms, observeCrm, observeSyncStatus, observeRoomDrafts, observeServiceMode, observeStorageLoss, observeConnectionRefusal, type HouseRuntime, type HouseRoom } from './house';
type Observation<T> = { current(): T; subscribe(listener: (value: T) => void): () => void; close(): void };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export default function App() {
 const [runtime, setRuntime] = useState<HouseRuntime | null>(null);
 const [rooms, setRooms] = useState<readonly HouseRoom[]>([]);
 const [room, setRoom] = useState('');
 const [completed, setCompleted] = useState(false);
 const [hasSnapshot, setHasSnapshot] = useState(false);
 const [error, setError] = useState('');
 const [attention, setAttention] = useState('');
 const [halted, setHalted] = useState(false);
 const [fatal, setFatal] = useState(false);
 const available = useRef(false);
 useEffect(() => {
  let disposed = false; let latestRooms: readonly HouseRoom[] = []; let synced = false; let selected = ''; let refused = false;
  const cleanups: (() => void)[] = [];
  function refresh() {
   if (!selected && synced && latestRooms.length === 1) { selected = latestRooms[0].locator; setRoom(selected); }
   available.current = !disposed && !refused && synced && latestRooms.length === 1 && latestRooms[0].locator === selected;
  }
  async function listen<T>(promise: Promise<Observation<T>>, apply: (value: T) => void) {
   const observation = await promise;
   if (disposed) { observation.close(); return; }
   apply(observation.current());
   cleanups.push(observation.subscribe(value => { if (!disposed) apply(value); }), () => observation.close());
  }
  async function connect() {
   const md = await houseRuntime(); if (disposed) return; setRuntime(md);
   await Promise.all([
    listen(observeRooms(md), value => { latestRooms = value; setRooms(value); refresh(); }),
    listen(observeSyncStatus(md), value => { synced = typeof value.lastCompleted === 'string'; setCompleted(synced); setAttention(value.attentionRequired.length ? 'House returned changes that need attention. Your Room drafts are preserved. Resolve them in House before retrying.' : ''); refresh(); }),
    listen(observeRoomDrafts(md), value => { if (value.some(d => d.returned)) setAttention('A Room draft needs attention. Resolve it in House before editing that document again.'); }),
    listen(observeServiceMode(md), value => setHalted(value === 'write-halted')),
    listen(observeStorageLoss(md), value => { if (value) setAttention(`House storage warning: ${value}`); }),
    listen(observeConnectionRefusal(md), value => { refused = Boolean(value); setFatal(refused); setError(value ? `House connection refused: ${value.code}` : ''); refresh(); }),
   ]);
  }
  void connect().catch(err => { if (!disposed) { available.current = false; setError(errorText(err)); setFatal(true); } });
  return () => { disposed = true; available.current = false; cleanups.forEach(fn => fn()); };
 }, []);
 const ready = completed && rooms.length === 1 && rooms[0].locator === room;
 const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false, meta: { room } }, mutations: { retry: false } } }), [room]);
 const provider = useMemo(() => runtime && room ? createHouseDataProvider(runtime, room, { observed: true, isAvailable: () => available.current, onMutation: event => { if (event.phase === 'error') setError(event.message); else if (event.phase === 'queued') setError(''); } }) : null, [runtime, room]);
 useEffect(() => {
  if (!runtime || !room || !provider || !ready || fatal) return;
  let disposed = false; let cleanup: (() => void) | undefined;
  const projection = connectLocalQueryProjection(queryClient, provider);
  observeCrm(runtime, room).then(observation => {
   if (disposed) { observation.close(); return; }
   const render = () => { try { provider.setObservedSnapshot(observation.current()); projection.refresh(); setHasSnapshot(true); setError(''); } catch (value) { setError(errorText(value)); } };
   render(); const stop = observation.subscribe(render); cleanup = () => { stop(); observation.close(); };
  }).catch(err => { if (!disposed) setError(errorText(err)); });
  return () => { disposed = true; projection.close(); cleanup?.(); };
 }, [runtime, room, provider, ready, fatal, queryClient]);
 const bindingError = !completed ? '' : rooms.length > 1 ? 'CRM received multiple data bindings. Check this App’s configuration in House.' : rooms.length === 0 ? 'Bind a CRM Room to this App in House to begin.' : room && rooms[0].locator !== room ? 'The CRM data binding changed. Copy your open edits before reloading; they have not been moved.' : '';
 return <div className="house-crm">
  {(bindingError || error) && <div role="alert" className="house-error">{bindingError || error}</div>}
  {attention && <div role="status" className="house-warning">{attention}</div>}
  {halted && <div role="status" className="house-warning">House uploads are paused. Local drafts and Save remain available.</div>}
  {provider && hasSnapshot && <div hidden={!ready || fatal} inert={!ready || fatal}><HouseDraftProvider value={provider}><CRM key={room} dataProvider={provider} queryClient={queryClient} /></HouseDraftProvider></div>}
  {(!provider || !hasSnapshot || !ready || fatal) && <main className="max-w-screen-xl mx-auto p-8"><h1 className="text-2xl font-semibold">CRM</h1><p>{fatal ? 'The House connection needs attention before CRM can load.' : !completed ? 'Loading CRM…' : bindingError ? 'Open edits are kept until the data binding returns.' : 'Loading CRM…'}</p></main>}
 </div>;
}
