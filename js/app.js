/**
 * SMILE-FA — app.js  (top-level router / orchestrator, T-16)
 *
 * Wires the whole flow: S0 welcome → S1 consent → S2 setup → S3 test →
 * S4 public result → S5 clinician → S6 history. No build step; ES modules.
 *
 * @module app
 */

import { state, showScreen } from './state.js';
import { initI18n, t, getLang } from './i18n.js';
import { setVoiceLang, setVoiceEnabled, speak } from './voice.js';
import { loadConfigs } from './config.js';
import { initWelcome } from './ui/welcome.js';
import { SetupController } from './ui/setup.js';
import { TestController } from './ui/test.js';
import { EmotionSampler } from './vision/emotion.js';
import { LiveCharts } from './ui/liveCharts.js';
import { analyzeSession } from './analysis.js';
import { renderPublicResult, renderClinician } from './ui/results.js';
import {
  saveSession, listSessions, deleteSession, deleteAll,
  setBaseline, getBaselineId, baselineChangeZ,
} from './data/store.js';
import { exportJSON, exportMetricsCSV, exportTimeseriesCSV, printReport, exportAll } from './data/export.js';

/** Shared app context. */
const ctx = {
  cfg: null,
  setup: null,
  test: null,
  emotion: null,
  charts: null,
  lastBuffers: null,
  lastResult: null,
};

async function boot() {
  await initI18n();
  state.lang = getLang();
  setVoiceLang(state.lang);
  try { ctx.cfg = await loadConfigs(); }
  catch (err) { console.error('config load failed', err); }

  initWelcome({ onBeginSetup: startSetup });
  wireResultActions();
  showScreen('s0');
  document.documentElement.dataset.smileReady = 'true';
}

/* ---- S2 setup --------------------------------------------------------- */
async function startSetup() {
  const video = document.getElementById('setup-video');
  try {
    ctx.setup = new SetupController({
      video,
      landmarksCfg: ctx.cfg.landmarks,
      thresholds: ctx.cfg.thresholds,
      onReady: startTest,
    });
    await ctx.setup.start();
  } catch (err) {
    showCameraError(err);
  }
}

/* ---- S3 test ---------------------------------------------------------- */
async function startTest() {
  showScreen('s3');
  const video = document.getElementById('test-video');
  const overlayCanvas = document.getElementById('test-overlay');

  // Hand the already-running camera + landmarker to the test screen.
  const camera = ctx.setup.camera;
  const landmarker = ctx.setup.landmarker;
  // Re-point the source at the test video element (camera stream or file src).
  if (camera.stream) {
    video.srcObject = camera.stream;
  } else if (ctx.setup.video && ctx.setup.video.src) {
    video.src = ctx.setup.video.src; // offline file mode (T-23)
  }
  video.muted = true; video.playsInline = true;
  // Point the CameraSource loop at the test video element from here on.
  camera.video = video;
  await video.play().catch(() => {});

  // Emotion + live charts (both optional / degrade gracefully).
  ctx.emotion = new EmotionSampler(video);
  ctx.charts = new LiveCharts({ emotionCanvas: document.getElementById('emotion-chart') });
  ctx.emotion.init();          // async, non-blocking
  ctx.charts.init();
  ctx.emotion.onSample = (s) => ctx.charts && ctx.charts.pushEmotion(s);

  ctx.test = new TestController({
    video, overlayCanvas, camera, landmarker,
    cfg: ctx.cfg,
    i18n: { t },
    speak,
    assisted: state.mode === 'assisted',
    onEmotionFrame: ({ now, phase }) => ctx.emotion && ctx.emotion.maybeSample(now, phase || 'P0'),
    onComplete: (buffers) => finishTest(buffers),
  });
  ctx.test.start();
}

/* ---- End of test → analysis → results --------------------------------- */
async function finishTest(buffers) {
  ctx.lastBuffers = buffers;

  // C10 baseline z if a baseline + history exist.
  let baselineZ = null;
  try {
    const history = await listSessions();
    const baseId = await getBaselineId();
    if (baseId && history.length >= 2) {
      const preliminary = analyzeSession(buffers, ctx.cfg, buildMeta());
      baselineZ = baselineChangeZ(preliminary, history);
    }
  } catch { /* history optional */ }

  const result = analyzeSession(buffers, ctx.cfg, { ...buildMeta(), baselineZ });
  ctx.lastResult = result;

  renderPublicResult(result);
  const emotionSummary = ctx.emotion ? ctx.emotion.summary() : null;
  ctx.lastEmotion = emotionSummary;
  // Pass per-phase buffers so the clinician view can draw time-series charts.
  renderClinician(result, emotionSummary, ctx.lastBuffers);
  showScreen('s4');
}

function buildMeta() {
  return { mode: state.mode, lang: getLang(), m10: state.meta.m10, m11: state.meta.m11 };
}

/* ---- S4/S5/S6 actions ------------------------------------------------- */
function wireResultActions() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

  on('btn-repeat', () => location.reload());
  on('btn-clinician', () => showScreen('s5'));
  on('btn-clin-back', () => showScreen('s4'));
  on('btn-save-baseline', async () => {
    if (!ctx.lastResult) return;
    const id = await saveSession(ctx.lastResult);
    await setBaseline(id);
    alert(t('result.baseline') + ' ✓');
  });

  // Clinician-view exports (operate on the current session result).
  on('btn-export-json', () => ctx.lastResult && exportJSON(ctx.lastResult));
  on('btn-export-csv', () => ctx.lastResult && exportMetricsCSV(ctx.lastResult));
  on('btn-print', () => ctx.lastResult && printReport(ctx.lastResult));

  // History (S6) actions.
  on('btn-export-all', async () => exportAll(await listSessions()));
  on('btn-delete-all', async () => {
    if (confirm(t('s6.deleteAll') + '?')) { await deleteAll(); renderHistory(); }
  });
}

/* ---- S6 history ------------------------------------------------------- */
async function renderHistory() {
  const list = document.getElementById('session-list');
  if (!list) return;
  const sessions = await listSessions();
  list.innerHTML = sessions.map((s) =>
    `<li><span>${(s.meta && s.meta.timestamp || s.savedAt || '').slice(0, 16)}</span>
     <span>${s.composites ? s.composites.C11_indicator : ''}</span></li>`
  ).join('') || `<li>${t('s6.sessions')}: —</li>`;
}

/* ---- Errors ----------------------------------------------------------- */
function showCameraError(err) {
  const el = document.getElementById('instruction') || document.body;
  const msg = err && err.message ? err.message : String(err);
  console.error('[camera]', err);
  const banner = document.createElement('div');
  banner.className = 'emergency-banner';
  banner.style.margin = '16px';
  banner.innerHTML = `<strong>Camera</strong><p>${msg}</p>`;
  document.getElementById('s2-setup')?.querySelector('.col--center')?.appendChild(banner);
}

// Pause the protocol if the tab is hidden (design.md §5).
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ctx.test && ctx.test.runner) {
    // The runner naturally pauses when frames stop arriving; nothing to do.
  }
});

boot();
