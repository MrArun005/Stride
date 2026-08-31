import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { UNIT } from '../../lib/settings';
import { fmtDist } from '../../lib/format';
import { addTiles } from '../../lib/tiles';
import { data, useStore } from '../../store';
import { IcoBack } from '../icons';

/* Personal heatmap — every run you've ever recorded, layered translucent so
   repeated routes burn brighter. Strava premium's flagship visual, local-only. */
export default function HeatmapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useStore();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!open || !mapEl.current || !data.runs.length) return;
    const t = setTimeout(() => {
      if (!mapRef.current) {
        mapRef.current = L.map(mapEl.current!, { zoomControl: false, renderer: L.canvas({ padding: .5 }) });
        addTiles(mapRef.current, mapEl.current);
      }
      const m = mapRef.current;
      layersRef.current.forEach(l => m.removeLayer(l));
      layersRef.current = [];
      const all: [number, number][] = [];
      data.runs.forEach(r => {
        const lls = (r.points || []).map(p => [p.lat, p.lng] as [number, number]);
        if (lls.length < 2) return;
        all.push(...lls);
        // wide soft underlay + bright core: overlapping runs sum into heat
        layersRef.current.push(L.polyline(lls, { color: '#C6FF3D', weight: 9, opacity: .06, lineCap: 'round', lineJoin: 'round' }).addTo(m));
        layersRef.current.push(L.polyline(lls, { color: '#C6FF3D', weight: 3, opacity: .22, lineCap: 'round', lineJoin: 'round' }).addTo(m));
      });
      if (all.length) {
        m.invalidateSize();
        m.fitBounds(L.latLngBounds(all), { padding: [30, 30] });
      }
    }, 320);
    return () => clearTimeout(t);
  }, [open]);

  const total = data.runs.reduce((a, r) => a + r.dist, 0);
  return (
    <div className={'sheet' + (open ? ' open' : '')} style={{ zIndex: 910 }}>
      <div className="sheet-head">
        <button className="iconbtn" onClick={onClose}><IcoBack /></button>
        <h2>Your heatmap</h2>
        <div className="gps">{data.runs.length} runs · {fmtDist(total, 0)} {UNIT()}</div>
      </div>
      <div ref={mapEl} style={{ flex: 1, background: '#0A0E13' }} />
      <div style={{ padding: '10px 16px calc(14px + var(--sab))', fontSize: 11, color: 'var(--dim)', flex: 'none' }}>
        Every run you've recorded, drawn on one map. Streets you run often glow brighter.
      </div>
    </div>
  );
}
