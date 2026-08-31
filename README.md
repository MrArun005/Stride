# Stride

A Strava-style GPS run tracker that runs entirely in the browser. Records your route,
times the run, splits every kilometre, matches segments, and keeps everything
**on your device only** — no backend, no account, no API keys, no cost.

Two apps live in this repo:

| Folder | What it is |
|---|---|
| [`stride/`](stride/) | **v1** — the original app: a single-file PWA (`index.html`), zero dependencies beyond a bundled Leaflet. Drag the folder onto Netlify Drop and it runs. |
| [`stride-react/`](stride-react/) | **v2** — the same app rebuilt as a Vite + React + TypeScript project, plus Strava-premium-style features: Fitness & Freshness, personal heatmap, Grade Adjusted Pace, race predictor, gear (shoe) tracking, and weather stamps. |

## Quick start

**v1 (vanilla PWA)**
```bash
cd stride
python3 -m http.server 8899   # or any static server
# open http://localhost:8899 — localhost counts as secure, GPS works
```

**v2 (React)**
```bash
cd stride-react
npm install
npm run dev        # develop
npm run build      # production build in dist/
```

GPS in a browser requires HTTPS (or localhost), so to use it on a phone deploy to
Netlify Drop, Vercel, or GitHub Pages — all free.

## Feature research

[`docs/STRAVA-FEATURES.md`](docs/STRAVA-FEATURES.md) is a full breakdown of Strava's
free and premium feature set (as of 2025–2026) with an implementability analysis for
a local-only app — the roadmap this project builds from.

## Design

The visual system is **"Midnight Athletic"** — a near-black stack of layered surfaces,
Barlow Condensed for every number that matters, and a single signature lime accent
(`#C6FF3D`). Full design notes in [`stride/README.md`](stride/README.md).

Maps © OpenStreetMap contributors (free tile server, no API key).
Weather by Open-Meteo (free, keyless).
