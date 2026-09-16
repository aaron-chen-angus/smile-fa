/**
 * SMILE-FA — ui/clinicianCharts.js
 *
 * Chart.js charts for the clinician view (items 11–13):
 *   - Two dual-line time-series (commissure L/R, brow L/R) with phase bands
 *   - A 100% stacked bar of per-phase expression mix
 *   - A multi-line 7-stream emotion timeline with phase bands
 *
 * Pure presentation: consumes the per-phase frame buffers and the emotion
 * series that already exist; performs NO metric computation. Degrades
 * gracefully if Chart.js or data are unavailable.
 *
 * @module ui/clinicianCharts
 */

import { loadChartJs } from '../loader.js';
import { EXPRESSIONS } from '../vision/emotion.js';

/** Phase order for band shading. */
const PHASE_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

/** Per-emotion colours (item 12/13). */
const EMOTION_COLORS = {
  neutral: '#9FB4CC', happy: '#FBBF24', sad: '#3B82F6', angry: '#EF4444',
  fearful: '#A78BFA', disgusted: '#34D399', surprised: '#FB923C',
};

const LINE_L = '#29B6F6'; // cyan = L
const LINE_R = '#FBBF24'; // amber = R

/** Track live chart instances so we can destroy on re-render. */
const instances = {};
function destroy(key) { if (instances[key]) { instances[key].destroy(); instances[key] = null; } }

/**
 * Flatten per-phase buffers into a single time-ordered series with phase tags.
 * @param {Record<string, object[]>} buffers
 * @returns {{t:number, phase:string, frame:object}[]}
 */
function flattenFrames(buffers) {
  const out = [];
  for (const phase of PHASE_ORDER) {
    const frames = Array.isArray(buffers[phase]) ? buffers[phase] : [];
    for (const f of frames) out.push({ t: f.tMs, phase, frame: f });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Build a Chart.js plugin that shades alternating phase bands + labels. */
function phaseBandPlugin(Chart, bands) {
  return {
    id: 'phaseBands',
    beforeDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;
      const x = scales.x;
      bands.forEach((b, i) => {
        const x0 = x.getPixelForValue(b.start);
        const x1 = x.getPixelForValue(b.end);
        ctx.save();
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top);
        ctx.fillStyle = '#93A9C4';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.phase, (x0 + x1) / 2, chartArea.top + 11);
        ctx.restore();
      });
    },
  };
}

/** Compute contiguous phase bands (start/end x) from a flattened series. */
function computeBands(series) {
  const bands = [];
  let cur = null;
  for (const s of series) {
    if (!cur || cur.phase !== s.phase) {
      if (cur) cur.end = s.t;
      cur = { phase: s.phase, start: s.t, end: s.t };
      bands.push(cur);
    } else {
      cur.end = s.t;
    }
  }
  return bands;
}

/**
 * Draw the two dual-line time-series charts (item 11).
 * @param {any} Chart
 * @param {Record<string, object[]>} buffers
 */
function drawTimeSeries(Chart, buffers) {
  const series = flattenFrames(buffers);
  if (!series.length) return;
  const t0 = series[0].t;
  const bands = computeBands(series).map((b) => ({ phase: b.phase, start: (b.start - t0) / 1000, end: (b.end - t0) / 1000 }));

  const mk = (canvasId, key, selL, selR, title) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroy(key);
    const dataL = [], dataR = [];
    for (const s of series) {
      const p = s.frame.prim;
      if (!p) continue;
      const x = (s.t - t0) / 1000;
      dataL.push({ x, y: selL(p) });
      dataR.push({ x, y: selR(p) });
    }
    instances[key] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          { label: 'L', data: dataL, borderColor: LINE_L, borderWidth: 1.6, pointRadius: 0, tension: 0.25 },
          { label: 'R', data: dataR, borderColor: LINE_R, borderWidth: 1.6, pointRadius: 0, tension: 0.25 },
        ],
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        scales: {
          x: { type: 'linear', title: { display: true, text: title + '  (seconds)', color: '#93A9C4' }, ticks: { color: '#93A9C4' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { title: { display: true, text: 'mm', color: '#93A9C4' }, ticks: { color: '#93A9C4' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
        plugins: { legend: { labels: { color: '#EAF2FB', boxWidth: 12 } } },
      },
      plugins: [phaseBandPlugin(Chart, bands)],
    });
  };

  // Commissure height L/R and brow height L/R (HF mm), directly from primitives.
  mk('ts-commissure', 'tsComm', (p) => p.commHeightL, (p) => p.commHeightR, 'Commissure height');
  mk('ts-brow', 'tsBrow', (p) => p.browHeightL, (p) => p.browHeightR, 'Brow height');
}

