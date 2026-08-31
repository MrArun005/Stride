import type { Run } from './types';
import { dayKey } from './format';

/* Fitness & Freshness — the classic impulse-response training-load model
   (CTL/ATL/TSB, as popularised by Strava's premium chart).
   Without heart rate, daily load = km run, weighted slightly by intensity
   (pace vs the athlete's median pace). Fitness is a 42-day exponentially
   weighted average of load, fatigue a 7-day one, form the difference. */

export interface FitnessDay { t: number; fitness: number; fatigue: number; form: number; load: number }

const CTL_TC = 42, ATL_TC = 7;

export function fitnessSeries(runs: Run[], days = 90): FitnessDay[] {
  if (!runs.length) return [];
  const paces = runs.map(r => r.movingSec / (r.dist / 1000)).sort((a, b) => a - b);
  const median = paces[Math.floor(paces.length / 2)];

  const loadByDay = new Map<string, number>();
  runs.forEach(r => {
    const km = r.dist / 1000;
    const pace = r.movingSec / km;
    const intensity = Math.max(.7, Math.min(1.5, median / pace));   // faster than usual = harder
    const k = dayKey(r.startedAt);
    loadByDay.set(k, (loadByDay.get(k) || 0) + km * intensity);
  });

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const first = Math.min(...runs.map(r => r.startedAt));
  const start = Math.max(first, today.getTime() - days * 864e5);
  // warm up the averages from the very first run so the window start isn't a cliff
  let ctl = 0, atl = 0;
  const out: FitnessDay[] = [];
  for (let t = first; t <= today.getTime() + 1; t += 864e5) {
    const load = loadByDay.get(dayKey(t)) || 0;
    ctl += (load - ctl) / CTL_TC;
    atl += (load - atl) / ATL_TC;
    if (t >= start) out.push({ t, fitness: ctl, fatigue: atl, form: ctl - atl, load });
  }
  return out;
}
