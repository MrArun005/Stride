import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { UNIT, PACE_UNIT, M_PER_UNIT } from '../../lib/settings';
import { fmtDur, fmtPace, fmtDist, relDate } from '../../lib/format';
import { addTiles } from '../../lib/tiles';
import type { Segment } from '../../lib/types';
import { useStore, segEfforts, deleteSegment, rankCls, toast } from '../../store';
import { IcoBack, IcoTrash } from '../icons';

function EffortTrend({ segId }: { segId: number }) {
  const eff = segEfforts(segId);
  if (eff.length < 3) return null;
  const byTime = eff.slice().sort((a, b) => a.startedAt - b.startedAt);
  const W = 320, H = 100, P = 8;
  const times = byTime.map(e => e.dur);
  const lo = Math.min(...times), hi = Math.max(...times);
  const span = Math.max(hi - lo, 2);
  let d = '';
  const dots = byTime.map((e, i) => {
    const x = P + (byTime.length === 1 ? 0.5 : i / (byTime.length - 1)) * (W - P * 2);
    const y = P + (e.dur - lo) / span * (H - P * 2);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    return <circle key={e.id} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5" fill={e.dur === lo ? '#C6FF3D' : '#8B97A6'} />;
  });
  return (
    <>
      <div className="sec-title">Effort trend</div>
      <div className="card">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 100, display: 'block' }}>
          <path d={d} fill="none" stroke="#C6FF3D" strokeWidth="2" strokeLinejoin="round" opacity=".75" />
          {dots}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
          <span>oldest</span><span>faster is lower · PR {fmtDur(lo)}</span><span>latest</span>
        </div>
      </div>
    </>
  );
}

export default function SegmentSheet({ seg, open, onClose }: {
  seg: Segment | null; open: boolean; onClose: () => void;
}) {
  useStore();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!open || !seg || !mapEl.current) return;
    const t = setTimeout(() => {
      if (!mapRef.current) {
        mapRef.current = L.map(mapEl.current!, { zoomControl: false, renderer: L.canvas({ padding: .5 }) });
        addTiles(mapRef.current, mapEl.current);
      }
      const m = mapRef.current;
      layersRef.current.forEach(l => m.removeLayer(l));
      const lls = seg.points.map(p => [p.lat, p.lng] as [number, number]);
      const line = L.polyline(lls, { color: '#FFC53D', weight: 5.5, opacity: .98, lineCap: 'round', lineJoin: 'round' }).addTo(m);
      const a = L.circleMarker(lls[0], { radius: 6, color: '#0B0D10', weight: 2.5, fillColor: '#4DA3FF', fillOpacity: 1 }).addTo(m);
      const b = L.circleMarker(lls[lls.length - 1], { radius: 6, color: '#0B0D10', weight: 2.5, fillColor: '#FF5A36', fillOpacity: 1 }).addTo(m);
      layersRef.current = [line, a, b];
      m.invalidateSize();
      m.fitBounds(line.getBounds(), { padding: [26, 26] });
    }, 320);
    return () => clearTimeout(t);
  }, [open, seg]);

  if (!seg) return <div className={'sheet' + (open ? ' open' : '')} style={{ zIndex: 920 }} />;
  const eff = segEfforts(seg.id);
  const pr = eff[0];

  return (
    <div className={'sheet' + (open ? ' open' : '')} style={{ zIndex: 920 }}>
      <div className="sheet-head">
        <button className="iconbtn" onClick={onClose}><IcoBack /></button>
        <h2>{seg.name}</h2>
        <button className="iconbtn" style={{ color: '#FF5A36' }} onClick={async () => {
          if (!confirm('Delete "' + seg.name + '" and all its efforts?')) return;
          await deleteSegment(seg); onClose(); toast('Segment deleted');
        }}><IcoTrash /></button>
      </div>
      <div id="segMap" ref={mapEl} style={{ height: 210, flex: 'none' }} />
      <div className="scroll" style={{ paddingTop: 14 }}>
        <div className="stat-grid">
          <div className="stat"><div className="k">Length</div><div className="v num">{fmtDist(seg.length)}<small> {UNIT()}</small></div></div>
          <div className="stat"><div className="k">Efforts</div><div className="v num">{eff.length}</div></div>
          <div className="stat"><div className="k">Your PR</div><div className="v num">{pr ? fmtDur(pr.dur) : '--'}</div></div>
          <div className="stat"><div className="k">PR pace</div>
            <div className="v num">{pr ? <>{fmtPace(pr.dur / (seg.length / M_PER_UNIT()))}<small> {PACE_UNIT()}</small></> : '--'}</div></div>
        </div>
        {eff.length ? (
          <>
            <div className="sec-title">Your leaderboard</div>
            <div className="card">
              {eff.map((e, i) => (
                <div className="lead-row" key={e.id}>
                  <div className={'rank' + rankCls(i)}>{i + 1}</div>
                  <div className="dt">{relDate(e.startedAt)}</div>
                  <div className="tm num">{fmtDur(e.dur)}</div>
                  <div className="dl num">{i === 0 ? 'PR' : '+' + fmtDur(e.dur - pr.dur)}</div>
                </div>
              ))}
            </div>
            <EffortTrend segId={seg.id} />
          </>
        ) : (
          <div className="card" style={{ marginTop: 16, color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            No matching efforts found yet. Run this stretch again and it will appear here automatically after you finish.
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
