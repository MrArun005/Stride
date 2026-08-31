import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { S, UNIT, PACE_UNIT, M_PER_UNIT, REDUCED } from '../lib/settings';
import { fmtDur, fmtPace, fmtDist } from '../lib/format';
import { addTiles } from '../lib/tiles';
import { rampColor } from '../lib/analytics';
import type { Pt } from '../lib/types';
import {
  T, useTracker, startRun, pauseRun, resumeRun, finishRun, mapHooks, currentPace, type Fix,
} from '../lib/tracker';
import { LIVE } from '../lib/livesegments';
import { IcoRecenter } from './icons';

/* live trace: chunked polylines coloured by pace relative to the run average */
class LiveTrace {
  m: L.Map; chunks: L.Polyline[] = []; cur: L.Polyline | null = null; curPts: Pt[] = [];
  dot: L.CircleMarker | null = null; halo: L.Circle | null = null;
  follow = true; last: Fix | null = null;
  onFollowLost: () => void;

  constructor(m: L.Map, onFollowLost: () => void) {
    this.m = m; this.onFollowLost = onFollowLost;
    m.on('dragstart', () => { this.follow = false; this.onFollowLost(); });
  }
  private chunk(p: Pt) {
    this.cur = L.polyline([[p.lat, p.lng]],
      { color: '#C6FF3D', weight: 5.5, opacity: .97, lineCap: 'round', lineJoin: 'round' }).addTo(this.m);
    this.chunks.push(this.cur);
  }
  reset() {
    this.chunks.forEach(l => this.m.removeLayer(l));
    this.chunks = []; this.cur = null; this.curPts = [];
  }
  addPoint(p: Pt) {
    if (!this.cur) this.chunk(p);
    this.cur!.addLatLng([p.lat, p.lng]);
    this.curPts.push(p);
    if (this.curPts.length >= 8) {                  // close the chunk, colour it by its pace
      const a = this.curPts[0], b = this.curPts[this.curPts.length - 1];
      const dm = b.m - a.m, v = dm > 0 ? (b.d - a.d) / (dm / 1000) : 0;
      const avg = (T.dist > 60 && T.movingMs > 0) ? T.dist / (T.movingMs / 1000) : v;
      this.cur!.setStyle({ color: rampColor(avg > 0 ? .5 + (v / avg - 1) * 1.8 : .5) });
      this.curPts = [p]; this.chunk(p);             // next chunk shares this point
    }
  }
  onFix(fix: Fix, running: boolean) {
    this.last = fix;
    const ll: [number, number] = [fix.lat, fix.lng];
    if (!this.dot) {
      this.halo = L.circle(ll, { radius: fix.acc, color: '#C6FF3D', weight: 1, opacity: .35, fillColor: '#C6FF3D', fillOpacity: .08 }).addTo(this.m);
      this.dot = L.circleMarker(ll, { radius: 7, color: '#0B0D10', weight: 3, fillColor: '#C6FF3D', fillOpacity: 1 }).addTo(this.m);
      this.m.setView(ll, 16);
    } else {
      this.dot.setLatLng(ll); this.halo!.setLatLng(ll); this.halo!.setRadius(fix.acc);
    }
    if (this.follow) this.m.setView(ll, Math.max(this.m.getZoom(), running ? 16 : 15), { animate: true, duration: .5 });
  }
  recenter() {
    this.follow = true;
    if (this.last) this.m.setView([this.last.lat, this.last.lng], Math.max(this.m.getZoom(), 16));
  }
}

function gpsChip(acc: number | null, seen: boolean) {
  if (!seen || acc == null) return { cls: '', txt: seen ? 'Searching…' : 'GPS off' };
  if (acc <= 10) return { cls: 'ok', txt: 'GPS strong' };
  if (acc <= 25) return { cls: 'mid', txt: 'GPS ok · ' + Math.round(acc) + 'm' };
  return { cls: 'bad', txt: 'GPS weak · ' + Math.round(acc) + 'm' };
}

