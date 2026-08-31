const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true,
    permissions:['geolocation'], geolocation:{latitude:12.9716, longitude:77.5946} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'load' });
  await page.waitForFunction(() => !!window.__stride);

  const res = await page.evaluate(async () => {
    const S = window.__stride;
    // deterministic PRNG
    const rng = seed => () => (seed = (seed*1664525 + 1013904223) % 4294967296) / 4294967296;
    const lat0 = 12.9716, lng0 = 77.5946;
    const kx = Math.cos(lat0*Math.PI/180);
    const mLat = m => m/111320, mLng = m => m/(111320*kx);

    // one true path, 4000 m, deterministic
    const path = [];
    { let x=0,y=0,h=0;
      for(let d=0; d<=4000; d+=3){
        h += Math.sin(d/260)*0.05 + Math.sin(d/95)*0.012;
        x += Math.cos(h)*3; y += Math.sin(h)*3;
        path.push({x,y,d});
      } }

    const mkRun = (id, paceSecPerKm, seed, offX, offY) => {
      const r = rng(seed);
      const pts = []; let cum = 0;
      let ex = 0, ey = 0;                       // correlated GPS drift, like the real thing
      for(let i=0;i<path.length;i++){
        ex = ex*0.985 + (r()-0.5)*1.6; ey = ey*0.985 + (r()-0.5)*1.6;
        const nx = path[i].x + offX + ex*1.5, ny = path[i].y + offY + ey*1.5;
        const p = { lat: lat0 + mLat(ny), lng: lng0 + mLng(nx), alt: 920, t: id + i*1000 };
        if(i>0){ const q=pts[i-1];
          const dLat=(p.lat-q.lat)*111320, dLng=(p.lng-q.lng)*111320*kx;
          cum += Math.hypot(dLat,dLng); }
        p.d = Math.round(cum);
        p.m = Math.round(cum/1000*paceSecPerKm*1000);
        pts.push(p);
      }
      const dist = pts[pts.length-1].d, ms = pts[pts.length-1].m;
      return { id, startedAt:id, endedAt:id+ms, dist, movingSec:Math.round(ms/1000),
        elapsedSec:Math.round(ms/1000), points:pts, splits:[], elevGain:0, elevLoss:0,
        unit:'km', name:'Test Run' };
    };
    const day = 864e5, now = Date.now();
    const runs = [
      mkRun(now-4*day, 300, 11, 0, 0),
      mkRun(now-3*day, 285, 22, 0, 0),
      mkRun(now-2*day, 320, 33, 0, 0),
      mkRun(now-1*day, 305, 44, 0, 0),
      mkRun(now-5*day, 300, 55, 600, 600),  // decoy A: same shape, 850 m away
      mkRun(now-6*day, 300, 66, 45, 0)      // decoy B: parallel road 45 m to the side
    ];
    for(const r of runs) await S.DB.put('runs', r);
    await S.loadRuns();

    // build a segment from run[0], 1000 m -> 2500 m
    const base = runs[0];
    const segPts = base.points.filter(p => p.d >= 1000 && p.d <= 2500).map(p => ({lat:p.lat, lng:p.lng}));
    const seg = { id: 900001, name:'Test Straight', points:segPts, length:1500, createdAt:Date.now(), fromRunId:base.id };
    await S.DB.put('segments', seg);
    await S.loadSegments();
    const added = await S.matchSegments(S.RUNS(), [seg]);

    const eff = S.EFFORTS().filter(e => e.segId === seg.id)
      .map(e => ({ runId:e.runId, dur:Math.round(e.dur), startD:e.startD, endD:e.endD }))
      .sort((a,b) => a.dur - b.dur);
    const expect = { [runs[0].id]:450, [runs[1].id]:427, [runs[2].id]:480, [runs[3].id]:457 };
    const check = eff.map(e => ({ dur:e.dur, want:expect[e.runId] || 'DECOY-SHOULD-NOT-MATCH',
      errPct: expect[e.runId] ? +(100*(e.dur-expect[e.runId])/expect[e.runId]).toFixed(1) : null }));

    const mr = S.matchedRuns(runs[1]).map(r => r.id);
    return { added, efforts:check, decoyMatched: eff.some(e => e.runId === runs[4].id),
      matchedRunsCount: mr.length, decoyInMatched: mr.includes(runs[4].id), totalRuns:S.RUNS().length };
  });

  // screenshots
  await page.click('#tabbar button[data-tab="segments"]'); await page.waitForTimeout(500);
  await page.screenshot({ path:'/root/stride/test/shots/20-segments.png' });
  await page.click('.seg-card'); await page.waitForTimeout(1100);
  await page.screenshot({ path:'/root/stride/test/shots/21-segment-detail.png' });
  await page.evaluate(() => document.getElementById('segBody').scrollTop = 400);
  await page.waitForTimeout(300);
  await page.screenshot({ path:'/root/stride/test/shots/22-segment-trend.png' });
  await page.evaluate(() => document.getElementById('segSheet').classList.remove('open'));
  await page.click('#tabbar button[data-tab="history"]'); await page.waitForTimeout(400);
  await page.click('.run-card'); await page.waitForTimeout(1000);
  await page.evaluate(() => document.getElementById('detailBody').scrollTop = 1600);
  await page.waitForTimeout(400);
  await page.screenshot({ path:'/root/stride/test/shots/23-run-segments.png' });
  // creator
  await page.evaluate(() => { const b = document.getElementById('btnMakeSeg'); if(b) b.click(); });
  await page.waitForTimeout(1100);
  await page.screenshot({ path:'/root/stride/test/shots/24-creator.png' });

  console.log(JSON.stringify({ res, errs }, null, 1));
  await b.close();
})();
