import { useSyncExternalStore } from 'react';
import type { Pt, Run, Split } from './types';
import { S, M_PER_UNIT, UNIT } from './settings';
import { haversine } from './geo';
import { fmtDist } from './format';
import { speakDur } from './format';
import { DB } from './db';
import { saveRun, toast, data } from '../store';
import { initLive, resetLive, liveOnPoint } from './livesegments';

export const ACC_MAX = 30;        // metres — reject fixes worse than this
export const MAX_SPEED = 11;      // m/s — reject teleport fixes (~40 km/h)
export const MIN_STEP = 2.5;      // metres — ignore GPS jitter below this
export const IDLE_MS = 7000;      // auto-pause after this long without movement

export type TrackerState = 'idle' | 'running' | 'paused';
export interface Fix { lat: number; lng: number; acc: number }

export const T = {
  state: 'idle' as TrackerState,
  points: [] as Pt[], dist: 0, movingMs: 0, startedAt: 0,
  splits: [] as Split[], nextSplit: 1000, lastSplitM: 0,
  elevGain: 0, elevLoss: 0, lastAlt: null as number | null,
  lastMoveTs: 0, autoPaused: false, tickAnchor: 0,
  watchId: null as number | null, lastFix: null as Fix | null,
  wakeLock: null as WakeLockSentinel | null,
  gpsAcc: null as number | null, gpsSeen: false,
  permError: '' ,
};

/* subscription for React */
let version = 0;
const listeners = new Set<() => void>();
function tEmit() { version++; listeners.forEach(l => l()); }
const tSubscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useTracker() { return useSyncExternalStore(tSubscribe, () => version); }

/* map hooks, set by the run screen */
export const mapHooks = {
  onFix: null as ((fix: Fix, running: boolean) => void) | null,
  onPoint: null as ((p: Pt) => void) | null,
  onReset: null as (() => void) | null,
};
/* called by the app shell when a run is saved */
export let onFinished: ((run: Run) => void) | null = null;
export function setOnFinished(cb: (run: Run) => void) { onFinished = cb; }

function resetTracker() {
  Object.assign(T, {
    state: 'idle', points: [], dist: 0, movingMs: 0, startedAt: 0,
    splits: [], nextSplit: 1000, lastSplitM: 0, elevGain: 0, elevLoss: 0, lastAlt: null,
    lastMoveTs: 0, autoPaused: false, tickAnchor: 0,
  });
}

/* ---- geolocation ---- */
export function startWatch() {
  if (!navigator.geolocation) { T.permError = 'This browser has no GPS support.'; tEmit(); return; }
  if (T.watchId != null) return;
  T.watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
    enableHighAccuracy: true, maximumAge: 1000, timeout: 20000,
  });
}
function onGeoError(err: GeolocationPositionError) {
  if (err.code === 1) {
    T.permError = 'Location blocked. Allow location for this site in your browser settings, then reload.';
  } else { T.gpsAcc = null; }
  tEmit();
}

export function onPosition(pos: GeolocationPosition) {
  const c = pos.coords, t = pos.timestamp || Date.now();
  T.lastFix = { lat: c.latitude, lng: c.longitude, acc: c.accuracy };
  T.gpsAcc = c.accuracy; T.gpsSeen = true;
  mapHooks.onFix?.(T.lastFix, T.state === 'running');
  if (T.state !== 'running') { tEmit(); return; }
  if (c.accuracy > ACC_MAX) { tEmit(); return; }

  const cur: Pt = {
    lat: c.latitude, lng: c.longitude, t,
    alt: (c.altitude == null ? null : c.altitude), acc: c.accuracy, d: 0, m: 0,
  };
  const prev = T.points[T.points.length - 1];

  if (!prev) {
    cur.d = 0; cur.m = T.movingMs;
    T.points.push(cur); T.lastMoveTs = t; T.lastAlt = cur.alt;
    mapHooks.onPoint?.(cur); tEmit(); return;
  }
  const dt = (t - prev.t) / 1000;
  if (dt <= 0) return;
  const d = haversine(prev, cur);
  if (d / dt > MAX_SPEED) return;               // impossible jump
  if (d < MIN_STEP && dt < 10) return;          // jitter while standing still

  T.dist += d;
  cur.d = T.dist; cur.m = T.movingMs;
  T.points.push(cur);
  T.lastMoveTs = t;
  if (T.autoPaused) T.autoPaused = false;

  if (cur.alt != null && T.lastAlt != null) {
    const dz = cur.alt - T.lastAlt;
    if (Math.abs(dz) > 1.5) { if (dz > 0) T.elevGain += dz; else T.elevLoss -= dz; T.lastAlt = cur.alt; }
  } else if (cur.alt != null && T.lastAlt == null) T.lastAlt = cur.alt;

  mapHooks.onPoint?.(cur);
  liveOnPoint(cur);
  checkSplits(prev, cur);
  tEmit();
}

