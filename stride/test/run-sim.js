const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/root/stride/test/shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['geolocation'], geolocation: { latitude: 12.9716, longitude: 77.5946 }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|tile|ERR_/i.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__stride, null, { timeout: 10000 });
  await page.screenshot({ path: OUT + '/01-idle.png' });

  // ---------- simulate a 5.2 km run ----------
  const result = await page.evaluate(async () => {
    const S = window.__stride;
    const T = S.T;
    const R = 6371000, toR = Math.PI / 180;
    // build a route: 5200 m, varying pace 4:45 -> 6:10 per km, mild hills
    const lat0 = 12.9716, lng0 = 77.5946;
    const kx = Math.cos(lat0 * toR);
    const mToLat = m => m / 111320;
    const mToLng = m => m / (111320 * kx);

    S.startRun();
    await new Promise(r => setTimeout(r, 60));

    let simMs = 0, dist = 0, bearing = 0, x = 0, y = 0;
    const t0 = Date.now();
    const fixes = [];
    // 5200 m in 3 m steps -> ~1733 fixes
    while (dist < 5200) {
      // pace model: sec per km, faster in km 3
      const km = dist / 1000;
      const paceSecPerKm = 285 + 55 * Math.sin(km * 1.1) + (km > 4 ? 30 : 0);
      const v = 1000 / paceSecPerKm;            // m/s
      const step = 3.0;
      const dt = step / v;                       // seconds for this step
      bearing += (Math.random() - 0.5) * 0.25 + 0.004; // gentle curving loop
      x += Math.cos(bearing) * step;
      y += Math.sin(bearing) * step;
      dist += step;
      simMs += dt * 1000;
      fixes.push({
        lat: lat0 + mToLat(y), lng: lng0 + mToLng(x),
        alt: 920 + 14 * Math.sin(dist / 700) + 4 * Math.sin(dist / 130),
        acc: 5 + Math.random() * 6, t: t0 + Math.round(simMs), m: simMs
      });
    }

    const feed = f => {
      T.movingMs = f.m;                          // deterministic moving clock for the sim
      S.onPosition({ coords: { latitude: f.lat, longitude: f.lng, altitude: f.alt, accuracy: f.acc }, timestamp: f.t });
    };

    // adversarial fixes mixed in, to prove the filters work
    let injected = 0;
    for (let i = 0; i < fixes.length; i++) {
      feed(fixes[i]);
      if (i === 400) { // bad accuracy fix, way off route -> must be ignored
        S.onPosition({ coords: { latitude: fixes[i].lat + 0.01, longitude: fixes[i].lng + 0.01, altitude: 900, accuracy: 180 }, timestamp: fixes[i].t + 500 });
        injected++;
      }
      if (i === 800) { // teleport 2 km in 1 s -> must be ignored
        S.onPosition({ coords: { latitude: fixes[i].lat + 0.018, longitude: fixes[i].lng, altitude: 900, accuracy: 6 }, timestamp: fixes[i].t + 1000 });
        injected++;
      }
      if (i === 1200) { // standing-still jitter 0.6 m -> must be ignored
        S.onPosition({ coords: { latitude: fixes[i].lat + 0.0000054, longitude: fixes[i].lng, altitude: 900, accuracy: 5 }, timestamp: fixes[i].t + 1000 });
        injected++;
      }
    }
    const live = {
      dist: T.dist, points: T.points.length, splits: T.splits.map(s => Math.round(s.pace * 10) / 10),
      elevGain: Math.round(T.elevGain), injected,
      hudDist: document.getElementById('hDist').textContent,
      hudAvg: document.getElementById('hAvg').textContent,
      trace: window.__stride ? null : null
    };
    live.simDurationSec = Math.round(simMs / 1000);
    return live;
  });

  await page.waitForTimeout(600);
  const hud = await page.evaluate(() => ({
    dist: document.getElementById('hDist').textContent,
    time: document.getElementById('hTime').textContent,
    avg: document.getElementById('hAvg').innerText,
    cur: document.getElementById('hCur').innerText,
    lastSplit: document.getElementById('lastSplit').innerText,
    tracePts: document.querySelectorAll('#map path').length
  }));
  await page.screenshot({ path: OUT + '/02-running.png' });

  // finish and inspect the saved run
  const saved = await page.evaluate(async () => {
    await window.__stride.finishRun();
    await new Promise(r => setTimeout(r, 500));
    const r = window.__stride.RUNS()[0];
    return { dist: r.dist, movingSec: r.movingSec, splits: r.splits.map(s => s.pace), pts: r.points.length, elevGain: r.elevGain, partial: r.partialSplit };
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/03-detail-top.png' });
  await page.evaluate(() => document.getElementById('detailBody').scrollTop = 380);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/04-detail-splits.png' });
  await page.evaluate(() => document.getElementById('detailBody').scrollTop = 1000);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/05-detail-charts.png' });

  // seed a few older runs so history/progress look real
  await page.evaluate(async () => {
    const S = window.__stride;
    const base = S.RUNS()[0];
    const day = 864e5;
    for (let i = 1; i <= 6; i++) {
      const f = 0.55 + Math.random() * 0.75;
      const tf = 0.95 + Math.random() * 0.2;
      const pts = base.points.map(p => ({ lat: p.lat + i * 0.0016, lng: p.lng - i * 0.0011, t: p.t, d: Math.round(p.d * f), m: Math.round(p.m * f * tf), alt: p.alt }));
      const dist = pts[pts.length - 1].d, ms = pts[pts.length - 1].m;
      const splits = [];
      for (let k = 1; k * 1000 <= dist; k++) splits.push({ n: k, pace: Math.round((ms / 1000) / (dist / 1000) * (0.94 + Math.random() * 0.13) * 10) / 10, dur: 0 });
      const st = Date.now() - i * day - 3600e3;
      await S.DB.put('runs', { id: st, startedAt: st, endedAt: st + ms, dist, movingSec: Math.round(ms / 1000), elapsedSec: Math.round(ms / 1000) + 40, points: pts, splits, elevGain: 40 + i * 3, elevLoss: 38 + i * 3, unit: 'km', name: i % 2 ? 'Morning Run' : 'Evening Run' });
    }
    document.getElementById('detailSheet').classList.remove('open');
    location.reload();
  });
  await page.waitForFunction(() => !!window.__stride && window.__stride.RUNS().length > 5, null, { timeout: 10000 });
  await page.waitForTimeout(400);

  await page.click('#tabbar button[data-tab="history"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/06-history.png' });

  await page.click('#tabbar button[data-tab="progress"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/07-progress.png' });
  await page.evaluate(() => document.getElementById('progressBody').scrollTop = 520);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/08-progress-pbs.png' });

  await page.click('#btnSettings');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/09-settings.png' });

  const progressText = await page.evaluate(() => document.getElementById('progressBody').innerText);

  console.log(JSON.stringify({ live: result, hud, saved, errors, progressText: progressText.slice(0, 700) }, null, 2));
  await browser.close();
})();
