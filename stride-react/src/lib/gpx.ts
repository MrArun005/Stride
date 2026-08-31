import type { Run } from './types';
import { dayKey } from './format';

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export function exportGPX(run: Run) {
  const iso = (t: number) => new Date(t).toISOString();
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<gpx version="1.1" creator="Stride" xmlns="http://www.topografix.com/GPX/1/1">\n'
    + '<metadata><time>' + iso(run.startedAt) + '</time></metadata>\n'
    + '<trk><name>' + run.name + '</name><type>running</type><trkseg>\n';
  (run.points || []).forEach(p => {
    x += '<trkpt lat="' + p.lat + '" lon="' + p.lng + '">'
      + (p.alt != null ? '<ele>' + p.alt + '</ele>' : '')
      + '<time>' + iso(p.t) + '</time></trkpt>\n';
  });
  x += '</trkseg></trk></gpx>';
  download(new Blob([x], { type: 'application/gpx+xml' }), 'stride-' + dayKey(run.startedAt) + '.gpx');
}