export default function RunScreen({ active }: { active: boolean }) {
  useTracker();
  const mapEl = useRef<HTMLDivElement>(null);
  const dockEl = useRef<HTMLDivElement>(null);
  const distEl = useRef<HTMLSpanElement>(null);
  const trace = useRef<LiveTrace | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const [hint, setHint] = useState(() => !localStorage.getItem('stride.hintSeen'));
  const [holdLabel, setHoldLabel] = useState('Hold to finish');
  const fillEl = useRef<HTMLSpanElement>(null);

  /* map init (once) */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const m = L.map(mapEl.current, {
      zoomControl: false, attributionControl: true,
      renderer: L.canvas({ padding: .5 }), zoomAnimation: true,
    }).setView([12.9716, 77.5946], 15);
    addTiles(m, mapEl.current);
    mapRef.current = m;
    const tr = new LiveTrace(m, () => setShowRecenter(true));
    trace.current = tr;
    mapHooks.onFix = (f, r) => tr.onFix(f, r);
    mapHooks.onPoint = p => tr.addPoint(p);
    mapHooks.onReset = () => tr.reset();
  }, []);

  /* keep tiles in sync with the style setting */
  const styleKey = S.mapStyle;
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapEl.current) return;
    m.eachLayer(l => { if (l instanceof L.TileLayer) m.removeLayer(l); });
    addTiles(m, mapEl.current);
  }, [styleKey]);

  /* leaflet needs a nudge when the tab becomes visible */
  useEffect(() => {
    if (active && mapRef.current) setTimeout(() => mapRef.current!.invalidateSize(), 60);
  }, [active]);

  /* dock height → CSS var so the attribution rides above it */
  useEffect(() => {
    const el = dockEl.current;
    if (!el) return;
    const setH = () => document.documentElement.style.setProperty('--dockh', el.offsetHeight + 'px');
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* eased hero distance (writes straight to the DOM at rAF rate) */
  useEffect(() => {
    let disp = 0, raf = 0, on = true;
    const step = () => {
      if (!on) return;
      const gap = T.dist - disp;
      disp += (Math.abs(gap) < .5 || Math.abs(gap) > 30) ? gap : gap * .26;
      if (distEl.current) distEl.current.textContent = fmtDist(REDUCED ? T.dist : disp);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { on = false; cancelAnimationFrame(raf); };
  }, []);

  /* hold-to-finish */
  const holdRaf = useRef(0);
  const beginHold = (e: React.PointerEvent) => {
    e.preventDefault();
    const t0 = performance.now(), HOLD = 900;
    setHoldLabel('Keep holding…');
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD);
      if (fillEl.current) fillEl.current.style.width = (p * 100) + '%';
      if (p >= 1) { cancelHold(); finishRun(); return; }
      holdRaf.current = requestAnimationFrame(step);
    };
    holdRaf.current = requestAnimationFrame(step);
  };
  const cancelHold = () => {
    cancelAnimationFrame(holdRaf.current);
    if (fillEl.current) fillEl.current.style.width = '0';
    setHoldLabel('Hold to finish');
  };

  const sec = T.movingMs / 1000;
  const avg = T.dist > 20 ? sec / (T.dist / M_PER_UNIT()) : NaN;
  const chip = gpsChip(T.gpsAcc, T.gpsSeen);
  const idle = T.state === 'idle', running = T.state === 'running';
  const lastSp = T.splits[T.splits.length - 1];
  const prevSp = T.splits[T.splits.length - 2];
  const bestPace = T.splits.length ? Math.min(...T.splits.map(s => s.pace)) : 0;

  return (
    <section id="view-run" className={'view' + (active ? ' active' : '')}>
      <div id="map" ref={mapEl} />
      <div className="topbar float">
        <div className="brand"><div className="mark">S</div><h1>Stride</h1></div>
        <div className="spacer" />
        <div className={'gps ' + chip.cls}><span className="dot" /><span>{chip.txt}</span></div>
      </div>
      <button id="recenter" className={showRecenter ? 'show' : ''}
        onClick={() => { trace.current?.recenter(); setShowRecenter(false); }}>
        <IcoRecenter />
      </button>
      <div className="overlay-msg">
        {T.permError && <div className="banner"><b>Location blocked.</b> {T.permError}</div>}
        {hint && !T.permError && (
          <div className="hint">
            <span><b>Before your first run:</b> keep the screen on and Stride open in front.
              Phone browsers pause GPS when the screen locks or you switch apps.</span>
            <button onClick={() => { setHint(false); localStorage.setItem('stride.hintSeen', '1'); }}>GOT IT</button>
          </div>
        )}
      </div>
      <div className="dock" ref={dockEl}>
        <div className="hud">
          <div className="hero">
            <span className="val num" ref={distEl}>0.00</span>
            <span className="unit">{UNIT()}</span>
          </div>
          <div className="hero-label">Distance</div>
          <div className="trio">
            <div><div className="k">Time</div><div className="v num">{fmtDur(sec)}</div></div>
            <div><div className="k">Avg Pace</div><div className="v num">{fmtPace(avg)}<small>{PACE_UNIT()}</small></div></div>
            <div><div className="k">Now</div><div className="v num">{T.autoPaused ? 'idle' : fmtPace(currentPace())}<small>{PACE_UNIT()}</small></div></div>
          </div>
          {LIVE.current && running && (
            <div className="liveseg">
              <div className="ls-top">
                <span className="ls-name">⚡ {LIVE.current.name}</span>
                {LIVE.current.delta != null && (
                  <span className={'ls-delta num' + (LIVE.current.delta <= 0 ? '' : ' behind')}>
                    {(LIVE.current.delta <= 0 ? '−' : '+') + Math.abs(Math.round(LIVE.current.delta)) + 's'}
                    <small>{LIVE.current.delta <= 0 ? ' vs PR' : ' vs PR'}</small>
                  </span>
                )}
                <span className="ls-time num">{fmtDur(LIVE.current.elapsed)}</span>
              </div>
              <div className="ls-track">
                <div className={'ls-bar' + (LIVE.current.delta != null && LIVE.current.delta > 0 ? ' behind' : '')}
                  style={{ width: (LIVE.current.frac * 100).toFixed(1) + '%' }} />
              </div>
            </div>
          )}
          {!LIVE.current && LIVE.lastResult && Date.now() - LIVE.lastResult.at < 12000 && running && (
            <div className="liveseg done">
              <div className="ls-top">
                <span className="ls-name">🏁 {LIVE.lastResult.name} · {fmtDur(LIVE.lastResult.dur)}</span>
                {LIVE.lastResult.delta != null && (
                  <span className={'ls-delta num' + (LIVE.lastResult.delta <= 0 ? '' : ' behind')}>
                    {LIVE.lastResult.delta <= 0 ? 'PR! −' + Math.abs(Math.round(LIVE.lastResult.delta)) + 's'
                      : '+' + Math.round(LIVE.lastResult.delta) + 's'}
                  </span>
                )}
              </div>
            </div>
          )}
          {lastSp && !idle && (
            <div className="lastsplit show">
              <span>{(S.units === 'km' ? 'KM ' : 'MI ') + lastSp.n}</span>
              <b>{fmtPace(lastSp.pace)}{PACE_UNIT()}</b>
              <span style={{ color: 'var(--dim)' }}>{fmtDur(lastSp.dur)}</span>
              {lastSp.pace <= bestPace && T.splits.length > 1
                ? <span className="badge">fastest</span>
                : prevSp && (
                  <span className={'badge' + (lastSp.pace > prevSp.pace ? ' slow' : '')}>
                    {(lastSp.pace - prevSp.pace < 0 ? '−' : '+') + fmtPace(Math.abs(lastSp.pace - prevSp.pace))
                      + (lastSp.pace - prevSp.pace < 0 ? ' faster' : ' slower')}
                  </span>
                )}
            </div>
          )}
        </div>
        <div className="controls">
          {idle && <button className="btn-main" onClick={startRun}>Start Run</button>}
          {running && (
            <button className="btn-ghost" style={T.autoPaused ? { color: '#FFC53D' } : undefined} onClick={pauseRun}>
              {T.autoPaused ? 'Auto-paused' : 'Pause'}
            </button>
          )}
          {T.state === 'paused' && <button className="btn-main" onClick={resumeRun}>Resume</button>}
          {!idle && (
            <button className="btn-stop"
              onPointerDown={beginHold} onPointerUp={cancelHold}
              onPointerLeave={cancelHold} onPointerCancel={cancelHold}>
              <span className="fill" ref={fillEl} /><span>{holdLabel}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
