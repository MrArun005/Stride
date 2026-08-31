import type { Pt, Segment, Effort } from './types';
import { buildSegIndex, projectNear, SEG_TOL, SEG_OFF, type SegIndex } from './segments';
import { S } from './settings';
import { fmtDur } from './format';

/* Live Segments — race a ghost of your PR in real time.
   Each known segment keeps a tiny state machine fed by accepted GPS points:
   idle → (near the start line) → racing → finished/abandoned.
   The PR comparison at progress f is elapsed − PR·f: negative = ahead. */

interface LiveState {
  seg: Segment; idx: SegIndex; pr: number | null;
  racing: boolean; curS: number; startM: number; offD: number; lastD: number;
}

export interface LiveCurrent {
  name: string; frac: number; elapsed: number; delta: number | null; pr: number | null;
}
export interface LiveResult {
  name: string; dur: number; delta: number | null; at: number;
}

export const LIVE = {
  states: [] as LiveState[],
  current: null as LiveCurrent | null,
  lastResult: null as LiveResult | null,
};

export function initLive(segments: Segment[], efforts: Effort[]) {
  LIVE.states = segments.map(seg => {
    const prs = efforts.filter(e => e.segId === seg.id).map(e => e.dur).sort((a, b) => a - b);
    return {
      seg, idx: buildSegIndex(seg.points), pr: prs[0] ?? null,
      racing: false, curS: 0, startM: 0, offD: 0, lastD: 0,
    };
  });
  LIVE.current = null;
  LIVE.lastResult = null;
}

export function resetLive() {
  LIVE.states = []; LIVE.current = null; LIVE.lastResult = null;
}

function say(txt: string) {
  if (!S.voice || !('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(txt); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* no voice */ }
}

export function liveOnPoint(p: Pt) {
  let best: LiveCurrent | null = null;
  for (const st of LIVE.states) {
    const L = st.idx.length;
    const xy = st.idx.to(p);
    if (!st.racing) {
      const entryWin = Math.min(60, L * 0.12);
      const e0 = projectNear(st.idx, xy.x, xy.y, 0, entryWin);
      if (e0.perp <= SEG_TOL) {
        st.racing = true; st.curS = e0.s; st.startM = p.m; st.offD = 0; st.lastD = p.d;
        say(st.pr
          ? 'Segment. ' + st.seg.name + '. Your record is ' + fmtDur(st.pr).replace(':', ' ') + '. Go.'
          : 'Segment. ' + st.seg.name + '. Go.');
      }
    } else {
      const pr = projectNear(st.idx, xy.x, xy.y, st.curS - 25, st.curS + 200);
      if (pr.perp > SEG_TOL) {
        st.offD += Math.max(0, p.d - st.lastD);
        if (st.offD > SEG_OFF) st.racing = false;    // wandered off — abandon quietly
      } else {
        st.offD = 0;
        if (pr.s > st.curS) st.curS = pr.s;
        const endTol = Math.min(40, L * 0.06);
        if (st.curS >= L - endTol) {
          const dur = (p.m - st.startM) / 1000;
          const delta = st.pr != null ? dur - st.pr : null;
          LIVE.lastResult = { name: st.seg.name, dur, delta, at: Date.now() };
          st.racing = false;
          say(delta == null
            ? 'Segment complete. ' + fmtDur(dur).replace(':', ' ') + '.'
            : delta <= 0
              ? 'Segment complete. New record. ' + Math.round(-delta) + ' seconds faster.'
              : 'Segment complete. ' + Math.round(delta) + ' seconds off your record.');
        }
      }
    }
    st.lastD = p.d;
    if (st.racing) {
      const frac = Math.min(1, st.curS / L);
      const elapsed = (p.m - st.startM) / 1000;
      const cand: LiveCurrent = {
        name: st.seg.name, frac, elapsed,
        delta: st.pr != null ? elapsed - st.pr * frac : null, pr: st.pr,
      };
      if (!best || cand.frac > best.frac) best = cand;
    }
  }
  LIVE.current = best;
}
