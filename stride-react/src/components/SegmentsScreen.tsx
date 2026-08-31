import { UNIT, PACE_UNIT, M_PER_UNIT } from '../lib/settings';
import { fmtDur, fmtPace, fmtDist } from '../lib/format';
import type { Segment } from '../lib/types';
import { data, useStore, segEfforts } from '../store';
import RouteThumb from './RouteThumb';

export default function SegmentsScreen({ active, onOpen }: { active: boolean; onOpen: (s: Segment) => void }) {
  useStore();
  const segs = data.segments;
  return (
    <section className={'view' + (active ? ' active' : '')}>
      <div className="topbar">
        <h1>Segments</h1><div className="spacer" />
        <div className="gps">{segs.length} {segs.length === 1 ? 'segment' : 'segments'}</div>
      </div>
      <div className="scroll">
        {!segs.length ? (
          <div className="empty">
            <div className="big">🏁</div>
            <p><b>No segments yet.</b><br />
              Open any run in History, scroll down and tap <b>Create segment from this run</b>.{' '}
              Stride then finds every time you have run that stretch and ranks them.</p>
          </div>
        ) : segs.map((sg, i) => {
          const eff = segEfforts(sg.id);
          const pr = eff[0];
          return (
            <div className="seg-card stagger" style={{ animationDelay: Math.min(i, 11) * 38 + 'ms' }}
              key={sg.id} onClick={() => onOpen(sg)}>
              <div className="thumb"><RouteThumb points={sg.points} w={66} h={66} /></div>
              <div className="run-meta">
                <div className="nm">{sg.name}</div>
                <div className="mt num">
                  <span>{fmtDist(sg.length)} {UNIT()}</span>
                  <span>{eff.length} effort{eff.length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt num" style={{ marginTop: 4 }}>
                  {pr ? (
                    <>
                      <span style={{ color: 'var(--lime)', fontWeight: 800 }}>PR {fmtDur(pr.dur)}</span>
                      <span>{fmtPace(pr.dur / (sg.length / M_PER_UNIT()))}{PACE_UNIT()}</span>
                    </>
                  ) : <span style={{ color: 'var(--dim)' }}>no efforts yet</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
