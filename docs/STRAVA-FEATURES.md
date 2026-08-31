# Strava Feature Inventory (verified 2025–2026)

Compiled 2026-08-31 from Strava's official support/press pages and current press coverage (DC Rainmaker, TechRadar, BikeRadar, endurance.biz, The Running Channel, etc.). Pricing (US): ~$11.99/mo or $79.99/yr; Family Plan (up to 4 extra people, 2024); Strava + Runna bundle $149.99/yr (2025).

## Free tier

- **Activity recording** — GPS recording in the mobile app across 50+ sport types; unlimited activity uploads; sync from Garmin/Apple Watch/Wahoo/COROS etc.
- **Basic activity stats & analysis** — distance, time, pace/speed, splits, elevation, calories; activity detail page with map.
- **Activity feed** — see your own and followed athletes' activities; kudos, comments, photos/videos.
- **Segments (limited)** — segment detail pages, your own times, achievements (PR medals, KOM/QOM/CR if earned), **top-10 all-time leaderboard only** (full leaderboards went subscriber-only in the May 2020 paywall change); free users can create segments but can't see the full leaderboard on them.
- **Local Legends (limited)** — anyone can earn Local Legend status (most efforts on a segment in rolling 90 days) and gets top-10 notifications; the full effort leaderboard/graph is subscriber-only.
- **Beacon (app only)** — live location sharing with up to 3 contacts, free since 2021 when recording with the phone app (device-based Beacon is subscriber-only).
- **Gear tracking** — bikes and shoes with mileage, retirement alerts, automatic/default gear assignment per sport type. Free.
- **Global Heatmap** — the aggregate community heatmap is available to all users (Night/Weekly/Personal heatmaps are not).
- **Dark mode** — app-wide, rolled out 2024 to everyone (most-requested feature ever, per Camp Strava 2024).
- **Messaging** — DMs and group chats, launched Dec 2023, free for all.
- **Clubs & standard monthly challenges** — join/create clubs, community challenges with badges. (Custom **Group Challenges** moved behind the subscription in Aug 2024.)
- **Privacy controls** — privacy zones, activity/map visibility, who-can-message settings.
- **Basic maps/POIs for hiking (2025)** — a 2025 hiking update expanded the free tier with better maps and point-of-interest data.
- **Viewing others' shared Flyovers** — free users can view subscribers' shared Flyovers but can't generate their own.

## Premium tier (Strava Subscription, formerly Summit)

