# /vendor — local copies of third-party libraries

The loader (`js/loader.js`) tries these vendored files **first** and falls back
to a pinned CDN if a file is missing (R1.2). The app therefore runs from CDN
out of the box; vendoring is preferred for institutional networks and
reproducibility (tech.md) and for fully offline use.

No build step is involved — these are plain browser files. Do **not** commit
`node_modules`; copy only the files listed below.

## Pinned versions
See `VERSIONS` in `js/loader.js`:

- `@mediapipe/tasks-vision` — `0.10.22-rc.20250304`
- `@vladmandic/face-api` — `1.7.14`
- `chart.js` — `4.5.0`

## Expected layout

```
vendor/
  mediapipe/
    vision_bundle.mjs          # from @mediapipe/tasks-vision
    wasm/                      # entire wasm/ folder from the same package
      vision_wasm_internal.js
      vision_wasm_internal.wasm
      ...
    face_landmarker.task       # float16 model
  face-api/
    face-api.esm.js            # from @vladmandic/face-api dist
    model/                     # tiny_face_detector + face_expression weights
      tiny_face_detector_model-weights_manifest.json
      tiny_face_detector_model-shard1
      face_expression_model-weights_manifest.json
      face_expression_model-shard1
  chartjs/
    chart.umd.js               # from chart.js dist
```

## How to fetch (pick one, run once, on a machine with internet)

These are one-off downloads of static files. They are not a build step and are
not required to run the app.

### MediaPipe Tasks Vision + Face Landmarker model
- `vision_bundle.mjs` and `wasm/`:
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/`
- `face_landmarker.task` (float16):
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

### face-api (vladmandic)
- ESM build:
  `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.esm.js`
- Model weights (`tiny_face_detector`, `face_expression`):
  from the package `model/` directory or the project's GitHub `model/` folder.

### Chart.js
- `https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js`

If any file above is absent, the loader logs a warning and uses the CDN URL for
that asset only.
