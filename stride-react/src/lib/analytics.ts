import type { Pt, Run } from './types';
import { projector } from './geo';

/* Best time over any continuous `meters` window, using cumulative d/m on points. */
export function bestWindow(pts: Pt[], meters: number): number | null {
  if (!pts || pts.length < 2) return null;
  if (pts[pts.length - 1].d < meters) return null;
  let best = Infinity, j = 0;
  for (let i = 0; i < pts.length; i++) {
    while (pts[i].d - pts[j].d > meters) j++;
    if (j === 0) continue;
    const a = pts[j - 1], b = pts[j], target = pts[i].d - meters;
    const span = b.d - a.d;
    const f = span > 0 ? (target - a.d) / span : 0;
    const startM = a.m + f * (b.m - a.m);
    const t = (pts[i].m - startM) / 1000;
    if (t > 0 && t < best) best = t;
  }
  return isFinite(best) ? best : null;
}

export function runPBs(run: Run) {
  const p = run.points || [];
  return { k1: bestWindow(p, 1000), k5: bestWindow(p, 5000), k10: bestWindow(p, 10000) };
}

export interface PBEntry { v: number; run: Run }
export interface AllPBs { k1: PBEntry | null; k5: PBEntry | null; k10: PBEntry | null; long: PBEntry | null; fast: PBEntry | null }

export function allTimePBs(runs: Run[]): AllPBs {
  const out: AllPBs = { k1: null, k5: null, k10: null, long: null, fast: null };
  runs.forEach(r => {
    const pb = runPBs(r);
    (['k1', 'k5', 'k10'] as const).forEach(k => {
      if (pb[k] != null && (out[k] === null || pb[k]! < out[k]!.v)) out[k] = { v: pb[k]!, run: r };
    });
    if (out.long === null || r.dist > out.long.v) out.long = { v: r.dist, run: r };
    const pace = r.movingSec / (r.dist / 1000);
    if (r.dist >= 1500 && (out.fast === null || pace < out.fast.v)) out.fast = { v: pace, run: r };
  });
  return out;
}

/* achievements: which all-time bests does this run hold? */
export function achFor(run: Run, pb: AllPBs, totalRuns: number): string[] {
  if (totalRuns < 2) return [];       // your only run holding every record isn't news
  const out: string[] = [];
  if (pb.k1 && pb.k1.run.id === run.id) out.push('Fastest 1K');
  if (pb.k5 && pb.k5.run.id === run.id) out.push('Fastest 5K');
  if (pb.k10 && pb.k10.run.id === run.id) out.push('Fastest 10K');
  if (pb.long && pb.long.run.id === run.id) out.push('Longest run');
  if (pb.fast && pb.fast.run.id === run.id) out.push('Best avg pace');
  return out;
}

/* ---- pace colour ramp ---- */
export const RAMP = ['#2E4714', '#5C8C18', '#8FD11E', '#C6FF3D', '#EBFFAE'];
export function rampColor(t: number): string {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  const mix = (k: number) => Math.round(parseInt(a.substr(k, 2), 16) + (parseInt(b.substr(k, 2), 16) - parseInt(a.substr(k, 2), 16)) * f);
  return 'rgb(' + mix(1) + ',' + mix(3) + ',' + mix(5) + ')';
}

/* smoothed speed (m/s) at each point, plus a robust 10–90 percentile range */
export function speedProfile(pts: Pt[], win = 4) {
  const v = new Array<number>(pts.length).fill(0);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - win)], b = pts[Math.min(pts.length - 1, i + win)];
    const dd = b.d - a.d, dm = b.m - a.m;
    v[i] = dm > 0 ? dd / (dm / 1000) : 0;
  }
  const sorted = v.filter(x => x > 0.4).sort((a, b) => a - b);
  if (sorted.length < 4) return { v, lo: 0, hi: 1 };
  return { v, lo: sorted[Math.floor(sorted.length * 0.10)], hi: sorted[Math.floor(sorted.length * 0.90)] };
}

/* moving-ms at a given cumulative distance */
export function interpAt(p: Pt[], dist: number): number {
  let lo = 0, hi = p.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (p[mid].d < dist) lo = mid + 1; else hi = mid; }
  const b = p[lo], a = p[Math.max(0, lo - 1)];
  const span = b.d - a.d;
  return span > 0 ? a.m + (dist - a.d) / span * (b.m - a.m) : b.m;
}

export function computeStreak(runs: Run[], dayKey: (ts: number) => string): number {
  if (!runs.length) return 0;
  const days = new Set(runs.map(r => dayKey(r.startedAt)));
  let n = 0;
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);   // grace: today not required yet
  while (days.has(dayKey(d.getTime()))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---- matched runs: "you've run this route N times" ---- */
interface Fingerprint { pts: { lat: number; lng: number }[]; length: number }

export function routeFingerprint(run: Run, N: number): Fingerprint | null {
  const pts = run.points || [];
  if (pts.length < 5) return null;
  const total = pts[pts.length - 1].d;
  if (total < 300) return null;
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < N; i++) {
    const target = total * i / (N - 1);
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].d < target) lo = mid + 1; else hi = mid; }
    const b = pts[lo], a = pts[Math.max(0, lo - 1)];
    const span = b.d - a.d, f = span > 0 ? (target - a.d) / span : 0;
    out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });
  }
  return { pts: out, length: total };
}

export function routesMatch(fpA: Fingerprint | null, fpB: Fingerprint | null): boolean {
  if (!fpA || !fpB) return false;
  const r = fpA.length / fpB.length;
  if (r < 0.86 || r > 1.16) return false;
  const to = projector(fpA.pts[0].lat, fpA.pts[0].lng);
  const A = fpA.pts.map(to), B = fpB.pts.map(to);
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const fwd = mean(A.map((p, i) => Math.hypot(p.x - B[i].x, p.y - B[i].y)));
  const rev = mean(A.map((p, i) => { const q = B[B.length - 1 - i]; return Math.hypot(p.x - q.x, p.y - q.y); }));
  return Math.min(fwd, rev) < 35;
}

export function matchedRuns(run: Run, runs: Run[]): Run[] {
  const fp = routeFingerprint(run, 60);
  if (!fp) return [];
  return runs.filter(r => r.id !== run.id && routesMatch(fp, routeFingerprint(r, 60)));
}

/* ---- Grade Adjusted Pace ----
   Minetti's energy-cost-of-gradient polynomial, normalised to the flat cost (3.6 J/kg/m).
   GAP = the flat-ground pace that would have cost the same effort. */
function gradeCost(g: number): number {
  g = Math.max(-0.35, Math.min(0.35, g));
  const c = 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
  return Math.max(1.2, c) / 3.6;
}

export function gapPace(run: Run, mPerUnit: number): number | null {
  const p = (run.points || []).filter(o => o.alt != null);
  if (p.length < 20) return null;
  let eqDist = 0, totDist = 0;
  for (let i = 1; i < p.length; i++) {
    const dd = p[i].d - p[i - 1].d;
    if (dd <= 0) continue;
    const dz = (p[i].alt as number) - (p[i - 1].alt as number);
    if (Math.abs(dz) > dd * 0.4) { eqDist += dd; totDist += dd; continue; }  // GPS altitude spike
    eqDist += dd * gradeCost(dz / dd);
    totDist += dd;
  }
  if (totDist < run.dist * 0.6) return null;   // too little altitude coverage to trust
  const eqTotal = run.dist * (eqDist / totDist);
  return run.movingSec / (eqTotal / mPerUnit);
}
