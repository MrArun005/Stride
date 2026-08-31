import type { Pt, Run, Segment } from './types';
import { projector, resample, type LatLng } from './geo';

export const SEG_TOL = 25;    // metres: how far off the line you may drift and still count
export const SEG_OFF = 70;    // metres: how far you may wander off before the effort is abandoned
export const SEG_CELL = 40;   // metres: spatial grid cell for edge lookup
export const SEG_MIN = 200;   // metres: shortest allowed segment

interface Edge { ax: number; ay: number; dx: number; dy: number; len: number; l2: number; s0: number }

export interface SegIndex {
  pts: LatLng[];
  edges: Edge[];
  grid: Map<string, number[]>;
  length: number;
  to: (p: LatLng) => { x: number; y: number };
  bbox: { la0: number; la1: number; lo0: number; lo1: number };
}

export function buildSegIndex(segPoints: LatLng[]): SegIndex {
  const pts = resample(segPoints, 8);
  const to = projector(pts[0].lat, pts[0].lng);
  const xy = pts.map(to);
  const edges: Edge[] = [];
  let cum = 0;
  for (let i = 1; i < xy.length; i++) {
    const a = xy[i - 1], b = xy[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    edges.push({ ax: a.x, ay: a.y, dx, dy, len, l2: len * len, s0: cum });
    cum += len;
  }
  const grid = new Map<string, number[]>();
  edges.forEach((e, i) => {
    const x0 = Math.min(e.ax, e.ax + e.dx) - SEG_TOL, x1 = Math.max(e.ax, e.ax + e.dx) + SEG_TOL;
    const y0 = Math.min(e.ay, e.ay + e.dy) - SEG_TOL, y1 = Math.max(e.ay, e.ay + e.dy) + SEG_TOL;
    for (let cx = Math.floor(x0 / SEG_CELL); cx <= Math.floor(x1 / SEG_CELL); cx++)
      for (let cy = Math.floor(y0 / SEG_CELL); cy <= Math.floor(y1 / SEG_CELL); cy++) {
        const k = cx + ':' + cy;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(i);
      }
  });
  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
  return {
    pts, edges, grid, length: cum, to,
    bbox: {
      la0: Math.min(...lats), la1: Math.max(...lats),
      lo0: Math.min(...lngs), lo1: Math.max(...lngs),
    },
  };
}

/* Nearest point on the segment, restricted to a window of progress.
   Restricting by `s` is what stops a looping segment from matching a later part of
   the run onto an earlier part of the line (the classic map-matching failure). */
export function projectNear(idx: SegIndex, x: number, y: number, sMin: number, sMax: number) {
  const cand = idx.grid.get(Math.floor(x / SEG_CELL) + ':' + Math.floor(y / SEG_CELL));
  if (!cand) return { s: -1, perp: Infinity };
  let bs = -1, bp = Infinity;
  for (let n = 0; n < cand.length; n++) {
    const e = idx.edges[cand[n]];
    if (e.s0 + e.len < sMin || e.s0 > sMax) continue;
    let t = ((x - e.ax) * e.dx + (y - e.ay) * e.dy) / e.l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const s = e.s0 + e.len * t;
    if (s < sMin || s > sMax) continue;
    const d = Math.hypot(x - (e.ax + e.dx * t), y - (e.ay + e.dy * t));
    if (d < bp) { bp = d; bs = s; }
  }
  return { s: bs, perp: bp };
}

export interface FoundEffort { dur: number; startIdx: number; endIdx: number; startM: number; endM: number; startD: number; endD: number }

/* find every effort a run made on a segment */
export function matchRunToSegment(run: Run, idx: SegIndex): FoundEffort[] {
  const pts = run.points || [];
  if (pts.length < 3) return [];
  const b = idx.bbox, pad = 0.0004;                 // cheap bbox reject
  let overlaps = false;
  for (let i = 0; i < pts.length; i += 5) {
    const p = pts[i];
    if (p.lat > b.la0 - pad && p.lat < b.la1 + pad && p.lng > b.lo0 - pad && p.lng < b.lo1 + pad) { overlaps = true; break; }
  }
  if (!overlaps) return [];

  const L = idx.length;
  const xy = pts.map(p => idx.to(p));
  const entryWin = Math.min(60, L * 0.12);
  const endTol = Math.min(40, L * 0.06);
  const efforts: FoundEffort[] = [];
  let i = 0;
  while (i < pts.length) {
    const e0 = projectNear(idx, xy[i].x, xy[i].y, 0, entryWin);   // are we at the start line?
    if (e0.perp > SEG_TOL) { i++; continue; }

    let curS = e0.s, j = i, offD = 0, exit = -1, exitS = 0, inl = 1, tot = 1;
    while (++j < pts.length) {
      const pr = projectNear(idx, xy[j].x, xy[j].y, curS - 25, curS + 200);
      tot++;
      if (pr.perp > SEG_TOL) {                      // bad fix, or genuinely off the line
        offD += Math.max(0, pts[j].d - pts[j - 1].d);
        if (offD > SEG_OFF) break;
        continue;
      }
      offD = 0; inl++;
      if (pr.s > curS) curS = pr.s;
      if (curS >= L - endTol) { exit = j; exitS = pr.s; break; }
    }
    if (exit < 0 || inl / tot < 0.7) { i++; continue; }

    const entryM = crossTime(pts, i, e0.s, +1);     // interpolate the exact line crossings
    const exitM = crossTime(pts, exit, L - exitS, -1);
    const dur = (exitM - entryM) / 1000;
    const travelled = pts[exit].d - pts[i].d;
    if (dur > 5 && travelled < L * 1.45 && travelled > L * 0.7) {
      efforts.push({ dur, startIdx: i, endIdx: exit, startM: entryM, endM: exitM, startD: pts[i].d, endD: pts[exit].d });
    }
    i = exit + 1;
  }
  return efforts;
}

/* time (moving ms) at which the run crossed the start (dir +1) or finish (dir -1) line,
   `gap` metres away from point k, using the local speed there */
function crossTime(pts: Pt[], k: number, gap: number, dir: 1 | -1): number {
  const p = pts[k];
  const nb = pts[k + (dir > 0 ? -1 : 1)] || pts[k + (dir > 0 ? 1 : -1)] || p;
  const dd = Math.abs(nb.d - p.d), dm = Math.abs(nb.m - p.m);
  if (!dd || !dm) return p.m;
  const v = dd / dm;                                // metres per millisecond
  return dir > 0 ? p.m - gap / v : p.m + gap / v;
}

export function sliceRunByDistance(run: Run, d0: number, d1: number): LatLng[] {
  const pts = run.points || [], out: LatLng[] = [];
  for (const p of pts) if (p.d >= d0 && p.d <= d1) out.push({ lat: p.lat, lng: p.lng });
  return out;
}

export function segIndexFor(seg: Segment): SegIndex {
  return buildSegIndex(seg.points);
}
