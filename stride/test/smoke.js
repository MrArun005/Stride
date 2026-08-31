const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true,
    permissions:['geolocation'], geolocation:{latitude:12.9716, longitude:77.5946} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('requestfailed', r => errs.push('REQFAIL ' + r.url().slice(0,60)));
  page.on('response', r => { if(r.status() >= 400) errs.push('HTTP' + r.status() + ' ' + r.url().slice(0,70)); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'load' });
  await page.waitForFunction(() => !!window.__stride);
  await page.waitForTimeout(600);
  await page.screenshot({ path:'/root/stride/test/shots/10-firstrun.png' });
  // fresh-state progress + history
  await page.click('#tabbar button[data-tab="progress"]'); await page.waitForTimeout(300);
  await page.screenshot({ path:'/root/stride/test/shots/11-progress-empty.png' });
  await page.click('#tabbar button[data-tab="history"]'); await page.waitForTimeout(300);
  await page.screenshot({ path:'/root/stride/test/shots/12-history-empty.png' });
  // short run: 30 fixes, then finish -> should save
  await page.click('#tabbar button[data-tab="run"]'); await page.waitForTimeout(200);
  const out = await page.evaluate(async () => {
    const S = window.__stride, T = S.T;
    S.startRun(); await new Promise(r=>setTimeout(r,80));
    const t0 = Date.now(); let y = 0, ms = 0;
    for(let i=0;i<80;i++){ y += 3; ms += 900; T.movingMs = ms;
      S.onPosition({coords:{latitude:12.9716+y/111320,longitude:77.5946,altitude:920,accuracy:6},timestamp:t0+ms}); }
    await new Promise(r=>setTimeout(r,400));
    const hud = document.getElementById('hDist').textContent;
    await S.finishRun(); await new Promise(r=>setTimeout(r,400));
    const r0 = S.RUNS()[0];
    return { hud, saved: r0 ? {dist:r0.dist, sec:r0.movingSec, splits:r0.splits.length} : null, count:S.RUNS().length };
  });
  // GPX export sanity
  const gpx = await page.evaluate(() => {
    const r = window.__stride.RUNS()[0];
    return r.points.length + '|' + r.points[0].lat;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path:'/root/stride/test/shots/13-short-detail.png' });
  console.log(JSON.stringify({ out, gpx, errs }, null, 1));
  await b.close();
})();
