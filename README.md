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
