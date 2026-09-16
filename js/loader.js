/**
 * SMILE-FA — loader.js
 *
 * Loads third-party libraries as browser files only (no bundler, no npm).
 * Preference order for every dependency: vendored copy in /vendor first, then
 * a pinned CDN fallback (R1.2). Also provides the HTTPS / secure-origin check
 * required before camera access (R1.3, R1.1).
 *
 * Library shapes:
 *   - MediaPipe Tasks Vision: ESM  -> dynamic import()
 *   - @vladmandic/face-api:    ESM  -> dynamic import()
 *   - Chart.js:                UMD  -> injected <script>, reads window.Chart
 *
 * All versions are PINNED (tech.md). Update the constants below deliberately.
 * @module loader
 */

/* ---- Pinned versions (tech.md: pinned libraries) ---------------------- */
export const VERSIONS = Object.freeze({
  tasksVision: '0.10.22-rc.20250304', // @mediapipe/tasks-vision
  faceApi: '1.7.14',                  // @vladmandic/face-api
  chartJs: '4.5.0',                   // chart.js (UMD)
});

/* ---- Vendored paths (preferred) --------------------------------------- */
const VENDOR = Object.freeze({
  tasksVision: 'vendor/mediapipe/vision_bundle.mjs',
  tasksVisionWasm: 'vendor/mediapipe/wasm',
  faceLandmarkerModel: 'vendor/mediapipe/face_landmarker.task',
  faceApi: 'vendor/face-api/face-api.esm.js',
  faceApiModels: 'vendor/face-api/model',
  chartJs: 'vendor/chartjs/chart.umd.js',
});

/* ---- CDN fallbacks (pinned) ------------------------------------------- */
const CDN = Object.freeze({
  tasksVision: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSIONS.tasksVision}/vision_bundle.mjs`,
  tasksVisionWasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSIONS.tasksVision}/wasm`,
  faceLandmarkerModel:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  faceApi: `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSIONS.faceApi}/dist/face-api.esm.js`,
  faceApiModels: `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSIONS.faceApi}/model`,
  chartJs: `https://cdn.jsdelivr.net/npm/chart.js@${VERSIONS.chartJs}/dist/chart.umd.js`,
});

/**
 * Where each asset was actually loaded from ('vendor' | 'cdn'), for debug.html
 * and the model_versions metadata (M04). Populated as modules load.
 * @type {Record<string, 'vendor'|'cdn'|undefined>}
 */
export const loadSource = {};

/* ======================================================================
 * Secure-origin / HTTPS check (R1.1, R1.3)
 * ==================================================================== */

/**
 * True when the page can access getUserMedia: HTTPS, or a localhost/loopback
 * dev origin, or a packaged app. `file://` is explicitly not secure for our
 * ES module + WASM + model fetches (tech.md), and is reported as insecure.
 * @returns {boolean}
 */
export function isSecureContextForCamera() {
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return true;
  const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
  if (protocol === 'http:' && localHosts.includes(hostname)) return true;
  // Fall back to the platform's own notion of a secure context.
  return typeof window.isSecureContext === 'boolean' ? window.isSecureContext : false;
}

/**
 * Throw a descriptive Error if the origin cannot use the camera (R1.3).
 * Callers show this message to the user.
 * @returns {void}
 */
export function assertSecureContextForCamera() {
  if (isSecureContextForCamera()) return;
  const isFile = window.location.protocol === 'file:';
  const detail = isFile
    ? 'Opening the file directly (file://) is not supported. Serve it over HTTPS or http://localhost.'
    : 'Camera access requires a secure origin (HTTPS).';
  throw new Error(`${detail} Deploy to GitHub Pages (HTTPS) or run a local HTTPS/localhost server.`);
}

/* ======================================================================
 * Low-level helpers
 * ==================================================================== */

/**
 * HEAD-probe a URL to decide whether a vendored file exists. Returns false on
 * any network error or non-OK status so the caller can fall back to CDN.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Dynamically import an ESM module, preferring the vendored URL and falling
 * back to the CDN URL if the vendored import fails.
 * @param {string} key           loadSource key to record provenance under
 * @param {string} vendorUrl
 * @param {string} cdnUrl
 * @returns {Promise<any>} the imported module namespace
 */