/**
 * Draw the 100% stacked bar per phase (item 12) and the multi-line emotion
 * timeline (item 13).
 * @param {any} Chart
 * @param {object} emotion  { X12, X13, series }
 */
function drawEmotionCharts(Chart, emotion) {
  if (!emotion) return;

  // ---- Item 12: stacked bar per phase from X12 means (normalised to 100%). --
  const barCanvas = document.getElementById('em-stacked');
  if (barCanvas && emotion.X12 && Object.keys(emotion.X12).length) {
    destroy('emStacked');
    const phases = PHASE_ORDER.filter((p) => emotion.X12[p]);
    const datasets = EXPRESSIONS.map((e) => ({
      label: e,
      backgroundColor: EMOTION_COLORS[e],
      data: phases.map((p) => {
        const means = emotion.X12[p];
        const total = EXPRESSIONS.reduce((a, k) => a + (means[k] || 0), 0) || 1;
        return ((means[e] || 0) / total) * 100;
      }),
    }));
    instances.emStacked = new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: phases, datasets },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        indexAxis: 'x',
        scales: {
          x: { stacked: true, ticks: { color: '#93A9C4' }, grid: { display: false } },
          y: { stacked: true, max: 100, ticks: { color: '#93A9C4', callback: (v) => v + '%' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
        plugins: {
          legend: { labels: { color: '#EAF2FB', boxWidth: 12 } },
          // Inline segment labels when wider than 8% (item 12).
          segmentLabels: {},
        },
      },
      plugins: [{
        id: 'segmentLabels',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          chart.data.datasets.forEach((ds, di) => {
            const meta = chart.getDatasetMeta(di);
            meta.data.forEach((bar, i) => {
              const val = ds.data[i];
              if (val > 8) {
                const { x, y } = bar.tooltipPosition();
                ctx.save();
                ctx.fillStyle = '#0A1728';
                ctx.font = '10px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${ds.label} ${Math.round(val)}%`, x, y);
                ctx.restore();
              }
            });
          });
        },
      }],
    });
  }

  // ---- Item 13: multi-line 7-stream timeline. -------------------------------
  const lineCanvas = document.getElementById('em-timeline');
  if (lineCanvas && emotion.series && emotion.series.length) {
    destroy('emTimeline');
    const s0 = emotion.series[0].tMs;
    // Determine session-dominant emotion (highest mean) for full-opacity line.
    const meanByExpr = EXPRESSIONS.map((_, i) => emotion.series.reduce((a, s) => a + s.p[i], 0) / emotion.series.length);
    const domIdx = meanByExpr.indexOf(Math.max(...meanByExpr));
    const bands = computeBands(emotion.series.map((s) => ({ t: s.tMs, phase: s.phase })))
      .map((b) => ({ phase: b.phase, start: (b.start - s0) / 1000, end: (b.end - s0) / 1000 }));

    const hexA = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    const datasets = EXPRESSIONS.map((e, i) => ({
      label: e,
      data: emotion.series.map((s) => ({ x: (s.tMs - s0) / 1000, y: s.p[i] })),
      borderColor: hexA(EMOTION_COLORS[e], i === domIdx ? 1 : 0.7),
      borderWidth: i === domIdx ? 2.2 : 1.3,
      pointRadius: 0, tension: 0.3,
    }));
    instances.emTimeline = new Chart(lineCanvas.getContext('2d'), {
      type: 'line',
      data: { datasets },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        scales: {
          x: { type: 'linear', title: { display: true, text: 'seconds', color: '#93A9C4' }, ticks: { color: '#93A9C4' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { min: 0, max: 1, ticks: { color: '#93A9C4' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
        plugins: { legend: { labels: { color: '#EAF2FB', boxWidth: 12 } } },
      },
      plugins: [phaseBandPlugin(Chart, bands)],
    });
  }
}

/**
 * Entry point: load Chart.js and render all clinician charts that have data.
 * @param {Record<string, object[]>} buffers per-phase frame buffers
 * @param {object} emotion emotion summary (X12 + series)
 */
export async function renderClinicianCharts(buffers, emotion) {
  let Chart;
  try { Chart = await loadChartJs(); }
  catch { return; } // charts optional
  if (buffers) drawTimeSeries(Chart, buffers);
  if (emotion) drawEmotionCharts(Chart, emotion);
}

/**
 * Resize charts once their tab becomes visible (Chart.js can't size a canvas
 * inside a display:none panel, so we nudge it after the tab is shown).
 */
export function resizeClinicianCharts() {
  requestAnimationFrame(() => {
    Object.values(instances).forEach((c) => { try { c && c.resize(); } catch { /* noop */ } });
  });
}
