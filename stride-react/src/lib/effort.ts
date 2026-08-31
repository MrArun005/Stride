import type { Run } from './types';
import { interpAt } from './analytics';
import { startOfWeek } from './format';

/* Relative Effort — Strava scores an activity by time-in-HR-zones; without HR we
   score duration weighted by intensity² (pace vs your median pace), which tracks
   the same "how hard was that really" intuition. ~60 min easy ≈ 35, hard ≈ 80+. */
export function relativeEffort(run: Run, runs: Run[]): number {
  const min = run.movingSec / 60;
  const myPace = run.movingSec / (run.dist / 1000);
  const paces = runs.filter(r => r.dist > 800).map(r => r.movingSec / (r.dist / 1000)).sort((a, b) => a - b);
  const median = paces.length ? paces[Math.floor(paces.length / 2)] : myPace;
  const intensity = Math.max(.6, Math.min(1.6, median / myPace));
  return Math.max(1, Math.round(min * Math.pow(intensity, 2.2) * 0.58));
}

export function effortLabel(score: number, run: Run, runs: Run[]): string {
  const history = runs.filter(r => r.id !== run.id).map(r => relativeEffort(r, runs)).sort((a, b) => a - b);
  if (history.length < 3) return '';
  if (score >= history[history.length - 1]) return 'Historic effort — your biggest yet';
  if (score >= history[Math.floor(history.length * .8)]) return 'Massive effort';
  if (score >= history[Math.floor(history.length * .4)]) return 'Tougher than usual';
  return 'Easier than usual';
}

/* Athlete-Intelligence-style insights — honest rules, no model, no cloud. */
export function insights(run: Run, runs: Run[], unit: string, mPerUnit: number,
  fmtPaceFn: (s: number) => string, fmtDistFn: (m: number, dp?: number) => string): string[] {
  const out: string[] = [];
  const myPace = run.movingSec / (run.dist / mPerUnit);

  // vs your last 30 days (excluding this run)
  const prior = runs.filter(r => r.id !== run.id && run.startedAt - r.startedAt < 30 * 864e5 && r.startedAt < run.startedAt);
  if (prior.length >= 2) {
    const avg = prior.reduce((a, r) => a + r.movingSec / (r.dist / mPerUnit), 0) / prior.length;
    const pct = Math.round((avg - myPace) / avg * 100);
    if (Math.abs(pct) >= 3) {
      out.push(pct > 0
        ? `**${pct}% faster** than your 30-day average pace (${fmtPaceFn(avg)}/${unit}).`
        : `**${-pct}% easier** than your 30-day average pace — recovery miles count too.`);
    }
  }

  // distance rank
  const longer = runs.filter(r => r.dist > run.dist).length;
  if (runs.length >= 4 && longer < 3) {
    out.push(longer === 0 ? `Your **longest run ever**. ${fmtDistFn(run.dist)} ${unit}.`
      : `Your **${longer === 1 ? '2nd' : '3rd'} longest run** ever.`);
  }

  // negative / positive split
  const p = run.points || [];
  if (p.length > 20 && run.dist > 1500) {
    const halfM = interpAt(p, run.dist / 2);
    const first = halfM / 1000, second = run.movingSec - first;
    const diff = (first - second) / first * 100;
    if (diff > 2.5) out.push(`**Negative split** — your second half was ${Math.round(diff)}% faster. Textbook pacing.`);
    else if (diff < -8) out.push(`You went out hot — the second half was ${Math.round(-diff)}% slower. Try starting ${fmtPaceFn(myPace * 1.05)}/${unit} next time.`);
  }

  // weekly volume context
  const wk = startOfWeek(run.startedAt);
  const weekDist = runs.filter(r => r.startedAt >= wk && r.startedAt <= run.startedAt).reduce((a, r) => a + r.dist, 0);
  if (weekDist > run.dist) out.push(`This brings your week to **${fmtDistFn(weekDist, 1)} ${unit}**.`);

  // consistency
  const days = new Set(runs.filter(r => run.startedAt - r.startedAt < 7 * 864e5 && r.startedAt <= run.startedAt)
    .map(r => new Date(r.startedAt).toDateString()));
  if (days.size >= 4) out.push(`**${days.size} run days** in the last week — consistency is the whole game.`);

  return out.slice(0, 4);
}
