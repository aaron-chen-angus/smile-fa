# SMILE-FA — Facial Asymmetry Screen (Kiro spec pack)

Open this folder as a Kiro workspace. Kiro reads `.kiro/steering/` and `.kiro/specs/smile-facial-asymmetry/` (requirements → design → tasks).

- `docs/01_Clinical_Basis_and_Protocol.md` — clinician practice, protocol, output logic, emotion caveats, validation plan
- `docs/02_Data_Dictionary.md` — every metric: ID, formula, landmarks, unit, provisional thresholds, clinical basis
- `.kiro/steering/tech.md` — no-install, no-Node constraints
- `.kiro/specs/.../requirements.md | design.md | tasks.md`

Start Kiro with: "Implement tasks T-01 to T-04 from the smile-facial-asymmetry spec."

---

## Running the app (Phase 1 build)

This is a static, no-build web app (plain HTML/CSS/JS ES modules). It needs a
**secure origin** for the camera: HTTPS or `http://localhost`. Opening the files
directly with `file://` will not work (ES module, WASM and model fetches fail).

Pages:
- `index.html` — app shell (screens S0–S6)
- `debug.html` — landmark index overlay (T-03 verification)
- `selftest.html` — side-convention self-test (T-04 verification)

Third-party libraries and models load from CDN by default, so an empty
`vendor/` folder is fine for a first test. See `vendor/README.md` to vendor
local copies later.

### Test locally (optional)
Use any static server over localhost, for example:

- VS Code "Live Server" extension → "Go Live".
- Or a one-line static server if you have Python installed:
  `python -m http.server 8080` then open `http://localhost:8080/`.

### Deploy to GitHub Pages
1. Create a new GitHub repository and upload the contents of this `smile-fa/`
   folder (so `index.html` is at the repo root, or inside a folder you point
   Pages at).
2. Repo **Settings → Pages → Build and deployment**: Source = "Deploy from a
   branch", Branch = `main`, folder = `/ (root)`. Save.
3. Wait for the Pages build, then open the published `https://<user>.github.io/<repo>/`.
4. Verify on the live site: `debug.html` (indices), then `selftest.html`
   (wink LEFT must register patient LEFT). Only then set `verified: true` in
   `config/landmarks.json` and confirm `blendshapes.side_map`.

`.nojekyll` is included so Pages serves all files (including `vendor/`) as-is.

---

## Full app build (T-05–T-23 complete)

The app now runs end-to-end: welcome/consent → live setup gating → guided
protocol (P1–P9) with voice + pictograms → on-device analysis → public
traffic-light result + clinician metrics/emotion view → save baseline / export.

Everything is vanilla HTML/CSS/JS ES modules — no build step. Libraries
(MediaPipe Tasks Vision, face-api, Chart.js) load from CDN by default with
`/vendor` fallback.

### Verify the engine (do this after deploying)
Open `tests.html` on the live HTTPS site (or localhost). It runs the pure-engine
unit tests (One Euro filter, head-frame + mm scale, quality gates, frame/phase
metrics, composites) with synthetic data and shows green/red per case. These
tests need no camera or network. If any fail, note which and they can be fixed.

> Engine verification is browser-only here because the build environment has no
> Node/JS runtime (institutional constraint). `tests.html` is the intended
> verification path (spec R10.3).

### Pages
- `index.html` — the app
- `tests.html` — engine unit tests
- `debug.html` — landmark index overlay
- `selftest.html` — side-convention self-test (already passed on deploy)

### Status / caveats
- Thresholds in `config/thresholds.json` are **provisional** (D4) and must be
  calibrated from a normative study before any clinical interpretation.
  Labelled "research use only" throughout.
- Emotion/expression is a synchronised, labelled stream only and never feeds
  the asymmetry score (D5).
