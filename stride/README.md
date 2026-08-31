# Stride — GPS Run Tracker

A Strava-style running app that runs in your phone's browser. Records your route with
GPS, times the run, splits every kilometre, and keeps everything **on your device only**.

No backend, no account, no data leaving the phone.

---

## Get it on your phone (5 minutes)

GPS in a browser **requires HTTPS**, so the app has to be on a real URL — opening
`index.html` from Files/Finder on the phone will not give you location access.

### Fastest: Netlify Drop (free, no account needed to try)

1. Unzip `stride.zip` on your Mac.
2. Go to **https://app.netlify.com/drop** in Chrome.
3. Drag the whole **`stride` folder** onto the page.
4. You get a URL like `https://something-random.netlify.app` — open that on your phone.
5. Add to home screen:
   - **iPhone (Safari):** Share → *Add to Home Screen*
   - **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*
6. Launch it from the home-screen icon. Allow location when asked ("While using the app").

### Alternative: GitHub Pages

```bash
cd stride
git init && git add -A && git commit -m "Stride"
gh repo create stride --public --source=. --push
gh api -X POST repos/:owner/stride/pages -f source[branch]=main -f source[path]=/
# then: https://<your-username>.github.io/stride/
```

### Testing on your Mac first

```bash
cd stride
python3 -m http.server 8899
# open http://localhost:8899  (localhost counts as secure, GPS works)
```

---

## What it does

**Run tab**
- Live map with your route drawn as you move (dark or street map)
- Big HUD: distance, moving time, average pace, current pace (rolling 30 s)
- Auto km/mile splits with a "+0:13 slower / −0:13 faster vs last" ticker
- Spoken split announcements each km ("Kilometre 3, total time…, split pace…")
- Auto-pause when you stop moving; hold-to-finish so you can't end a run by accident
- Keeps the screen awake while running (Wake Lock)
- Crash recovery — if the browser dies mid-run it offers to restore

**History tab**
- "This week" snapshot up top: distance, runs, time, and a Mon–Sun mini bar chart
- The latest run gets a hero card — big route banner with start/end pins, stat row,
  and achievement chips; older runs listed with route thumbnails
- Month headers show the month's total distance
- Achievement badges (Strava-style trophies) on any run holding an all-time best:
  fastest 1K/5K/10K, longest run, best average pace
- Tap a run: stat hero (big distance + time/pace/elev), achievements banner, full map
  with start/end pins, split bars, pace-over-distance curve, elevation profile,
  fastest 1K/5K/10K inside that run
- Export any run as **GPX** (imports straight into Strava, Garmin Connect, etc.)

**Segments tab** — the Strava-premium bit
- Open any run → *Create segment from this run* → drag two sliders to pick the stretch
  (the map highlights it live and shows your time over it), name it, save
- Stride then scans **every run you have ever recorded** and logs an effort each time
  you covered that stretch
- Segment page: your personal leaderboard — every effort ranked fastest first with
  gold/silver/bronze medals for the top 3, PR crowned, gap to PR per row, and an
  effort-trend chart over time
- Every run's detail page lists the segments inside it with your rank ("2 of 7 efforts",
  or a PR badge)
- **Matched runs**: "You have run this route 5 times" — the same route detected
  automatically and every attempt ranked, with the run you are looking at highlighted

**Progress tab**
- Weekly distance goal ring (glowing as it fills) + "x km to go"
- Day streak, this month, all-time distance, total time on feet
- Consistency calendar: 8 weeks of day dots, shaded by distance (training-log style)
- Personal bests: 1K, 5K, 10K, longest run, best average pace
- 12-week distance bar chart with gridlines, labelled goal line and peak-week label

**Settings**
- km / miles, weekly goal, voice splits, auto-pause, screen wake, map style
- Export all runs as a JSON backup / import it back / delete everything

---

## Design

The visual system is "Midnight Athletic" — a near-black stack of layered surfaces with a
single signature accent.

```
ink        #07090C   page
surface    #10151B   cards (+1 inset highlight, hairline border)
surface-2  #171E26   raised controls
hair       rgba(255,255,255,.055)
lime       #C6FF3D   the only accent: actions, live state, PRs
ember      #FF5A36   effort, stop, heat
amber      #FFC53D   segments + achievements
silver     #E2E8F0   leaderboard 2nd
bronze     #F0A66E   leaderboard 3rd
text       #F2F6FA / #8494A5 / #5A6775
```

