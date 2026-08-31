import { useEffect, useRef } from 'react';
import { S, UNIT, PACE_UNIT, M_PER_UNIT } from '../lib/settings';
import { fmtDur, fmtPace, fmtDist, dayKey, startOfWeek } from '../lib/format';
import { allTimePBs, computeStreak } from '../lib/analytics';
import { fitnessSeries } from '../lib/fitness';
import { data, useStore } from '../store';
import { IcoGear } from './icons';

function Ring({ pct }: { pct: number }) {
  const R = 48, C = 2 * Math.PI * R;
  const ref = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.style.strokeDashoffset = String(C);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      c.style.strokeDashoffset = String(C * (1 - pct));
    }));
    return () => cancelAnimationFrame(id);
  }, [pct, C]);
  return (
    <div className="ring">
      <svg width="112" height="112">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8FD11E" /><stop offset="1" stopColor="#DDFF7A" />
          </linearGradient>
          <filter id="ringGlow" x="-45%" y="-45%" width="190%" height="190%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#C6FF3D" floodOpacity=".45" />
          </filter>
        </defs>
        <circle cx="56" cy="56" r={R} stroke="#19212B" strokeWidth="11" fill="none" />
        <circle ref={ref} className="prog" cx="56" cy="56" r={R} stroke="url(#ringGrad)" strokeWidth="11"
          fill="none" strokeLinecap="round" filter={pct > 0.02 ? 'url(#ringGlow)' : undefined}
          strokeDasharray={C.toFixed(1)} strokeDashoffset={C.toFixed(1)} />
      </svg>
      <div className="mid"><div><b className="num">{Math.round(pct * 100)}%</b><span>WEEK GOAL</span></div></div>
    </div>
  );
}

function ConsistencyCal() {
  const byDay: Record<string, number> = {};
  data.runs.forEach(r => { const k = dayKey(r.startedAt); byDay[k] = (byDay[k] || 0) + r.dist; });
  const todayK = dayKey(Date.now());
  const todayIdx = (new Date().getDay() + 6) % 7;
  const start = startOfWeek(Date.now()) - 7 * 7 * 864e5 + 432e5;   // noon Monday, 7 weeks back
  const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dots: React.ReactNode[] = [];
  for (let t = start, n = 0; n < 7 * 7 + todayIdx + 1; t += 864e5, n++) {
    const k = dayKey(t), d = byDay[k] || 0;
    const lvl = !d ? '' : d < 3000 ? ' l1' : d < 7000 ? ' l2' : ' l3';
    dots.push(<div key={k} className={'dot' + lvl + (k === todayK ? ' today' : '')} />);
  }
  for (let i = todayIdx + 1; i < 7; i++) dots.push(<div key={'f' + i} className="dot future" />);
  return (
    <div className="cal">
      {DL.map((d, i) => <span className="dw" key={'h' + i}>{d}</span>)}
      {dots}
    </div>
  );
}