/* ---- km / mile splits ---- */
function checkSplits(prev: Pt, cur: Pt) {
  const step = M_PER_UNIT();
  while (T.dist >= T.nextSplit) {
    const span = cur.d - prev.d;
    const f = span > 0 ? (T.nextSplit - prev.d) / span : 1;
    const crossM = prev.m + f * (cur.m - prev.m);
    const dur = (crossM - T.lastSplitM) / 1000;
    const sp: Split = { n: T.splits.length + 1, dur, pace: dur, at: crossM };
    T.splits.push(sp);
    T.lastSplitM = crossM;
    T.nextSplit += step;
    announceSplit(sp);
  }
  if (T.nextSplit - T.dist > step) T.nextSplit = (T.splits.length + 1) * step;
}

function announceSplit(sp: Split) {
  if (!S.voice || !('speechSynthesis' in window)) return;
  const u = S.units === 'km' ? 'kilometre' : 'mile';
  const m = Math.floor(sp.pace / 60), s = Math.round(sp.pace % 60);
  const txt = u.charAt(0).toUpperCase() + u.slice(1) + ' ' + sp.n + '. '
    + 'Total time ' + speakDur(T.movingMs / 1000) + '. '
    + 'Split pace ' + m + ' minute' + (m === 1 ? '' : 's') + (s ? ' ' + s + ' seconds' : '') + ' per ' + u + '.';
  try { const utt = new SpeechSynthesisUtterance(txt); utt.rate = 1.02; speechSynthesis.speak(utt); } catch { /* no voice */ }
}

/* ---- rolling "current" pace: last ~30 s of moving time ---- */
export function currentPace(): number {
  const p = T.points; if (p.length < 2) return NaN;
  const now = p[p.length - 1];
  const WIN = 30000;
  let i = p.length - 1;
  while (i > 0 && now.m - p[i].m < WIN) i--;
  const dd = now.d - p[i].d, dm = now.m - p[i].m;
  if (dd < 15 || dm <= 0) return NaN;
  return (dm / 1000) / (dd / M_PER_UNIT());
}

/* ---- master tick ---- */
let tickTimer: ReturnType<typeof setInterval> | null = null;
function tick() {
  const now = Date.now();
  if (T.state === 'running') {
    const dt = now - T.tickAnchor;
    T.tickAnchor = now;
    if (S.autoPause && T.lastMoveTs && now - T.lastMoveTs > IDLE_MS) {
      if (!T.autoPaused) T.autoPaused = true;
    }
    if (!T.autoPaused) T.movingMs += dt;
  }
  tEmit();
}
export function startTicking() {
  if (!tickTimer) tickTimer = setInterval(tick, 250);
}

/* ---- wake lock ---- */
async function acquireWake() {
  if (!S.keepAwake || !('wakeLock' in navigator)) return;
  try { T.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* denied */ }
}
function releaseWake() {
  try { T.wakeLock?.release(); } catch { /* already gone */ }
  T.wakeLock = null;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && T.state === 'running' && !T.wakeLock) acquireWake();
  });
}

/* ---- transitions ---- */
export function startRun() {
  resetTracker();
  T.state = 'running'; T.startedAt = Date.now(); T.tickAnchor = Date.now(); T.lastMoveTs = Date.now();
  T.nextSplit = M_PER_UNIT();
  mapHooks.onReset?.();
  initLive(data.segments, data.efforts);
  startWatch(); acquireWake(); tEmit();
  if (S.voice && 'speechSynthesis' in window) {
    try { speechSynthesis.speak(new SpeechSynthesisUtterance('Run started. Go.')); } catch { /* no voice */ }
  }
}
export function pauseRun() {
  if (T.state !== 'running') return;
  T.state = 'paused'; releaseWake(); persistActive(); tEmit();
}
export function resumeRun() {
  if (T.state !== 'paused') return;
  T.state = 'running'; T.tickAnchor = Date.now(); T.lastMoveTs = Date.now(); T.autoPaused = false;
  acquireWake(); tEmit();
}