async function importEsmWithFallback(key, vendorUrl, cdnUrl) {
  if (await urlExists(vendorUrl)) {
    try {
      const mod = await import(/* @vite-ignore */ vendorUrl);
      loadSource[key] = 'vendor';
      return mod;
    } catch (err) {
      console.warn(`[loader] vendored ${key} failed to import, falling back to CDN`, err);
    }
  }
  const mod = await import(/* @vite-ignore */ cdnUrl);
  loadSource[key] = 'cdn';
  return mod;
}

/**
 * Inject a classic (UMD) script and resolve once it has executed. Prefers the
 * vendored URL, falls back to the CDN URL on error.
 * @param {string} key
 * @param {string} vendorUrl
 * @param {string} cdnUrl
 * @returns {Promise<void>}
 */
function injectScriptWithFallback(key, vendorUrl, cdnUrl) {
  return new Promise((resolve, reject) => {
    const tryLoad = (url, source, onFail) => {
      const el = document.createElement('script');
      el.src = url;
      el.async = true;
      el.onload = () => {
        loadSource[key] = source;
        resolve();
      };
      el.onerror = () => {
        el.remove();
        onFail();
      };
      document.head.appendChild(el);
    };
    tryLoad(vendorUrl, 'vendor', () => {
      console.warn(`[loader] vendored ${key} failed to load, falling back to CDN`);
      tryLoad(cdnUrl, 'cdn', () => reject(new Error(`Failed to load ${key} from vendor and CDN`)));
    });
  });
}

/* ======================================================================
 * Public loaders
 * ==================================================================== */

/**
 * Load the MediaPipe Tasks Vision ESM module and resolve the matching WASM
 * fileset root (vendor or CDN, matched to wherever the module came from).
 * @returns {Promise<{ vision: any, wasmBase: string }>}
 */
export async function loadTasksVision() {
  const vision = await importEsmWithFallback('tasksVision', VENDOR.tasksVision, CDN.tasksVision);
  const wasmBase = loadSource.tasksVision === 'vendor' ? VENDOR.tasksVisionWasm : CDN.tasksVisionWasm;
  return { vision, wasmBase };
}

/**
 * Resolve the Face Landmarker model URL, preferring the vendored .task file.
 * @returns {Promise<string>}
 */
export async function resolveFaceLandmarkerModel() {
  if (await urlExists(VENDOR.faceLandmarkerModel)) {
    loadSource.faceLandmarkerModel = 'vendor';
    return VENDOR.faceLandmarkerModel;
  }
  loadSource.faceLandmarkerModel = 'cdn';
  return CDN.faceLandmarkerModel;
}

/**
 * Load @vladmandic/face-api ESM and resolve its model directory URL.
 * @returns {Promise<{ faceapi: any, modelUrl: string }>}
 */
export async function loadFaceApi() {
  const faceapi = await importEsmWithFallback('faceApi', VENDOR.faceApi, CDN.faceApi);
  const modelUrl = loadSource.faceApi === 'vendor' ? VENDOR.faceApiModels : CDN.faceApiModels;
  return { faceapi: faceapi.default ?? faceapi, modelUrl };
}

/**
 * Load Chart.js (UMD). Resolves the global `window.Chart`.
 * @returns {Promise<any>} the Chart constructor
 */
export async function loadChartJs() {
  if (window.Chart) {
    loadSource.chartJs = loadSource.chartJs ?? 'vendor';
    return window.Chart;
  }
  await injectScriptWithFallback('chartJs', VENDOR.chartJs, CDN.chartJs);
  if (!window.Chart) throw new Error('Chart.js loaded but window.Chart is undefined');
  return window.Chart;
}

/**
 * Build the model_versions string fragment (M04) describing pinned versions
 * and where each asset was loaded from.
 * @returns {string}
 */
export function describeVersions() {
  const src = (k) => loadSource[k] ?? 'not-loaded';
  return [
    `mp-tasks-vision-${VERSIONS.tasksVision}(${src('tasksVision')})`,
    `faceapi-${VERSIONS.faceApi}(${src('faceApi')})`,
    `chartjs-${VERSIONS.chartJs}(${src('chartJs')})`,
  ].join(' ');
}
