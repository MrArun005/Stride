import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { S, UNIT, PACE_UNIT, M_PER_UNIT } from '../../lib/settings';
import { fmtDur, fmtPace, fmtDist, relDate } from '../../lib/format';
import { runPBs, allTimePBs, achFor, interpAt, matchedRuns, gapPace } from '../../lib/analytics';
import { paceRoute, drawOn } from '../../lib/paceroute';
import { addTiles } from '../../lib/tiles';
import { exportGPX } from '../../lib/gpx';
import { fetchWeather, weatherLabel, weatherEmoji } from '../../lib/weather';
import type { Run } from '../../lib/types';
import { DB } from '../../lib/db';
import { data, useStore, deleteRun, effortRank, rankCls, toast, setRunShoe, loadRuns, emit } from '../../store';
import { IcoBack, IcoDownload, IcoTrash, IcoAward } from '../icons';

function PaceCurve({ run }: { run: Run }) {
  const p = run.points || []; if (p.length < 8) return null;
  const W = 320, H = 110, PADX = 4, PADY = 10;
  const total = p[p.length - 1].d; if (total < 200) return null;
  const N = 40, pts: { x: number; pace: number }[] = [];
  for (let i = 1; i <= N; i++) {
    const dA = total * (i - 1) / N, dB = total * i / N;
    const a = interpAt(p, dA), b = interpAt(p, dB);
    const dt = (b - a) / 1000, dd = (dB - dA) / M_PER_UNIT();
    pts.push({ x: (dA + dB) / 2 / total, pace: dd > 0 ? dt / dd : NaN });
  }
  const good = pts.filter(o => isFinite(o.pace) && o.pace > 90 && o.pace < 1500);
  if (good.length < 5) return null;
  const lo = Math.min(...good.map(o => o.pace)), hi = Math.max(...good.map(o => o.pace));
  const span = Math.max(hi - lo, 20);
  let d = '';
  good.forEach((o, i) => {
    const x = PADX + o.x * (W - PADX * 2);
    const y = PADY + (o.pace - lo) / span * (H - PADY * 2);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  });
  const area = d + 'L' + (W - PADX) + ' ' + H + 'L' + PADX + ' ' + H + 'Z';
  return (
    <>
      <div className="sec-title">Pace over distance</div>
      <div className="card">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C6FF3D" stopOpacity=".35" /><stop offset="1" stopColor="#C6FF3D" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#pg)" /><path d={d} fill="none" stroke="#C6FF3D" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
          <span>fastest {fmtPace(lo)}{PACE_UNIT()}</span><span>slowest {fmtPace(hi)}{PACE_UNIT()}</span>
        </div>
      </div>
    </>
  );
}