- **Type** — Barlow Condensed 700/800 for every figure that matters (distance, pace,
  splits, leaderboard times), tabular so numbers never jitter as they tick. UI text uses
  the platform font. Only the two condensed weights are bundled (~45 KB total), so the
  app stays fully offline and the type never flashes.
- **The run screen is the map.** The map fills the screen edge to edge; the stats sit in a
  dock that fades up out of it, with the trio panel and split ticker as frosted glass over
  the terrain. The dark map style is OpenStreetMap's free, keyless tiles inverted and
  desaturated with a CSS filter (CARTO's dark tiles now watermark without an API key),
  so the route line stays the brightest thing on screen — and the app needs no key at all.
- **Celebration layer.** Trophy chips on any run holding an all-time best, an achievements
  banner on the run page, gold/silver/bronze medals on every leaderboard, a "this week"
  snapshot above History, and an 8-week consistency calendar on Progress.
- **Pace-gradient route.** The line is coloured by how fast you were moving — deep olive
  through to near-white lime — normalised to the 10th–90th percentile of that run's own
  speeds, so it reads well whether you jogged or raced. Live on the run screen (chunked as
  you go, relative to your current average) and across the whole route on run detail, with
  a legend under the map.
- **Motion** — the distance figure eases rather than snapping, the route draws itself in
  when a run opens, the goal ring fills on entry, lists rise in with a 38 ms stagger, split
  bars grow in sequence, and everything springs on `cubic-bezier(.32,.72,0,1)`. All of it
  collapses to nothing under `prefers-reduced-motion`.
- **Grain.** A 3% fractal-noise overlay across the whole app, which is what stops large
  dark gradients from banding on OLED phones.

## How the GPS math works

- Fixes worse than **30 m accuracy** are discarded
- Movement faster than **11 m/s** (~40 km/h) is treated as a GPS jump and discarded
- Steps under **2.5 m** are treated as standing-still jitter and discarded
- Distance is accumulated with the haversine formula between accepted fixes
- Moving time is a real clock that pauses after **7 s** without movement (if auto-pause is on)
- Split times are linearly interpolated at the exact kilometre boundary, not snapped
  to the nearest GPS point
- Best 1K/5K/10K use a sliding window over the whole run, not just whole splits

## How segment matching works

Segment matching is the part that is easy to do badly. Stride:

- resamples the segment to 8 m nodes and indexes its edges in a 40 m spatial grid, so
  matching a run is a handful of lookups per GPS point rather than a full scan
- projects each GPS point onto the line **inside a window of expected progress**
  (25 m back, 200 m forward). This is what stops a looping segment from matching a
  later part of your run onto an earlier part of the line — the classic map-matching
  failure, and the bug that made my first version silently drop half the efforts
- allows you to be up to 25 m off the line, and to wander off for up to 70 m of running
  (bad fix, dodging a car) before it gives up on the effort
- requires 70% of the points across the effort to be on the line, and the distance you
  actually covered to be within 0.7–1.45× the segment length
- interpolates the exact start-line and finish-line crossing times from your local speed,
  so the effort time is not rounded to the nearest GPS point

Verified against five synthetic runs over one route with realistic correlated GPS drift:
all four repeat runs matched, ranked in the correct order, each within 2.2% of the
expected time — while a decoy 850 m away and a decoy on a parallel road 45 m to the side
were both correctly rejected.

Verified against a simulated 5.19 km run with 1,734 GPS fixes, including deliberately
injected bad fixes (low accuracy, 2 km teleport, standing jitter) — all three were
correctly rejected and the distance was unaffected.

---

## The one honest limitation

This is a web app, so **the browser pauses GPS when the screen locks or you switch apps.**
Keep the phone screen on with Stride in front while you run (it requests Wake Lock, but
iOS will still stop it if you hard-lock the phone).

If you want tracking that survives a locked screen and a pocket, that needs a native
app — the same logic ports to React Native/Expo, which is the natural v2.

---

## Files

```
index.html               the whole app (UI + tracking engine + analysis)
sw.js                    service worker: offline app shell + map tile cache
manifest.webmanifest     PWA install metadata
vendor/leaflet.js|css    map library, bundled locally so it works offline
icons/                   home-screen icons
vendor/fonts/            Barlow Condensed 700/800 (bundled, offline)
test/run-sim.js          replays a simulated 5 km run and screenshots every screen
test/smoke.js            fresh-install + short-run checks
test/seg-test.js         segment matching: 4 repeats ranked, 2 decoys rejected
```

Maps © OpenStreetMap contributors — free tile server, no API key required.
