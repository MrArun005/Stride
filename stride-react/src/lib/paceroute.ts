import * as L from 'leaflet';
import type { Pt } from './types';
import { speedProfile, rampColor } from './analytics';
import { REDUCED } from './settings';

/* draw a route coloured by pace; returns the layers so they can be removed later */
export function paceRoute(map: L.Map, pts: Pt[], weight = 5): L.Polyline[] {
  const layers: L.Polyline[] = [];
  if (!pts || pts.length < 2) return layers;
  const { v, lo, hi } = speedProfile(pts);
  const span = Math.max(hi - lo, 0.15);
  const CH = Math.max(2, Math.round(pts.length / 160));
  for (let i = 0; i < pts.length - 1; i += CH) {
    const end = Math.min(pts.length - 1, i + CH);
    let s = 0, n = 0;
    for (let k = i; k <= end; k++) { s += v[k]; n++; }
    const t = ((s / n) - lo) / span;
    layers.push(L.polyline(pts.slice(i, end + 1).map(p => [p.lat, p.lng] as [number, number]),
      { color: rampColor(t), weight, opacity: .97, lineCap: 'round', lineJoin: 'round' }).addTo(map));
  }
  return layers;
}

/* reveal a set of route layers progressively */
export function drawOn(layers: L.Polyline[], ms = 850) {
  if (REDUCED || !layers.length) return;
  layers.forEach(l => l.setStyle({ opacity: 0 }));
  const t0 = performance.now();
  (function step(now: number) {
    const p = Math.min(1, (now - t0) / ms);
    const upto = Math.floor(p * layers.length);
    for (let i = 0; i < upto; i++) if (layers[i].options.opacity !== .97) layers[i].setStyle({ opacity: .97 });
    if (p < 1) requestAnimationFrame(step);
    else layers.forEach(l => l.setStyle({ opacity: .97 }));
  })(t0);
}
