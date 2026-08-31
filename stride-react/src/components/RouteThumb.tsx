import type { LatLng } from '../lib/geo';

interface Props {
  points: LatLng[]; w: number; h: number;
  pad?: number; sw?: number; glow?: boolean; ends?: boolean;
}

export default function RouteThumb({ points, w, h, pad = 6, sw = 2.2, glow, ends }: Props) {
  if (!points || points.length < 2) return <svg viewBox="0 0 1 1" />;
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const la0 = Math.min(...lats), la1 = Math.max(...lats);
  const lo0 = Math.min(...lngs), lo1 = Math.max(...lngs);
  const kx = Math.cos((la0 + la1) / 2 * Math.PI / 180);
  const sw2 = Math.max((lo1 - lo0) * kx, 1e-6), sh = Math.max(la1 - la0, 1e-6);
  const s = Math.min((w - pad * 2) / sw2, (h - pad * 2) / sh);
  const ox = (w - sw2 * s) / 2, oy = (h - sh * s) / 2;
  let d = '', fx = 0, fy = 0, lx = 0, ly = 0;
  const stride = Math.max(1, Math.floor(points.length / 220));
  for (let i = 0; i < points.length; i += stride) {
    const p = points[i];
    const x = ox + (p.lng - lo0) * kx * s, y = h - (oy + (p.lat - la0) * s);
    if (!i) { fx = x; fy = y; }
    lx = x; ly = y;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`}>
      {glow && <path d={d} fill="none" stroke="#C6FF3D" strokeWidth={sw * 3} strokeLinecap="round" strokeLinejoin="round" opacity=".14" />}
      <path d={d} fill="none" stroke="#C6FF3D" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
      {ends && <>
        <circle cx={fx.toFixed(1)} cy={fy.toFixed(1)} r="3.4" fill="#4DA3FF" stroke="#07090C" strokeWidth="1.6" />
        <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="3.4" fill="#FF5A36" stroke="#07090C" strokeWidth="1.6" />
      </>}
    </svg>
  );
}