Segments & competition
- **Full segment leaderboards** — beyond top 10: overall, plus **filtered leaderboards** (today/this week/month/year, by age group, weight class, followers, club).
- **Segment efforts analysis** — compare your efforts over time, head-to-head comparisons, "My Segment Results".
- **Live Segments** — real-time on-segment race vs your PR/KOM/QOM on phone or connected device.
- **Local Legends (full)** — full effort leaderboard and progress graph.
- **Leaderboard integrity (2024–2025, platform-wide)** — ML model checks every upload against 57 factors to detect vehicle-recorded portions; auto-moves e-bike rides off ride/run leaderboards; 4.45M+ irregular activities removed (benefits everyone, driven for subscribers' KOM fairness).

Training & analytics
- **Training Log** — calendar/log visualization of all training.
- **Fitness & Freshness** — fitness/fatigue/form (CTL/ATL/TSB-style) curves from Relative Effort/HR/power.
- **Relative Effort** — cardiovascular load score per activity (HR- or perceived-exertion-based; successor of Suffer Score).
- **Custom Goals** — distance/time/elevation/power goals per week/month/year, plus segment goals.
- **Training Plans** — structured run/ride plans; plus Runna integration (Strava acquired Runna in 2025; race discovery → Runna plan via Groups/Events).
- **Workout Analysis / Pace Analysis / Power Analysis** — pace-zone lap breakdowns, running pace zones, power curve and power zone analytics.
- **Custom Heart Rate Zones** — personalized zones + time-in-zone per activity.
- **Training Zones (Sept 2025)** — time spent in HR/pace/power zones aggregated over time periods.
- **Power Skills (Sept 2025)** — from The Breakaway acquisition: personal power records across 12 intervals, strengths/weaknesses profile (cycling).
- **Grade Adjusted Pace (GAP)** — hill-corrected running pace.
- **Best Efforts** — estimated fastest 1K/1 mile/5K/10K/etc. per run, with PR trends over time.
- **Matched Activities** — auto-groups repeated runs/rides on the same route to show progression.
- **Performance Predictions (Apr 2025)** — ML race-time predictions for 5K/10K/half/marathon (100+ data points, needs ~20 runs in 24 weeks; assumes flat course), in the Progress tab.
- **Athlete Intelligence (2024, AI)** — AI-generated plain-language activity summaries and feedback; weekly intent setting (Push/Maintain/Recover/Have Fun).

Maps, routes & recording
- **Route Builder + Suggested Routes** — web + redesigned mobile builder (2025) with surface type, grade and elevation previews, waypoints; AI/heatmap-powered route suggestions from any start point; **point-to-point routing** (July 2025) using heatmaps + ML.
- **Offline routes/maps** — download routes for offline use; offline navigation and **off-route alerts** (2025, hiking update); **Route Discovery** and cinematic route previews for subscribers.
- **Personal Heatmap** — all your own activities on one interactive map.
- **Night Heatmap (2024)** — community heat from sunset–sunrise activities only (safety for night runners).
- **Weekly Heatmap (2024)** — community heat from the last 7 days (current trail conditions).
- **Flyover (Nov 2023)** — 3D aerial video replay of any GPS activity (FATMAP tech), with stats overlay and off-platform sharing (2024); subscriber-only to create.
- **Beacon on devices** — live tracking when recording from Garmin/Apple Watch/Wahoo.
- **Weather on activities** — conditions (temp, wind, etc.) attached to completed activities.

Other
- **Group Challenges** — private challenges with friends (subscriber-only since Aug 2024).
- **Recover Athletics** — injury-prevention/prehab content.
- **Perks, custom app icons (iOS), priority support.**
- **Family Plan (2024)** — share an annual sub with up to 4 others.

## Social

- **Kudos** — like button for activities (free).
- **Comments** — on activities; @mentions (free).
- **Photos/videos** — media on activities, feed highlight photos (free).
- **Activity feed** — followers model (asymmetric follow), grouped activities when athletes record together (free).
- **Clubs** — join/create, club feeds, club leaderboards, club events; Events tab with Runna race database (2025–26) (free).
- **Messaging** — 1:1 and group chats (free, Dec 2023).
- **Challenges** — community/monthly challenges (free); Group Challenges (paid).
- **Beacon** — live location to 3 safety contacts (free in app).
- **Segments/leaderboards/Local Legends** — competition as a social layer (mixed tier, see above).
- **Sharing** — share cards to Instagram etc.; Flyover sharing (subscriber to create).

## Implementability table

Context: local-only web app — no backend, no accounts, single user, browser GPS, IndexedDB, Leaflet + free OSM tiles, keyless free APIs (e.g. Open-Meteo) allowed. "Already built" in Stride: distance/pace/splits/segments/PRs.

| Feature | Strava tier | Feasibility | Notes |
|---|---|---|---|
| GPS activity recording | Free | IMPLEMENTABLE | `watchPosition` + wake lock; already the app's core |
| Distance/pace/splits/elevation | Free | IMPLEMENTABLE | Already built (splits/pace); elevation via Open-Meteo/Open-Elevation keyless APIs or device altitude |
| Sport types | Free | IMPLEMENTABLE | Enum on activity |
| Activity detail map | Free | IMPLEMENTABLE | Leaflet polyline; already standard |
| Activity feed | Free | PARTIALLY | Single-user timeline of own activities; no social content |
| Photos on activities | Free | IMPLEMENTABLE | Store blobs in IndexedDB; size-capped |
| Segments (create + auto-match own efforts) | Free/Paid mix | IMPLEMENTABLE | Already built; matching = point-to-polyline proximity |
| Segment leaderboards (global) | Paid | NOT FEASIBLE | Needs other users → replace with **personal effort leaderboard** per segment (PARTIALLY) |
| Filtered leaderboards | Paid | NOT FEASIBLE | No population to filter |
| Local Legends | Free/Paid mix | PARTIALLY | Personal variant: "most-repeated segment/route in rolling 90 days" streak crown |
| Live Segments | Paid | PARTIALLY | Race a **ghost of your own PR** in real time — fully computable locally |
| Leaderboard integrity / anomaly detection | Platform | PARTIALLY | Single-user version = GPS glitch/vehicle-speed filtering on import (useful data hygiene) |
| KOM/QOM/CR | Free (earn) | NOT FEASIBLE | Community ranking |
| Beacon (live tracking) | Free app / Paid device | NOT FEASIBLE | Requires a relay server for contacts to see live position |
| Messaging, kudos, comments, clubs | Free | NOT FEASIBLE | Social graph required |
| Group Challenges | Paid | NOT FEASIBLE | Multi-user; **self-challenges** (auto monthly distance/streak targets) = PARTIALLY |
| Monthly community challenges | Free | PARTIALLY | Local auto-generated challenges vs yourself with badges |
| Gear tracking | Free | IMPLEMENTABLE | Shoes with cumulative km + retirement alert at ~600–800 km; default gear per sport |
| Training Log (calendar) | Paid | IMPLEMENTABLE | Pure local computation; high value |
| Fitness & Freshness | Paid | IMPLEMENTABLE | CTL/ATL/TSB exponential decay over a daily load score (TRIMP from HR, or pace/duration-based estimate) |
| Relative Effort | Paid | PARTIALLY | Exact version needs HR (Web Bluetooth HR strap works keyless in Chromium; else GAP-weighted duration estimate) |
| Custom HR zones + time-in-zone | Paid | PARTIALLY | Only when HR data exists (BLE strap or imported FIT/GPX/TCX) |
| Training Zones (time-in-zone trends) | Paid (2025) | PARTIALLY | Same HR/pace-data dependency; pace zones fully implementable |
| Pace zones / workout analysis | Paid | IMPLEMENTABLE | Zones from threshold pace; lap/split breakdowns local |
| Power analysis / Power Skills | Paid | NOT FEASIBLE | Needs power meter hardware + cycling focus; out of scope for run tracker |
| Grade Adjusted Pace (GAP) | Paid | IMPLEMENTABLE | Grade from elevation profile + published GAP curve (Minetti-style polynomial) |
| Custom goals (distance/time/elevation) | Paid | IMPLEMENTABLE | Weekly/monthly/annual roll-ups vs target; trivial locally |
| Training plans | Paid | PARTIALLY | Ship static templated plans (C25K, 10K, HM); adaptive coaching is a large rule-engine effort |
| Best Efforts + trends | Paid | IMPLEMENTABLE | Rolling-window fastest 1K/1mi/5K/10K per run (PRs already built; add per-distance trend charts) |
| Matched Activities | Paid | IMPLEMENTABLE | Cluster own activities by route similarity (start point + polyline distance); progression chart |
| Performance Predictions | Paid (2025) | PARTIALLY | Riegel/VO2max-formula predictor from best efforts — simpler than Strava's ML but credible |
| Athlete Intelligence (AI summaries) | Paid (2024) | PARTIALLY | No free LLM API keyless; rule-based/template insight engine ("longest run in 6 weeks, HR lower at same pace") works well |
| Route builder | Paid | PARTIALLY | Manual draw fully local; snapped routing needs a free engine (OSRM demo/BRouter public instances — keyless but rate-limited, no SLA) |
| Suggested routes / point-to-point AI routing | Paid (2025) | NOT FEASIBLE | Powered by community heatmap + ML; simple engine-generated loops = PARTIALLY |
| Offline maps/routes | Paid | PARTIALLY | Cache tiles in IndexedDB for a route corridor; bulk pre-download conflicts with OSM tile usage policy |
| Off-route alerts | Paid (2025) | IMPLEMENTABLE | Live distance-from-planned-polyline check, vibrate/beep |
| Personal Heatmap | Paid | IMPLEMENTABLE | All own polylines rendered translucent on Leaflet (canvas renderer scales fine for one user) |
| Night Heatmap | Paid (2024) | PARTIALLY | Personal variant: filter own activities to sunset–sunrise (SunCalc, local); community version impossible |
| Weekly Heatmap | Paid (2024) | PARTIALLY | Personal last-7-days layer trivially; community version impossible |
| Global Heatmap | Free | NOT FEASIBLE | Aggregated community data |
| Flyover (3D replay) | Paid | PARTIALLY | 2D animated replay on Leaflet is easy; 3D possible with MapLibre GL + free AWS terrain tiles but heavy |
| Weather on activities | Paid | IMPLEMENTABLE | Open-Meteo historical/forecast API — keyless, free, ideal fit |
| Dark mode (+ dark map tiles) | Free (2024) | IMPLEMENTABLE | CSS tokens + free dark basemap (e.g. CARTO dark tiles w/ attribution) |
| Stats/progress screens, Year in Sport | Free/Paid mix | IMPLEMENTABLE | Weekly/monthly/yearly aggregates, streaks, personal "wrapped" |
| Perks / Recover Athletics / Family Plan / priority support | Paid | NOT FEASIBLE | Commercial partnerships, N/A |

## Top 10 recommended features to implement in a local-only run tracker

Ranked by user value × feasibility. (Already built and excluded from ranking: distance/pace/splits, segments, PRs.)

1. **Training Log + weekly/monthly stats calendar** — the #1 reason runners pay for Strava; pure local computation over IndexedDB, huge daily-retention value.
2. **Personal heatmap (with night + last-7-days filters)** — iconic, visually rewarding, one Leaflet canvas layer over data you already store; the filters come almost free via SunCalc/date filter.
3. **Fitness & Freshness (fitness/fatigue/form)** — flagship premium analytic; a well-known exponential-decay model over a per-run load score, entirely offline.
4. **Grade Adjusted Pace** — makes every hilly run's pace meaningful; needs only elevation profile + a published polynomial; also feeds Relative Effort and load scores.
5. **Goals + auto self-challenges** — weekly/monthly/annual distance-time-elevation targets with progress rings and badges; trivial to build, strong habit loop.
6. **Best Efforts trend charts** — extend existing PRs into rolling-window fastest 1K/1mi/5K/10K per activity with per-distance trend lines and "new best effort" celebrations.
7. **Weather on activities** — premium-tier polish for one keyless Open-Meteo call at save time (temp, wind, humidity stamped on each run).
8. **Ghost racing / personal Live Segments** — real-time audio/visual pace vs your own PR on a segment or matched route; the most exciting use of live GPS a single-user app can offer.
9. **Matched runs** — auto-group repeat routes and chart progression ("this loop, 12th time, 2nd fastest"); high perceived intelligence, moderate geometry work.
10. **Race-time predictor (Riegel-based Performance Predictions)** — 5K→marathon estimates from best efforts, updating after each run; simpler than Strava's ML but delivers the same "am I ready?" answer.

Honorable mentions: 2D activity replay ("Flyover lite"), off-route alerts on planned routes, rule-based "Athlete Intelligence" insight cards, gear/shoe mileage tracking (cheap and practical).

## Sources

- [Strava Subscription Features — Strava Support](https://support.strava.com/hc/en-us/articles/216917657-Strava-Subscription-Features)
- [A Guide to Strava Heatmaps — Strava Support](https://support.strava.com/en-us/articles/16046277-a-guide-to-strava-heatmaps)
- [Performance Predictions — Strava Support](https://support.strava.com/hc/en-us/articles/35272903405965-Performance-Predictions) / [endurance.biz](https://endurance.biz/2025/industry-news/performance-predictions-strava-adds-race-time-prediction-feature-for-subscribers/)
- [Flyover — Strava Support](https://support.strava.com/hc/en-us/articles/19900004650125-Flyover) / [TechCrunch launch coverage](https://techcrunch.com/2023/11/15/strava-launches-flyover-an-aerial-3d-video-recap-of-every-outdoor-activity-you-do/)
- [Camp Strava 2024: Athlete Intelligence, heatmaps, dark mode — Strava Stories](https://stories.strava.com/articles/athlete-intelligence-new-heatmaps-dark-mode-and-more-the-major-announcements) / [The Running Channel](https://therunningchannel.com/strava-updates-2024-night-heatmaps-ai-dark-mode/) / [TechCrunch](https://techcrunch.com/2024/05/16/strava-taps-ai-to-weed-out-leaderboard-cheats-unveils-family-plan-dark-mode-and-more)
- [2025 training/routing/leaderboard-integrity updates — Strava Press](https://press.strava.com/articles/strava-continues-to-accelerate-innovation-with-new-features-designed-for) / [endurance.biz](https://endurance.biz/2026/industry-news/strava-targets-leaderboard-accuracy-and-rolls-out-navigation-and-club-event-updates/) / [the5krunner](https://the5krunner.com/2025/02/27/new-strava-releases-further-details-about-how-they-protect-leaderboard-integrity/)
- [Strava Expands Mapping Tools with Night and Weekly Heatmaps — Strava Press](https://press.strava.com/articles/strava-expands-mapping-tools-with-night-and-weekly-heatmaps)
- [Local Legends — DC Rainmaker](https://www.dcrainmaker.com/2020/06/strava-legends-feature.html) / [BikeRadar](https://www.bikeradar.com/news/strava-local-legend)
- [Beacon free for all users — Engadget](https://www.engadget.com/strava-beacon-feature-available-free-users-160045955.html) / [Canadian Cycling (device caveat)](https://cyclingmagazine.ca/sections/news/strava-made-its-beacon-a-free-feature-but-there-is-a-catch/)
- [Segment paywall changes — Cyclist](https://www.cyclist.co.uk/news/apps-maps-and-training-software/strava-removes-segment-features-for-free-users) / [Strava Developers](https://developers.strava.com/docs/segment-changes/)
- [Messaging launch — DC Rainmaker](https://www.dcrainmaker.com/2023/12/messaging-feature-minutes.html) / [BikeRadar](https://www.bikeradar.com/news/you-can-finally-send-direct-and-group-messages-on-strava)
- [Gear tracking — Strava Support](https://support.strava.com/hc/en-us/articles/216918727-Adding-Gear-to-Your-Activities-on-Strava) / [DC Rainmaker](https://www.dcrainmaker.com/2023/05/stravas-automatic-tracking.html)
- [Runna/adidas platform moves — SGI Europe](https://www.sgieurope.com/fitness/stravas-bigger-platform-play/122208.article) / [Runna acquisition FAQ](https://support.runna.com/en/articles/11093973-strava-runna-acquisition-faqs)
- [Free vs paid comparisons — Wareable](https://www.wareable.com/sport/is-strava-premium-worth-it) / [biketips](https://biketips.com/strava-free-vs-paid/) / [Android Authority](https://www.androidauthority.com/strava-membership-3231073/)
