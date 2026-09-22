/**
 * SMILE-FA — ui/liveCharts.js  (T-18, R6.2)
 *
 * Streaming expression chart (last ~20 s, 7 lines) using Chart.js, plus small
 * live L/R commissure and brow mini-traces. Chart.js is loaded via loader.js.
 * Degrades gracefully if Chart.js or emotion data are unavailable.
 *
 * @module ui/liveCharts
 */

import { loadChartJs } from '../loader.js';
import { EXPRESSIONS } from '../vision/emotion.js';

const COLORS = ['#6b7a99', '#00e676', '#3ba7ff', '#ff3333', '#b98bff', '#ffcc00', '#ff6b00'];
const WINDOW_MS = 20000;

export class LiveCharts {
  /**
   * @param {object} deps
   * @param {HTMLCanvasElement} deps.emotionCanvas
   * @param {HTMLCanvasElement} [deps.commissureCanvas]
   * @param {HTMLCanvasElement} [deps.browCanvas]
   */
  constructor(deps) {
    this.deps = deps;
    this.Chart = null;
    this.emotionChart = null;
    this.miniCommissure = null;
    this.miniBrow = null;
    this.ready = false;
  }

  async init() {
    try {
      this.Chart = await loadChartJs();
      this._buildEmotion();
      this.ready = true;
    } catch (err) {
      console.warn('[liveCharts] Chart.js unavailable; live charts disabled', err);
      this.ready = false;
    }
  }

  _buildEmotion() {
    const ctx = this.deps.emotionCanvas.getContext('2d');
    this.emotionChart = new this.Chart(ctx, {
      type: 'line',
      data: {
        datasets: EXPRESSIONS.map((e, i) => ({
          label: e, data: [], borderColor: COLORS[i], borderWidth: 1.5,
          pointRadius: 0, tension: 0.3,
        })),
      },
      options: {
        animation: false,
        responsive: true,
        scales: {
          x: { type: 'linear', display: false },
          y: { min: 0, max: 1, ticks: { color: '#6b7a99' } },
        },
        plugins: { legend: { labels: { color: '#6b7a99', boxWidth: 10 } } },
      },
    });
  }

  /**
   * Push an emotion sample; trims to the rolling window.
   * @param {{tMs:number, p:number[]}} sample
   */
  pushEmotion(sample) {
    if (!this.ready || !this.emotionChart) return;
    const ds = this.emotionChart.data.datasets;
    for (let i = 0; i < EXPRESSIONS.length; i++) {
      ds[i].data.push({ x: sample.tMs, y: sample.p[i] });
    }
    const cutoff = sample.tMs - WINDOW_MS;
    for (const d of ds) {
      while (d.data.length && d.data[0].x < cutoff) d.data.shift();
    }
    this.emotionChart.update('none');
  }

  destroy() {
    this.emotionChart && this.emotionChart.destroy();
    this.miniCommissure && this.miniCommissure.destroy();
    this.miniBrow && this.miniBrow.destroy();
  }
}
