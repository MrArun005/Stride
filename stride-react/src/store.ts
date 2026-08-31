import { useSyncExternalStore } from 'react';
import { DB } from './lib/db';
import type { Run, Segment, Effort, Shoe } from './lib/types';
import { buildSegIndex, matchRunToSegment } from './lib/segments';

let version = 0;
const listeners = new Set<() => void>();
export function emit() { version++; listeners.forEach(l => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;
export function useStore() { return useSyncExternalStore(subscribe, getVersion); }

export const data = {
  runs: [] as Run[],              // newest first
  segments: [] as Segment[],      // newest first
  efforts: [] as Effort[],
  shoes: [] as Shoe[],
  toastMsg: '',
  toastN: 0,
};

export function toast(msg: string) { data.toastMsg = msg; data.toastN++; emit(); }

export async function loadRuns() {
  data.runs = (await DB.all<Run>('runs')).sort((a, b) => b.startedAt - a.startedAt);
}
export async function loadSegments() {
  data.segments = (await DB.all<Segment>('segments')).sort((a, b) => b.createdAt - a.createdAt);
}
export async function loadEfforts() { data.efforts = await DB.all<Effort>('efforts'); }
export async function loadShoes() { data.shoes = await DB.all<Shoe>('shoes'); }
export async function loadAll() {
  await Promise.all([loadRuns(), loadSegments(), loadEfforts(), loadShoes()]);
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

export async function wipeAll() {
  for (const r of data.runs) await DB.del('runs', r.id);
  for (const e of data.efforts) await DB.del('efforts', e.id);
  for (const g of data.segments) await DB.del('segments', g.id);
  await loadAll();
}

/* test hook — lets the e2e scripts seed and inspect data */
declare global { interface Window { __stride?: Record<string, unknown> } }
if (typeof window !== 'undefined') {
  window.__stride = { DB, data, loadAll, saveSegment: (s: Segment) => saveSegment(s), matchSegments };
}

export async function importBackup(json: string): Promise<number> {
  const parsed = JSON.parse(json) as { runs?: Run[]; segments?: Segment[]; efforts?: Effort[]; shoes?: Shoe[] };
  const runs = parsed.runs || [];
  for (const r of runs) if (r && r.id) await DB.put('runs', r);
  for (const g of (parsed.segments || [])) if (g && g.id) await DB.put('segments', g);
  for (const e of (parsed.efforts || [])) if (e && e.id) await DB.put('efforts', e);
  for (const s of (parsed.shoes || [])) if (s && s.id) await DB.put('shoes', s);
  await loadAll();
  return runs.length;
}
