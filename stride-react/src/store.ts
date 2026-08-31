import { useSyncExternalStore } from 'react';
import { DB } from './lib/db';
import type { Run, Segment, Effort, Shoe, Route, RunPhoto } from './lib/types';
import { buildSegIndex, matchRunToSegment } from './lib/segments';

let version = 0;
const listeners = new Set<() => void>();
export function emit() { version++; listeners.forEach(l => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;
export function useStore() { return useSyncExternalStore(subscribe, getVersion); }

export const data = {
  runs: [] as Run[],              // newest first
  segments: [] as Segment[],      // starred first, then newest
  efforts: [] as Effort[],
  shoes: [] as Shoe[],
  routes: [] as Route[],          // newest first
  toastMsg: '',
  toastN: 0,
};

export function toast(msg: string) { data.toastMsg = msg; data.toastN++; emit(); }

export async function loadRuns() {
  data.runs = (await DB.all<Run>('runs')).sort((a, b) => b.startedAt - a.startedAt);
}
export async function loadSegments() {
  data.segments = (await DB.all<Segment>('segments'))
    .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || b.createdAt - a.createdAt);
}
export async function loadEfforts() { data.efforts = await DB.all<Effort>('efforts'); }
export async function loadShoes() { data.shoes = await DB.all<Shoe>('shoes'); }
export async function loadRoutes() {
  data.routes = (await DB.all<Route>('routes')).sort((a, b) => b.createdAt - a.createdAt);
}
export async function loadAll() {
  await Promise.all([loadRuns(), loadSegments(), loadEfforts(), loadShoes(), loadRoutes()]);
  emit();
}

export const segEfforts = (segId: number) =>
  data.efforts.filter(e => e.segId === segId).sort((a, b) => a.dur - b.dur);

export const effortRank = (e: Effort) => {
  const all = segEfforts(e.segId);
  return { rank: all.findIndex(x => x.id === e.id) + 1, of: all.length };
};

export const rankCls = (i: number) => i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '';

/* recompute and persist efforts for (runs × segs) */
export async function matchSegments(runs: Run[], segs: Segment[]): Promise<number> {
  let added = 0;
  for (const seg of segs) {
    const idx = buildSegIndex(seg.points);
    for (const run of runs) {
      const existing = data.efforts.filter(e => e.segId === seg.id && e.runId === run.id);
      for (const e of existing) await DB.del('efforts', e.id);
      const found = matchRunToSegment(run, idx);
      for (let k = 0; k < found.length; k++) {
        const rec: Effort = {
          id: seg.id + '_' + run.id + '_' + k, segId: seg.id, runId: run.id,
          startedAt: run.startedAt + found[k].startM, dur: Math.round(found[k].dur * 10) / 10,
          startD: Math.round(found[k].startD), endD: Math.round(found[k].endD),
        };
        await DB.put('efforts', rec); added++;
      }
    }
  }
  await loadEfforts();
  emit();
  return added;
}

export async function saveRun(run: Run) {
  await DB.put('runs', run);
  await loadRuns();
  if (data.segments.length) await matchSegments([run], data.segments);
  emit();
}

export async function deleteRun(run: Run) {
  for (const e of data.efforts.filter(x => x.runId === run.id)) await DB.del('efforts', e.id);
  await DB.del('runs', run.id);
  await loadRuns(); await loadEfforts();
  emit();
}

export async function saveSegment(seg: Segment): Promise<number> {
  await DB.put('segments', seg);
  await loadSegments();
  const n = await matchSegments(data.runs, [seg]);
  emit();
  return n;
}

export async function deleteSegment(seg: Segment) {
  for (const e of data.efforts.filter(x => x.segId === seg.id)) await DB.del('efforts', e.id);
  await DB.del('segments', seg.id);
  await loadSegments(); await loadEfforts();
  emit();
}

export async function addShoe(name: string) {
  const shoe: Shoe = { id: Date.now(), name: name.slice(0, 40), addedAt: Date.now(), retired: false };
  await DB.put('shoes', shoe);
  await loadShoes(); emit();
  return shoe;
}
export async function updateShoe(shoe: Shoe) { await DB.put('shoes', shoe); await loadShoes(); emit(); }
export async function deleteShoe(id: number) { await DB.del('shoes', id); await loadShoes(); emit(); }
export const shoeDistance = (shoeId: number) =>
  data.runs.filter(r => r.shoeId === shoeId).reduce((a, r) => a + r.dist, 0);

export async function setRunShoe(run: Run, shoeId: number | null) {
  run.shoeId = shoeId;
  await DB.put('runs', run);
  await loadRuns(); emit();
}

export async function saveRoute(route: Route) {
  await DB.put('routes', route); await loadRoutes(); emit();
}
export async function deleteRoute(id: number) {
  await DB.del('routes', id); await loadRoutes(); emit();
}

export async function toggleStar(seg: Segment) {
  seg.starred = !seg.starred;
  await DB.put('segments', seg); await loadSegments(); emit();
}

export async function renameRun(run: Run, name: string) {
  run.name = name.slice(0, 60) || run.name;
  await DB.put('runs', run); await loadRuns(); emit();
}

/* ---- photos (stored as blobs, per run) ---- */
export async function photosFor(runId: number): Promise<RunPhoto[]> {
  return (await DB.all<RunPhoto>('photos')).filter(p => p.runId === runId).sort((a, b) => a.ts - b.ts);
}
export async function addPhoto(runId: number, file: File): Promise<RunPhoto> {
  const blob = await compressImage(file, 1600, .82);
  const photo: RunPhoto = { id: runId + '_' + Date.now(), runId, ts: Date.now(), blob };
  await DB.put('photos', photo);
  return photo;
}
export async function deletePhoto(id: string) { await DB.del('photos', id); }
async function compressImage(file: File, maxPx: number, q: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise(res => canvas.toBlob(b => res(b || file), 'image/jpeg', q));
}

export async function wipeAll() {
  for (const r of data.runs) await DB.del('runs', r.id);
  for (const e of data.efforts) await DB.del('efforts', e.id);
  for (const g of data.segments) await DB.del('segments', g.id);
  for (const rt of data.routes) await DB.del('routes', rt.id);
  for (const p of await DB.all<RunPhoto>('photos')) await DB.del('photos', p.id);
  await loadAll();
}

/* test hook — lets the e2e scripts seed and inspect data */
declare global { interface Window { __stride?: Record<string, unknown> } }
if (typeof window !== 'undefined') {
  window.__stride = { DB, data, loadAll, saveSegment: (s: Segment) => saveSegment(s), matchSegments };
}

export async function importBackup(json: string): Promise<number> {
  const parsed = JSON.parse(json) as {
    runs?: Run[]; segments?: Segment[]; efforts?: Effort[]; shoes?: Shoe[]; routes?: Route[];
    photos?: { id: string; runId: number; ts: number; dataUrl: string }[];
  };
  const runs = parsed.runs || [];
  for (const r of runs) if (r && r.id) await DB.put('runs', r);
  for (const g of (parsed.segments || [])) if (g && g.id) await DB.put('segments', g);
  for (const e of (parsed.efforts || [])) if (e && e.id) await DB.put('efforts', e);
  for (const s of (parsed.shoes || [])) if (s && s.id) await DB.put('shoes', s);
  for (const rt of (parsed.routes || [])) if (rt && rt.id) await DB.put('routes', rt);
  for (const ph of (parsed.photos || [])) {
    if (!ph || !ph.id || !ph.dataUrl) continue;
    const blob = await (await fetch(ph.dataUrl)).blob();
    await DB.put('photos', { id: ph.id, runId: ph.runId, ts: ph.ts, blob } satisfies RunPhoto);
  }
  await loadAll();
  return runs.length;
}

export async function exportPhotosAsDataUrls(): Promise<{ id: string; runId: number; ts: number; dataUrl: string }[]> {
  const photos = await DB.all<RunPhoto>('photos');
  const out: { id: string; runId: number; ts: number; dataUrl: string }[] = [];
  for (const p of photos) {
    const dataUrl = await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(p.blob);
    });
    out.push({ id: p.id, runId: p.runId, ts: p.ts, dataUrl });
  }
  return out;
}
