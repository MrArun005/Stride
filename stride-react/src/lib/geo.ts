export interface LatLng { lat: number; lng: number }

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const la1 = a.lat * toR, la2 = b.lat * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/* local flat-earth projection (accurate well past any run length) */
export function projector(lat0: number, lng0: number) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  return (p: LatLng) => ({ x: (p.lng - lng0) * kx, y: (p.lat - lat0) * ky });
}

export function resample(points: LatLng[], spacing: number): LatLng[] {
  if (points.length < 2) return points.slice();
  const out: LatLng[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = haversine(a, b);
    if (len <= 0) continue;
    let t = (spacing - carry) / len;
    while (t <= 1) {
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
      t += spacing / len;
    }
    carry = (carry + len) % spacing;
  }
  const last = points[points.length - 1];
  if (haversine(out[out.length - 1], last) > spacing / 2) out.push({ lat: last.lat, lng: last.lng });
  return out;
}
