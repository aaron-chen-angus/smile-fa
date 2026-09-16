/**
 * SMILE-FA — ui/results.js  (T-19 public result, T-20 clinician view)
 *
 * Renders S4 (public traffic-light result) and S5 (clinician tabs: summary,
 * metrics table by phase with flags, emotion timeline + caveats). Uses the
 * i18n translator for user-facing strings.
 *
 * @module ui/results
 */

import { t } from '../i18n.js';

/** Map metric id → phase group for the clinician table. */
const PHASE_GROUPS = {
  Rest: ['R02', 'R03', 'R04', 'R06', 'R07', 'R08', 'R09', 'R12'],
  'Brow (P2)': ['B01', 'B02', 'B03'],
  'Eyes (P3/P4)': ['E01', 'E02', 'E03', 'E05'],
  'Smile (P5)': ['S01', 'S02', 'S03', 'S07', 'S08', 'S13', 'S14'],
  'Pucker (P6)': ['P01', 'P02'],
  'Snarl (P7)': ['N01', 'N02'],
};

/* ---- S4 Public result ------------------------------------------------- */

/**
 * Render the public result screen.
 * @param {object} result analyzeSession output
 */
export function renderPublicResult(result) {
  const c = result.composites;
  const indicator = document.getElementById('indicator');
  const label = document.getElementById('indicator-label');
  const message = document.getElementById('public-message');
  const sideEl = document.getElementById('affected-side');

  const stateKey = c.C11_indicator; // green|amber|red|unable
  if (indicator) indicator.dataset.state = stateKey;
  if (label) label.textContent = t(`result.${stateKey}`);
  if (message) message.textContent = t(`result.${stateKey}`);

  if (sideEl) {
    if ((stateKey === 'amber' || stateKey === 'red') && (c.C06_affected_side === 'L' || c.C06_affected_side === 'R')) {
      sideEl.textContent = t(`result.side.${c.C06_affected_side}`);
      sideEl.hidden = false;
    } else {
      sideEl.textContent = '';
      sideEl.hidden = true;
    }
  }

  renderFaceDiagram(c.C06_affected_side, c.C05_pattern);
}

/**
 * Draw the face diagram SVG, highlighting the affected side/region.
 * @param {'L'|'R'|'none'|'unclear'} side
 * @param {string} pattern
 */
export function renderFaceDiagram(side, pattern) {
  const host = document.getElementById('face-diagram');
  if (!host) return;
  const hl = (test) => (test ? 'rgba(239,68,68,0.55)' : 'rgba(41,182,246,0.15)');
  const lowerL = side === 'L';
  const lowerR = side === 'R';
  // Un-mirrored diagram: patient LEFT on image right.
  host.innerHTML = `
    <svg viewBox="0 0 200 220" width="220" height="240" role="img" aria-label="Affected region">
      <ellipse cx="100" cy="110" rx="70" ry="95" fill="#0C1B2E" stroke="#1D3350" stroke-width="2"/>
      <!-- Right half (patient RIGHT = image left) -->
      <path d="M100 20 A70 95 0 0 0 100 205 Z" fill="${hl(lowerR)}"/>
      <!-- Left half (patient LEFT = image right) -->
      <path d="M100 20 A70 95 0 0 1 100 205 Z" fill="${hl(lowerL)}"/>
      <line x1="100" y1="18" x2="100" y2="207" stroke="#1D3350" stroke-dasharray="4 4"/>
      <circle cx="72" cy="90" r="6" fill="#E6F0FA"/>
      <circle cx="128" cy="90" r="6" fill="#E6F0FA"/>
      <path d="M74 150 q26 20 52 0" fill="none" stroke="#E6F0FA" stroke-width="3"/>
      <text x="150" y="115" fill="#9FB4CC" font-size="12">L</text>
      <text x="42" y="115" fill="#9FB4CC" font-size="12">R</text>
    </svg>
    <p style="color:var(--text-dim);font-size:13px">${pattern && pattern !== 'none' ? 'Pattern: ' + pattern : ''}</p>
  `;
}