function ElevChart({ run }: { run: Run }) {
  const p = (run.points || []).filter(o => o.alt != null);
  if (p.length < 8) return null;
  const W = 320, H = 90;
  const alts = p.map(o => o.alt as number);
  const lo = Math.min(...alts), hi = Math.max(...alts);
  if (hi - lo < 3) return null;
  const total = p[p.length - 1].d || 1;
  let d = '';
  p.forEach((o, i) => {
    const x = o.d / total * W, y = H - 6 - ((o.alt as number) - lo) / (hi - lo) * (H - 16);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  });
  return (
    <>
      <div className="sec-title">Elevation</div>
      <div className="card">
        <svg className="chart" style={{ height: 90 }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <path d={d + 'L' + W + ' ' + H + 'L0 ' + H + 'Z'} fill="rgba(77,163,255,.18)" />
          <path d={d} fill="none" stroke="#4DA3FF" strokeWidth="2" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
          <span>↑ {run.elevGain || 0} m</span><span>↓ {run.elevLoss || 0} m</span><span>{Math.round(lo)}–{Math.round(hi)} m</span>
        </div>
      </div>
    </>
  );
}

export default function RunDetailSheet({ run, open, onClose, onMakeSegment }: {
  run: Run | null; open: boolean; onClose: () => void; onMakeSegment: (r: Run) => void;
}) {
  useStore();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [wx, setWx] = useState(run?.weather ?? null);

  /* map: init lazily, redraw when the run changes */
  useEffect(() => {
    if (!open || !run || !mapEl.current) return;
    const t = setTimeout(() => {
      if (!mapRef.current) {
        mapRef.current = L.map(mapEl.current!, { zoomControl: false, dragging: true, renderer: L.canvas({ padding: .5 }) });
        addTiles(mapRef.current, mapEl.current);
      }
      const m = mapRef.current;
      layersRef.current.forEach(l => m.removeLayer(l));
      const pts = run.points || [];
      const lls = pts.map(p => [p.lat, p.lng] as [number, number]);
      if (lls.length > 1) {
        const route = paceRoute(m, pts, 4.5);
        const a = L.circleMarker(lls[0], { radius: 6.5, color: '#07090C', weight: 3, fillColor: '#4DA3FF', fillOpacity: 1 }).addTo(m);
        const b = L.circleMarker(lls[lls.length - 1], { radius: 6.5, color: '#07090C', weight: 3, fillColor: '#FF5A36', fillOpacity: 1 }).addTo(m);
        layersRef.current = [...route, a, b];
        m.invalidateSize();
        m.fitBounds(L.polyline(lls).getBounds(), { padding: [28, 28] });
        drawOn(route, 900);
      } else { layersRef.current = []; m.invalidateSize(); }
    }, 320);
    return () => clearTimeout(t);
  }, [open, run]);

  /* weather stamp: fetch once per run, cache on the record */
  useEffect(() => {
    setWx(run?.weather ?? null);
    if (!open || !run || run.weather !== undefined || !run.points?.length) return;
    let alive = true;
    const p = run.points[0];
    fetchWeather(p.lat, p.lng, run.startedAt).then(async w => {
      if (!alive) return;
      run.weather = w;
      await DB.put('runs', run);
      await loadRuns(); emit();
      setWx(w);
    });
    return () => { alive = false; };
  }, [open, run]);

  if (!run) return <div className={'sheet' + (open ? ' open' : '')} />;

  const pace = run.movingSec / (run.dist / M_PER_UNIT());
  const pbs = runPBs(run);
  const splits = run.splits || [];
  const paces = splits.map(s => s.pace);
  const best = paces.length ? Math.min(...paces) : 0;
  const worst = paces.length ? Math.max(...paces) : 1;
  const ach = achFor(run, allTimePBs(data.runs), data.runs.length);
  const gap = gapPace(run, M_PER_UNIT());
  const mine = data.efforts.filter(e => e.runId === run.id).sort((a, b) => a.startD - b.startD);
  const same = matchedRuns(run, data.runs);
  const field = same.length ? [...same, run].sort((a, b) => a.movingSec - b.movingSec) : [];
  const shoe = data.shoes.find(s => s.id === run.shoeId);

  return (
    <div className={'sheet' + (open ? ' open' : '')}>
      <div className="sheet-head">
        <button className="iconbtn" onClick={onClose}><IcoBack /></button>
        <h2>{run.name} · {new Date(run.startedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</h2>
        <button className="iconbtn" title="Export GPX" onClick={() => { exportGPX(run); toast('GPX exported'); }}><IcoDownload /></button>
        <button className="iconbtn" style={{ color: '#FF5A36' }} onClick={async () => {
          if (!confirm('Delete this run permanently?')) return;
          await deleteRun(run); onClose(); toast('Run deleted');
        }}><IcoTrash /></button>
      </div>
      <div id="detailMap" ref={mapEl} />
      <div className="scroll" style={{ paddingTop: 14 }}>
        <div className="legend"><span>slower</span><span className="ramp" /><span>faster</span></div>

        <div className="d-hero">
          <div className="big num">{fmtDist(run.dist)}<span className="u">{UNIT()}</span></div>
          <div className="d-trio">
            <div><span className="k">Moving time</span><b>{fmtDur(run.movingSec)}</b></div>
            <div><span className="k">Avg pace</span><b>{fmtPace(pace)}<small>{PACE_UNIT()}</small></b></div>
            <div><span className="k">Elev gain</span><b>{run.elevGain || 0}<small> m</small></b></div>
          </div>
        </div>

        {wx && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 12, color: 'var(--muted)', alignItems: 'center' }}>
            <span>{weatherEmoji(wx.code)}</span>
            <span><b style={{ color: 'var(--text)' }}>{wx.t}°C</b> · {weatherLabel(wx.code)} · wind {wx.wind} km/h</span>
          </div>
        )}

        {ach.length > 0 && (
          <div className="ach-banner">
            <div className="ic"><IcoAward /></div>
            <div>
              <div className="tt">{ach.length} achievement{ach.length === 1 ? '' : 's'}</div>
              <div className="ss">{ach.join(' · ')}</div>
            </div>
          </div>
        )}

        <div className="stat-grid" style={{ marginTop: 14 }}>
          <div className="stat"><div className="k">Best {S.units === 'km' ? 'km' : 'mi'}</div>
            <div className="v num">{best ? fmtPace(best) : '--'}<small> {PACE_UNIT()}</small></div></div>
          <div className="stat"><div className="k">Grade adjusted pace</div>
            <div className="v num">{gap ? fmtPace(gap) : '--'}<small> {PACE_UNIT()}</small></div></div>
          <div className="stat"><div className="k">Avg speed</div>
            <div className="v num">{(run.dist / M_PER_UNIT() / (run.movingSec / 3600)).toFixed(1)}<small> {UNIT()}/h</small></div></div>
          <div className="stat"><div className="k">Elev loss</div>
            <div className="v num">{run.elevLoss || 0}<small> m</small></div></div>
        </div>

        {(pbs.k1 || pbs.k5 || pbs.k10) && (
          <>
            <div className="sec-title">Fastest segments</div>
            <div className="card">
              {pbs.k1 && <div className="pb-row"><span className="lbl">1 km</span><span className="val num">{fmtDur(pbs.k1)}</span></div>}
              {pbs.k5 && <div className="pb-row"><span className="lbl">5 km</span><span className="val num">{fmtDur(pbs.k5)}</span></div>}
              {pbs.k10 && <div className="pb-row"><span className="lbl">10 km</span><span className="val num">{fmtDur(pbs.k10)}</span></div>}
            </div>
          </>
        )}

        {splits.length > 0 && (
          <>
            <div className="sec-title">Splits</div>
            <div className="card">
              {splits.map(s => {
                const w = 18 + 82 * (worst === best ? 1 : (worst - s.pace) / (worst - best) * .85 + .15);
                return (
                  <div className="splitbar" key={s.n}>
                    <span className="n num">{s.n}</span>
                    <div className="track">
                      <div className={'bar' + (s.pace === best ? ' best' : '')}
                        style={{ width: w.toFixed(1) + '%', animationDelay: s.n * 45 + 'ms' }} />
                    </div>
                    <span className="p num">{fmtPace(s.pace)}</span>
                  </div>
                );
              })}
              {run.partialSplit && (
                <div className="splitbar" style={{ opacity: .6 }}>
                  <span className="n num">{splits.length + 1}</span>
                  <div className="track">
                    <div className="bar" style={{ width: ((18 + 82 * .3) * run.partialSplit.frac).toFixed(1) + '%' }} />
                  </div>
                  <span className="p num">{fmtPace(run.partialSplit.dur / run.partialSplit.frac)}</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>Longer bar = faster {UNIT()}</div>
            </div>
          </>
        )}

        <PaceCurve run={run} />
        <ElevChart run={run} />

        {mine.length > 0 && (
          <>
            <div className="sec-title">Segments on this run</div>
            <div className="card">
              {mine.map(e => {
                const sg = data.segments.find(x => x.id === e.segId);
                if (!sg) return null;
                const r = effortRank(e);
                return (
                  <div className="lead-row" key={e.id}>
                    <div className={'rank' + rankCls(r.rank - 1)}>{r.rank}</div>
                    <div className="dt" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
                      {sg.name}
                      <div style={{ fontWeight: 500, color: 'var(--dim)', fontSize: 11, marginTop: 2 }}>
                        {fmtDist(sg.length)} {UNIT()} · {r.rank === 1 ? 'your fastest' : r.rank + ' of ' + r.of + ' efforts'}
                      </div>
                    </div>
                    <div className="tm num">{fmtDur(e.dur)}</div>
                    {r.rank === 1 && <span className="chip pr">PR</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {field.length > 0 && (
          <>
            <div className="sec-title">You have run this route {field.length} times</div>
            <div className="card">
              {field.map((r, i) => (
                <div className={'lead-row' + (r.id === run.id ? ' you' : '')} key={r.id}>
                  <div className={'rank' + rankCls(i)}>{i + 1}</div>
                  <div className="dt">{relDate(r.startedAt)}{r.id === run.id ? ' · this run' : ''}</div>
                  <div className="tm num">{fmtDur(r.movingSec)}</div>
                  <div className="dl num">{fmtDist(r.dist)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <button className="ghostbtn" onClick={() => onMakeSegment(run)}>+ Create segment from this run</button>

        <div className="sec-title">Details</div>
        <div className="card">
          <div className="row"><div className="lab">Started</div><div className="num">{new Date(run.startedAt).toLocaleString()}</div></div>
          <div className="row"><div className="lab">Total elapsed</div><div className="num">{fmtDur(run.elapsedSec)}</div></div>
          <div className="row"><div className="lab">GPS points</div><div className="num">{(run.points || []).length}</div></div>
          {data.shoes.length > 0 && (
            <div className="row">
              <div className="lab">Shoes</div>
              <select className="namein" style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                value={run.shoeId ?? ''} onChange={e => setRunShoe(run, e.target.value ? +e.target.value : null)}>
                <option value="">None</option>
                {data.shoes.filter(s => !s.retired || s.id === run.shoeId).map(s =>
                  <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {shoe && !data.shoes.length && <div className="row"><div className="lab">Shoes</div><div className="num">{shoe.name}</div></div>}
        </div>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
