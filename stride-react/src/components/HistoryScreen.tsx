import { UNIT, PACE_UNIT, M_PER_UNIT } from '../lib/settings';
import { fmtDur, fmtPace, fmtDist, relDate, startOfWeek } from '../lib/format';
import { allTimePBs, achFor } from '../lib/analytics';
import type { Run } from '../lib/types';
import { data, useStore } from '../store';
import RouteThumb from './RouteThumb';
import { IcoAward } from './icons';

function WeekSnapshot() {
  const wk = startOfWeek(Date.now());
  const days = [0, 0, 0, 0, 0, 0, 0];
  let dist = 0, sec = 0, n = 0;
  data.runs.forEach(r => {
    if (r.startedAt < wk) return;
    dist += r.dist; sec += r.movingSec; n++;
    days[(new Date(r.startedAt).getDay() + 6) % 7] += r.dist;
  });
  const max = Math.max(...days, 1);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="card wk-snap">
      <div>
        <div className="k">This week</div>
        <div className="v num">{fmtDist(dist, 1)}<small> {UNIT()}</small></div>
        <div className="sub">{n} run{n === 1 ? '' : 's'} · {fmtDur(sec)}</div>
      </div>
      <div className="wk-bars">
        {days.map((d, i) => (
          <div key={i} className={'col' + (i === todayIdx ? ' today' : '')}>
            {d ? <div className="bar" style={{ height: Math.max(6, d / max * 48) + 'px' }} />
              : <div className="bar zero" />}
            <span className="d">{DL[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoryScreen({ active, onOpen }: { active: boolean; onOpen: (r: Run) => void }) {
  useStore();
  const runs = data.runs;
  const pb = allTimePBs(runs);
  const monthOf = (ts: number) => new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const monthTotals: Record<string, number> = {};
  runs.forEach(r => { const k = monthOf(r.startedAt); monthTotals[k] = (monthTotals[k] || 0) + r.dist; });

  let lastMonth = '';
  const rows: React.ReactNode[] = [];
  runs.forEach((r, ix) => {
    const mon = monthOf(r.startedAt);
    if (mon !== lastMonth) {
      rows.push(
        <div className="sec-title" key={'m' + mon}>
          {mon}<span className="meta num">{fmtDist(monthTotals[mon], 1)} {UNIT()}</span>
        </div>
      );
      lastMonth = mon;
    }
    const pace = r.movingSec / (r.dist / M_PER_UNIT());
    const ach = achFor(r, pb, runs.length);
    const delay = { animationDelay: Math.min(ix, 11) * 38 + 'ms' };
    if (ix === 0) {
      rows.push(
        <div className="run-card big stagger" style={delay} key={r.id} onClick={() => onOpen(r)}>
          <div className="bigmap">
            <RouteThumb points={r.points} w={360} h={158} pad={24} sw={2.6} glow ends />
            <span className="flag">Latest run</span>
            <div className="cap">
              <div className="d">{relDate(r.startedAt)}</div>
              <div className="nm">{r.name}</div>
            </div>
          </div>
          <div className="stats">
            <div><span className="k">Distance</span><b>{fmtDist(r.dist)}<small>{UNIT()}</small></b></div>
            <div><span className="k">Time</span><b>{fmtDur(r.movingSec)}</b></div>
            <div><span className="k">Pace</span><b>{fmtPace(pace)}<small>{PACE_UNIT()}</small></b></div>
          </div>
          {ach.length > 0 && (
            <div className="achrow">
              {ach.map(a => <span className="ach" key={a}><IcoAward />{a}</span>)}
            </div>
          )}
        </div>
      );
      return;
    }
    rows.push(
      <div className="run-card stagger" style={delay} key={r.id} onClick={() => onOpen(r)}>
        <div className="thumb"><RouteThumb points={r.points} w={66} h={66} /></div>
        <div className="run-meta">
          <div className="d">{relDate(r.startedAt)}</div>
          <div className="t num">{fmtDist(r.dist)}<small>{UNIT()}</small></div>
          <div className="s num">
            <span>{fmtDur(r.movingSec)}</span>
            <span>{fmtPace(pace)}{PACE_UNIT()}</span>
            {r.elevGain ? <span>↑{r.elevGain}m</span> : null}
            {r.shoeId && data.shoes.find(s => s.id === r.shoeId)
              ? <span style={{ color: 'var(--dim)' }}>{data.shoes.find(s => s.id === r.shoeId)!.name}</span> : null}
          </div>
        </div>
        {ach.length > 0 && <div className="mini-ach"><IcoAward /><b>{ach.length}</b></div>}
      </div>
    );
  });

  return (
    <section className={'view' + (active ? ' active' : '')}>
      <div className="topbar">
        <h1>History</h1><div className="spacer" />
        <div className="gps">{runs.length} {runs.length === 1 ? 'run' : 'runs'}</div>
      </div>
      <div className="scroll">
        {!runs.length ? (
          <div className="empty">
            <div className="big">🏃</div>
            <p><b>No runs yet.</b><br />Hit <b>Start Run</b> on the Run tab and Stride will record your route, splits and pace.</p>
          </div>
        ) : (<><WeekSnapshot />{rows}</>)}
      </div>
    </section>
  );
}
