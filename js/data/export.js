/**
 * SMILE-FA — data/export.js  (T-22, R9.2)
 *
 * Exports session JSON (schema §J), metrics CSV (one row per metric), a
 * time-series CSV, and a printable A4 landscape report (browser print). All
 * client-side; nothing leaves the device.
 *
 * @module data/export
 */

/** Trigger a browser download of a text blob. */
function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV-escape a value. */
function csv(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export the session as JSON (schema §J shape).
 * @param {object} result
 */
export function exportJSON(result) {
  const stamp = (result.meta && result.meta.timestamp) || new Date().toISOString();
  download(`smilefa-session-${stamp.replace(/[:.]/g, '-')}.json`, JSON.stringify(result, null, 2), 'application/json');
}

/**
 * Export metrics as CSV — one row per metric.
 * @param {object} result
 */
export function exportMetricsCSV(result) {
  const rows = [['metric_id', 'value', 'unit', 'L', 'R', 'flag', 'reason']];
  for (const [id, m] of Object.entries(result.metrics || {})) {
    rows.push([id, m.value, m.unit, m.L, m.R, m.flag, m.reason].map(csv));
  }
  // Composites appended.
  for (const [id, v] of Object.entries(result.composites || {})) {
    if (Array.isArray(v)) continue;
    rows.push([id, csv(v), '', '', '', '', '']);
  }
  download('smilefa-metrics.csv', rows.map((r) => r.join(',')).join('\n'), 'text/csv');
}

/**
 * Export a time-series CSV from raw buffers (if retained on the result).
 * @param {object} result
 * @param {Record<string, object[]>} [buffers] optional per-phase frame buffers
 */
export function exportTimeseriesCSV(result, buffers) {
  const rows = [['phase', 't_ms', 'valid', 'commL_y', 'commR_y', 'pfh_L', 'pfh_R', 'brow_L', 'brow_R']];
  const src = buffers || {};
  for (const [phase, frames] of Object.entries(src)) {
    if (!Array.isArray(frames)) continue;
    for (const f of frames) {
      const p = f.prim;
      rows.push([
        phase, Math.round(f.tMs), f.valid,
        p ? p.commHeightL : '', p ? p.commHeightR : '',
        p ? p.pfhL : '', p ? p.pfhR : '',
        p ? p.browHeightL : '', p ? p.browHeightR : '',
      ].map(csv));
    }
  }
  download('smilefa-timeseries.csv', rows.map((r) => r.join(',')).join('\n'), 'text/csv');
}

/**
 * Open a printable A4-landscape report in a new window and invoke print.
 * @param {object} result
 */
export function printReport(result) {
  const c = result.composites || {};
  const q = result.quality || {};
  const flagsRows = (c.C12_flags || [])
    .map((f) => `<tr><td>${f.id}</td><td>${f.value ?? ''}</td><td>${f.flag}</td></tr>`).join('');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SMILE-FA report</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: system-ui, sans-serif; color: #111; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .muted { color: #555; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 12px; }
      th, td { border: 1px solid #bbb; padding: 4px 8px; text-align: left; }
      .banner { color: #b00; font-weight: bold; margin-top: 8px; }
    </style></head><body>
    <h1>SMILE Facial Asymmetry Screen — Report</h1>
    <div class="muted">${result.meta ? result.meta.timestamp : ''} · thresholds ${result.meta ? result.meta.thresholds_version : ''} · Research use only</div>
    <div class="banner">If symptoms are sudden, call 995 now.</div>
    <table><tbody>
      <tr><td>Indicator (C11)</td><td>${c.C11_indicator ?? ''}</td></tr>
      <tr><td>SMILE-FAI (C03)</td><td>${c.C03_SMILE_FAI ?? ''}</td></tr>
      <tr><td>Pattern (C05)</td><td>${c.C05_pattern ?? ''}</td></tr>
      <tr><td>Affected side (C06)</td><td>${c.C06_affected_side ?? ''}</td></tr>
      <tr><td>NIHSS-4 CV estimate (C08)</td><td>${c.C08_nihss4_cv ?? ''}</td></tr>
      <tr><td>Measurement quality (Q17)</td><td>${q.Q17 ?? ''}</td></tr>
    </tbody></table>
    <h3>Flagged metrics</h3>
    <table><thead><tr><th>ID</th><th>Value</th><th>Flag</th></tr></thead><tbody>${flagsRows || '<tr><td colspan="3">None</td></tr>'}</tbody></table>
    <p class="muted">CV-estimated analogue of NIHSS Item 4; not a validated diagnostic score.</p>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/**
 * Export ALL sessions as one JSON array (S6 "export all").
 * @param {object[]} sessions
 */
export function exportAll(sessions) {
  download('smilefa-all-sessions.json', JSON.stringify(sessions, null, 2), 'application/json');
}