function autoName(ts: number): string {
  const h = new Date(ts).getHours();
  return (h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night') + ' Run';
}

export async function finishRun() {
  if (T.state === 'idle') return;
  const sec = T.movingMs / 1000;
  releaseWake();
  if (T.dist < 50 || sec < 20) {
    T.state = 'idle'; await DB.del('active', 1); resetTracker(); resetLive(); mapHooks.onReset?.(); tEmit();
    toast('Run discarded — too short to save'); return;
  }
  const run: Run = {
    id: T.startedAt, startedAt: T.startedAt, endedAt: Date.now(),
    dist: Math.round(T.dist), movingSec: Math.round(sec),
    elapsedSec: Math.round((Date.now() - T.startedAt) / 1000),
    points: T.points.map(p => ({
      lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), t: p.t,
      d: Math.round(p.d), m: Math.round(p.m),
      alt: (p.alt == null ? null : Math.round(p.alt * 10) / 10),
    })),
    splits: T.splits.map(s => ({ n: s.n, dur: Math.round(s.dur * 10) / 10, pace: Math.round(s.pace * 10) / 10 })),
    elevGain: Math.round(T.elevGain), elevLoss: Math.round(T.elevLoss),
    unit: S.units, name: autoName(T.startedAt),
    shoeId: S.defaultShoeId ?? null,
  };
  const partial = (T.dist % M_PER_UNIT()) / M_PER_UNIT();
  run.partialSplit = partial > 0.05 ? { frac: partial, dur: (T.movingMs - T.lastSplitM) / 1000 } : null;
  await DB.del('active', 1);
  T.state = 'idle'; resetTracker(); resetLive(); mapHooks.onReset?.(); tEmit();
  await saveRun(run);
  onFinished?.(run);
  if (S.voice && 'speechSynthesis' in window) {
    try {
      speechSynthesis.speak(new SpeechSynthesisUtterance(
        'Run complete. ' + fmtDist(run.dist) + ' ' + UNIT() + ' in ' + speakDur(run.movingSec) + '.'));
    } catch { /* no voice */ }
  }
}

/* ---- crash recovery ---- */
interface ActiveSnapshot {
  id: number; startedAt: number; dist: number; movingMs: number;
  points: Pt[]; splits: Split[]; elevGain: number; elevLoss: number;
  nextSplit: number; lastSplitM: number; savedAt: number;
}
export async function persistActive() {
  if (T.state === 'idle' || !T.points.length) return;
  try {
    const snap: ActiveSnapshot = {
      id: 1, startedAt: T.startedAt, dist: T.dist, movingMs: T.movingMs,
      points: T.points, splits: T.splits, elevGain: T.elevGain, elevLoss: T.elevLoss,
      nextSplit: T.nextSplit, lastSplitM: T.lastSplitM, savedAt: Date.now(),
    };
    await DB.put('active', snap);
  } catch { /* best effort */ }
}

export async function tryRestore(): Promise<boolean> {
  try {
    const a = await DB.get<ActiveSnapshot>('active', 1);
    if (a && a.points && a.points.length > 5 && Date.now() - a.savedAt < 12 * 3600e3) {
      if (confirm('Stride found an unfinished run (' + (a.dist / M_PER_UNIT()).toFixed(2) + ' ' + UNIT() + '). Restore it?')) {
        Object.assign(T, {
          state: 'paused', points: a.points, dist: a.dist, movingMs: a.movingMs,
          startedAt: a.startedAt, splits: a.splits, elevGain: a.elevGain, elevLoss: a.elevLoss,
          nextSplit: a.nextSplit, lastSplitM: a.lastSplitM, lastMoveTs: Date.now(), tickAnchor: Date.now(),
        });
        mapHooks.onReset?.();
        a.points.forEach(p => mapHooks.onPoint?.(p));
        tEmit();
        return true;
      } else await DB.del('active', 1);
    }
  } catch { /* fresh start */ }
  return false;
}

export function initTracker() {
  startTicking();
  setInterval(persistActive, 10000);
  window.addEventListener('beforeunload', e => {
    if (T.state !== 'idle') { persistActive(); e.preventDefault(); }
  });
}
