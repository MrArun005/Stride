import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { UNIT, PACE_UNIT, M_PER_UNIT } from '../../lib/settings';
import { fmtDur, fmtPace, fmtDist } from '../../lib/format';
import { addTiles } from '../../lib/tiles';
import { interpAt } from '../../lib/analytics';
import { sliceRunByDistance, SEG_MIN } from '../../lib/segments';
import type { Run, Segment } from '../../lib/types';
import { data, saveSegment, toast } from '../../store';
import { IcoClose } from '../icons';

function suggestName() {
  const n = data.segments.length + 1;
  const h = new Date().getHours();
  return (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening') + ' segment ' + n;
}

export default function SegmentMakerSheet({ run, open, onClose, onSaved }: {
  run: Run | null; open: boolean; onClose: () => void; onSaved: (seg: Segment) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [a, setA] = useState(0.15);
  const [b, setB] = useState(0.55);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setA(0.15); setB(0.55); setName(suggestName()); setSaving(false); }
  }, [open, run]);

  /* map redraw on slider change */
  useEffect(() => {
    if (!open || !run || !mapEl.current) return;
    const t = setTimeout(() => {
      const fresh = !mapRef.current;
      if (fresh) {
        mapRef.current = L.map(mapEl.current!, { zoomControl: false, renderer: L.canvas({ padding: .5 }) });
        addTiles(mapRef.current, mapEl.current);
      }
      const m = mapRef.current!;
      layersRef.current.forEach(l => m.removeLayer(l));
      const all = run.points.map(p => [p.lat, p.lng] as [number, number]);
      const base = L.polyline(all, { color: '#39434F', weight: 4, opacity: .85, lineJoin: 'round' }).addTo(m);
      const sel = sliceRunByDistance(run, a * run.dist, b * run.dist).map(p => [p.lat, p.lng] as [number, number]);
      const layers: L.Layer[] = [base];
      if (sel.length > 1) {
        layers.push(L.polyline(sel, { color: '#FFC53D', weight: 6.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(m));
        layers.push(L.circleMarker(sel[0], { radius: 6, color: '#0B0D10', weight: 2.5, fillColor: '#4DA3FF', fillOpacity: 1 }).addTo(m));
        layers.push(L.circleMarker(sel[sel.length - 1], { radius: 6, color: '#0B0D10', weight: 2.5, fillColor: '#FF5A36', fillOpacity: 1 }).addTo(m));
      }
      layersRef.current = layers;
      m.invalidateSize();
      if (fresh) m.fitBounds(base.getBounds(), { padding: [24, 24] });
    }, open ? 320 : 0);
    return () => clearTimeout(t);
  }, [open, run, a, b]);

  if (!run) return <div className={'sheet' + (open ? ' open' : '')} style={{ zIndex: 940 }} />;

  const d0 = a * run.dist, d1 = b * run.dist;
  const len = d1 - d0;
  const time = (interpAt(run.points, d1) - interpAt(run.points, d0)) / 1000;
  const tooShort = len < SEG_MIN;

  const onA = (v: number) => { const x = v / 1000; setA(Math.min(x, b - 0.04) < x ? Math.max(0, b - 0.04) : x); };
  const onB = (v: number) => { const x = v / 1000; setB(Math.max(x, a + 0.04) > x ? Math.min(1, a + 0.04) : x); };

  const save = async () => {
    const pts = sliceRunByDistance(run, d0, d1);
    if (pts.length < 4 || tooShort) { toast('Segment too short'); return; }
    setSaving(true);
    const sg: Segment = {
      id: Date.now(), name: (name || suggestName()).slice(0, 60),
      points: pts.map(p => ({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) })),
      length: Math.round(len), createdAt: Date.now(), fromRunId: run.id,
    };
    const n = await saveSegment(sg);
    toast(n ? 'Segment saved — ' + n + ' effort' + (n === 1 ? '' : 's') + ' found' : 'Segment saved');
    onSaved(sg);
  };

  return (
    <div className={'sheet' + (open ? ' open' : '')} style={{ zIndex: 940 }}>
      <div className="sheet-head">
        <button className="iconbtn" onClick={onClose}><IcoClose /></button>
        <h2>New segment</h2>
      </div>
      <div id="makeMap" ref={mapEl} style={{ height: 220, flex: 'none' }} />
      <div className="scroll" style={{ paddingTop: 16 }}>
        <div className="card">
          <div className="rangewrap">
            <label>Start<b>{fmtDist(d0)} {UNIT()}</b></label>
            <input type="range" min="0" max="1000" value={a * 1000} onChange={e => onA(+e.target.value)} />
            <label style={{ marginTop: 6 }}>End<b>{fmtDist(d1)} {UNIT()}</b></label>
            <input type="range" min="0" max="1000" value={b * 1000} onChange={e => onB(+e.target.value)} />
          </div>
        </div>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat"><div className="k">Segment length</div>
            <div className="v num">{fmtDist(len)}<small> {UNIT()}</small></div></div>
          <div className="stat"><div className="k">Your time here</div>
            <div className="v num">{fmtDur(time)}<small> · {fmtPace(time / (len / M_PER_UNIT()))}{PACE_UNIT()}</small></div></div>
        </div>
        <div className="sec-title">Name</div>
        <input className="namein" placeholder="e.g. Cubbon Park loop" value={name} onChange={e => setName(e.target.value)} />
        <button className="bigbtn" disabled={tooShort || saving} onClick={save}>
          {saving ? 'Scanning your runs…' : tooShort ? 'Too short (min ' + SEG_MIN + ' m)' : 'Save segment'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--dim)', padding: '14px 2px', lineHeight: 1.6 }}>
          Stride will scan every run you have recorded and log an effort each time you covered this stretch, then rank them.
        </div>
      </div>
    </div>
  );
}