/* ---- S5 Clinician view ------------------------------------------------ */

/**
 * Render the clinician tabs (summary, metrics, emotion) and wire tab switching.
 * @param {object} result analyzeSession output
 * @param {object} [emotion] emotion summary { X12, X13 }
 */
export function renderClinician(result, emotion) {
  wireTabs();
  renderSummaryPanel(result);
  renderMetricsPanel(result);
  renderEmotionPanel(emotion);
}

function wireTabs() {
  const tabs = document.querySelectorAll('#s5-clinician .tab');
  tabs.forEach((tab) => {
    tab.onclick = () => {
      tabs.forEach((t2) => t2.setAttribute('aria-selected', String(t2 === tab)));
      document.querySelectorAll('#s5-clinician .tab-panel').forEach((p) => {
        p.hidden = p.dataset.panel !== tab.dataset.tab;
      });
    };
  });
}

function renderSummaryPanel(result) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="summary"]');
  if (!panel) return;
  const c = result.composites;
  const rows = [
    ['SMILE-FAI (C03)', c.C03_SMILE_FAI],
    ['Pattern (C05)', c.C05_pattern],
    ['Affected side (C06)', c.C06_affected_side],
    ['NIHSS-4 CV estimate (C08)', c.C08_nihss4_cv],
    ['CPSS analogue (C09)', c.C09_cpss_face_cv],
    ['Indicator (C11)', c.C11_indicator],
    ['Measurement quality (Q17)', result.quality.Q17],
  ];
  panel.innerHTML =
    `<table class="metric-table"><tbody>${
      rows.map((r) => `<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td></tr>`).join('')
    }</tbody></table>
     <p style="color:var(--amber);font-size:13px">Provisional thresholds — research use only. CV-estimated analogue of NIHSS Item 4, not a validated score.</p>`;
}

function renderMetricsPanel(result) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="metrics"]');
  if (!panel) return;
  const m = result.metrics;
  const fmt = (v) => (v == null ? '—' : (typeof v === 'number' ? v.toFixed(2) : v));
  const flagCell = (f) => `<span class="flag flag--${f}">${f}</span>`;
  let html = '';
  for (const [group, ids] of Object.entries(PHASE_GROUPS)) {
    const rowsHtml = ids.filter((id) => m[id]).map((id) => {
      const r = m[id];
      return `<tr>
        <td>${id}</td>
        <td>${fmt(r.value)}${r.unit ? ' ' + r.unit : ''}</td>
        <td>${fmt(r.L)}</td><td>${fmt(r.R)}</td>
        <td>${flagCell(r.flag)}</td>
        <td>${r.reason || ''}</td>
      </tr>`;
    }).join('');
    if (rowsHtml) {
      html += `<h4>${group}</h4><table class="metric-table">
        <thead><tr><th>ID</th><th>Value</th><th>L</th><th>R</th><th>Flag</th><th>Reason</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>`;
    }
  }
  panel.innerHTML = html || '<p>No metrics computed.</p>';
}

function renderEmotionPanel(emotion) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="emotion"]');
  if (!panel) return;
  if (!emotion || !emotion.X12 || !Object.keys(emotion.X12).length) {
    panel.innerHTML = '<p style="color:var(--text-dim)">Expression stream unavailable for this session.</p>';
    return;
  }
  let html = '<h4>Per-phase mean expression (X12)</h4><table class="metric-table"><thead><tr><th>Phase</th><th>Dominant</th></tr></thead><tbody>';
  for (const [phase, means] of Object.entries(emotion.X12)) {
    const dom = Object.entries(means).sort((a, b) => b[1] - a[1])[0];
    html += `<tr><td>${phase}</td><td>${dom ? dom[0] + ' (' + (dom[1] * 100).toFixed(0) + '%)' : '—'}</td></tr>`;
  }
  html += '</tbody></table>';
  html += `<p style="color:var(--amber);font-size:13px">${t('clin.caveat')}</p>`;
  panel.innerHTML = html;
}