function WeeklyChart() {
  const now = Date.now(), weeks: { s: number; d: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const s = startOfWeek(now - i * 7 * 864e5), e = s + 7 * 864e5;
    const d = data.runs.filter(r => r.startedAt >= s && r.startedAt < e).reduce((a, r) => a + r.dist, 0);
    weeks.push({ s, d });
  }
  const max = Math.max(M_PER_UNIT(), S.weeklyGoal * M_PER_UNIT() * .55, ...weeks.map(w => w.d));
  const goalY = Math.min(1, (S.weeklyGoal * M_PER_UNIT()) / max);
  const W = 320, H = 118, TOP = 16, BASE = H - 13;
  const maxIdx = weeks.reduce((bi, w, i) => w.d > weeks[bi].d ? i : bi, 0);
  const gy = (BASE - goalY * (BASE - TOP)).toFixed(1);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 118, display: 'block' }}>
        <defs>
          <linearGradient id="wkNow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#DDFF7A" /><stop offset="1" stopColor="#8FD11E" />
          </linearGradient>
        </defs>
        {[.25, .5, .75].map(f => {
          const y = (BASE - f * (BASE - TOP)).toFixed(1);
          return <line key={f} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,.045)" strokeWidth="1" />;
        })}
        <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
        <line x1="0" y1={gy} x2={W} y2={gy} stroke="#FF5A36" strokeWidth="1" strokeDasharray="4 4" opacity=".65" />
        {weeks.map((w, i) => {
          const bw = W / 12 * 0.6, x = i * (W / 12) + (W / 12 - bw) / 2;
          const bh = Math.max(2.5, w.d / max * (BASE - TOP));
          return (
            <g key={w.s}>
              <rect x={x.toFixed(1)} y={(BASE - bh).toFixed(1)} width={bw.toFixed(1)} height={bh.toFixed(1)}
                rx="4" fill={i === 11 ? 'url(#wkNow)' : 'rgba(198,255,61,.3)'} />
              {i === maxIdx && w.d > 0 && (
                <text x={(x + bw / 2).toFixed(1)} y={(BASE - bh - 5).toFixed(1)} textAnchor="middle" fill="#8494A5"
                  fontFamily="Barlow Condensed" fontWeight="700" fontSize="10">{fmtDist(w.d, 1)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
        <span>12 wks ago</span>
        <span style={{ color: 'var(--ember)' }}>— goal {S.weeklyGoal} {UNIT()}</span>
        <span>this week</span>
      </div>
    </>
  );
}

/* Fitness & Freshness — premium-style CTL/ATL/form chart */
function FitnessChart() {
  const series = fitnessSeries(data.runs, 90);
  if (series.length < 14) return null;
  const W = 320, H = 130, PAD = 10, BASE = H - 16;
  const hi = Math.max(...series.map(s => Math.max(s.fitness, s.fatigue)), 1);
  const x = (i: number) => PAD + i / (series.length - 1) * (W - PAD * 2);
  const y = (v: number) => BASE - v / hi * (BASE - 14);
  const line = (get: (s: typeof series[0]) => number) =>
    series.map((s, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(get(s)).toFixed(1)).join('');
  const fitD = line(s => s.fitness), fatD = line(s => s.fatigue);
  const last = series[series.length - 1];
  const formCol = last.form >= 0 ? 'var(--lime)' : 'var(--ember)';
  return (
    <>
      <div className="sec-title">Fitness &amp; freshness<span className="meta">last 90 days</span></div>
      <div className="card">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 130, display: 'block' }}>
          <path d={fitD + `L${x(series.length - 1).toFixed(1)} ${BASE}L${PAD} ${BASE}Z`} fill="rgba(198,255,61,.09)" />
          <path d={fitD} fill="none" stroke="#C6FF3D" strokeWidth="2" strokeLinejoin="round" />
          <path d={fatD} fill="none" stroke="#FF5A36" strokeWidth="1.5" strokeLinejoin="round" opacity=".8" strokeDasharray="5 3" />
        </svg>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
          <span><b style={{ color: 'var(--lime)' }}>—</b> Fitness {last.fitness.toFixed(1)}</span>
          <span><b style={{ color: 'var(--ember)' }}>--</b> Fatigue {last.fatigue.toFixed(1)}</span>
          <span style={{ marginLeft: 'auto' }}>Form <b className="num" style={{ color: formCol, fontSize: 14 }}>
            {(last.form >= 0 ? '+' : '') + last.form.toFixed(1)}</b></span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 7, lineHeight: 1.5 }}>
          Fitness is your 42-day training load; fatigue the 7-day. Positive form means you're fresh — prime for a hard effort.
        </div>
      </div>
    </>
  );
}

/* Race predictor — Riegel's formula off your best efforts */
function RacePredictor() {
  const pb = allTimePBs(data.runs);
  const base = pb.k5 || pb.k10 || pb.k1;
  const baseDist = pb.k5 ? 5000 : pb.k10 ? 10000 : 1000;
  if (!base || data.runs.length < 3) return null;
  const predict = (d: number) => base.v * Math.pow(d / baseDist, 1.06);
  const rows: [string, number][] = [['5K', 5000], ['10K', 10000], ['Half marathon', 21097.5], ['Marathon', 42195]];
  return (
    <>
      <div className="sec-title">Race predictor<span className="meta">Riegel, from your best {baseDist / 1000}K</span></div>
      <div className="card">
        {rows.map(([label, d]) => (
          <div className="pb-row" key={label}>
            <span className="lbl" style={{ width: 110 }}>{label}</span>
            <span className="when">{fmtPace(predict(d) / (d / M_PER_UNIT()))}{PACE_UNIT()}</span>
            <span className="val num">{fmtDur(predict(d))}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>
          Estimates assume you'd train for the distance — treat the marathon line as a stretch goal.
        </div>
      </div>
    </>
  );
}

export default function ProgressScreen({ active, onSettings, onHeatmap }: {
  active: boolean; onSettings: () => void; onHeatmap: () => void;
}) {
  useStore();
  const runs = data.runs;
  const now = Date.now(), wk = startOfWeek(now);
  const weekRuns = runs.filter(r => r.startedAt >= wk);
  const weekDist = weekRuns.reduce((a, r) => a + r.dist, 0);
  const goalM = S.weeklyGoal * M_PER_UNIT();
  const pct = Math.min(1, weekDist / goalM);
  const streak = computeStreak(runs, dayKey);
  const mStart = new Date(); mStart.setDate(1); mStart.setHours(0, 0, 0, 0);
  const monthRuns = runs.filter(r => r.startedAt >= mStart.getTime());
  const total = runs.reduce((a, r) => a + r.dist, 0);
  const totalSec = runs.reduce((a, r) => a + r.movingSec, 0);
  const pb = allTimePBs(runs);

  const pbLine = (label: string, obj: { v: number; run: { startedAt: number } } | null, fmt: (v: number) => string) =>
    obj ? (
      <div className="pb-row" key={label}>
        <span className="lbl">{label}</span>
        <span className="when">{new Date(obj.run.startedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })}</span>
        <span className="val num">{fmt(obj.v)}</span>
      </div>
    ) : (
      <div className="pb-row" key={label}>
        <span className="lbl">{label}</span><span className="when">not set yet</span>
        <span className="val num" style={{ color: 'var(--dim)' }}>—</span>
      </div>
    );

  return (
    <section className={'view' + (active ? ' active' : '')}>
      <div className="topbar">
        <h1>Progress</h1><div className="spacer" />
        <button className="iconbtn" onClick={onSettings} aria-label="Settings"><IcoGear /></button>
      </div>
      <div className="scroll">
        {!runs.length ? (
          <div className="empty">
            <div className="big">📈</div>
            <p><b>Nothing to chart yet.</b><br />Your goal ring, streak and personal bests appear here after your first run.</p>
          </div>
        ) : (
          <>
            <div className="card goal">
              <Ring pct={pct} />
              <div style={{ flex: 1 }}>
                <div className="big num">{fmtDist(weekDist, 1)} <span>/ {S.weeklyGoal} {UNIT()}</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  {weekRuns.length} run{weekRuns.length === 1 ? '' : 's'} this week
                </div>
                <div style={{ fontSize: 12, color: pct >= 1 ? 'var(--lime)' : 'var(--dim)', marginTop: 7, fontWeight: 800, letterSpacing: '.02em' }}>
                  {pct >= 1 ? '✓ Goal smashed' : fmtDist(goalM - weekDist, 1) + ' ' + UNIT() + ' to go'}
                </div>
              </div>
            </div>

            <div className="sec-title">At a glance</div>
            <div className="stat-grid">
              <div className="stat streak">
                <div className="k">Streak</div>
                <div className="v num">{streak}<small> day{streak === 1 ? '' : 's'}</small></div>
                <div className="sub">{streak ? 'Keep it alive 🔥' : 'Run today to start one'}</div>
              </div>
              <div className="stat">
                <div className="k">This month</div>
                <div className="v num">{fmtDist(monthRuns.reduce((a, r) => a + r.dist, 0), 1)}<small> {UNIT()}</small></div>
                <div className="sub">{monthRuns.length} runs</div>
              </div>
              <div className="stat">
                <div className="k">All time</div>
                <div className="v num">{fmtDist(total, 1)}<small> {UNIT()}</small></div>
                <div className="sub">{runs.length} runs</div>
              </div>
              <div className="stat">
                <div className="k">Time on feet</div>
                <div className="v num">{Math.floor(totalSec / 3600)}<small>h {Math.floor(totalSec % 3600 / 60)}m</small></div>
                <div className="sub">total moving</div>
              </div>
            </div>

            <FitnessChart />

            <div className="sec-title">Consistency<span className="meta">last 8 weeks</span></div>
            <div className="card">
              <ConsistencyCal />
              <div className="cal-leg"><span>Less</span><i /><i className="l1" /><i className="l2" /><i className="l3" /><span>More</span></div>
            </div>

            <button className="ghostbtn" onClick={onHeatmap}>🔥 Your personal heatmap</button>

            <div className="sec-title">Personal bests</div>
            <div className="card">
              {pbLine('1 km', pb.k1, fmtDur)}
              {pbLine('5 km', pb.k5, fmtDur)}
              {pbLine('10 km', pb.k10, fmtDur)}
              {pb.long && pbLine('Longest', pb.long, v => fmtDist(v, 2) + ' ' + UNIT())}
              {pb.fast && pbLine('Best pace', pb.fast, v => fmtPace(v * (M_PER_UNIT() / 1000)) + PACE_UNIT())}
            </div>

            <RacePredictor />

            <div className="sec-title">Last 12 weeks</div>
            <div className="card"><WeeklyChart /></div>
            <div style={{ height: 20 }} />
          </>
        )}
      </div>
    </section>
  );
}
