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
/** Short state word shown next to the indicator dot. */
const STATE_WORD = { green: 'Within range', amber: 'Borderline', red: 'Significant', unable: 'Unable to assess' };

export function renderPublicResult(result) {
  const c = result.composites;
  const indicator = document.getElementById('indicator');
  const label = document.getElementById('indicator-label');
  const message = document.getElementById('public-message');
  const sideEl = document.getElementById('affected-side');

  const stateKey = c.C11_indicator; // green|amber|red|unable
  if (indicator) indicator.dataset.state = stateKey;
  // Tint the verdict card to match the state (calm, low-alert-fatigue).
  const verdictCard = document.querySelector('.result-card--verdict');
  if (verdictCard) verdictCard.dataset.state = stateKey;
  // Indicator label = short status word; message = the full sentence (no dup).
  if (label) label.textContent = STATE_WORD[stateKey] || stateKey;
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

  renderScoreRing(c.C03_SMILE_FAI ?? 0, stateKey);
  renderKeyMetrics(result);
  renderInterpretation(result);
  renderFaceDiagram(c.C06_affected_side, c.C05_pattern);
}

/** Colour per indicator state (matches CSS tokens). */
const STATE_COLOR = { green: '#34D399', amber: '#FBBF24', red: '#EF4444', unable: '#9FB4CC' };

/**
 * Animate the SMILE-FAI score ring (0–100, higher = more asymmetry).
 * @param {number} score
 * @param {string} stateKey
 */
export function renderScoreRing(score, stateKey) {
  const fill = document.getElementById('score-ring-fill');
  const value = document.getElementById('score-value');
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (value) value.textContent = String(s);
  if (fill) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    fill.style.strokeDasharray = String(circ);
    fill.style.strokeDashoffset = String(circ * (1 - s / 100));
    fill.style.stroke = STATE_COLOR[stateKey] || '#29B6F6';
  }
}

/** Format a metric value with unit, null-safe. */
function fmtMetric(m, digits = 1) {
  if (!m || m.value == null) return '—';
  const v = typeof m.value === 'number' ? m.value.toFixed(digits) : m.value;
  return `${v}${m.unit ? ' ' + m.unit : ''}`;
}

/** Format a ratio as a percentage symmetry figure. */
function fmtRatioPct(m) {
  if (!m || m.value == null) return '—';
  return `${Math.round(m.value * 100)}%`;
}

/**
 * Render the key-measurements list (public-friendly, poster style).
 * @param {object} result
 */
export function renderKeyMetrics(result) {
  const host = document.getElementById('key-metrics');
  if (!host) return;
  const m = result.metrics;
  const c = result.composites;
  const rows = [
    ['Smile symmetry', fmtRatioPct(m.S02), m.S02 && m.S02.flag],
    ['Smile angle', fmtMetric(m.S07), m.S07 && m.S07.flag],
    ['Brow lift symmetry', fmtRatioPct(m.B02), m.B02 && m.B02.flag],
    ['Eye closure symmetry', fmtRatioPct(m.E03), m.E03 && m.E03.flag],
    ['Resting mouth droop', fmtMetric(m.R02), m.R02 && m.R02.flag],
    ['Measurement quality', `${result.quality.Q17}/100`, null],
  ];
  host.innerHTML = rows.map(([label, val, flag]) => `
    <li class="key-metric">
      <span class="key-metric__label">${label}</span>
      <span class="key-metric__value ${flag ? 'is-' + flag : ''}">${val}</span>
    </li>`).join('');
}

/**
 * Render plain-language interpretation bullets from the composites.
 * @param {object} result
 */
export function renderInterpretation(result) {
  const host = document.getElementById('interpretation');
  if (!host) return;
  const c = result.composites;
  const bullets = [];
  const patternText = {
    none: 'No clear asymmetry pattern',
    central: 'Lower-face-dominant pattern (forehead relatively spared)',
    peripheral: 'Whole-hemiface pattern',
    bilateral_or_indeterminate: 'Bilateral or indeterminate pattern',
  };
  bullets.push(patternText[c.C05_pattern] || c.C05_pattern);
  if (c.C06_affected_side === 'L' || c.C06_affected_side === 'R') {
    bullets.push(`Weaker side: ${t('result.side.' + c.C06_affected_side)}`);
  }
  bullets.push(`NIHSS-4 (CV estimate): ${c.C08_nihss4_cv} · CPSS face: ${c.C09_cpss_face_cv}`);
  if (c.C11_indicator === 'red' || c.C11_indicator === 'amber') {
    bullets.push('If new or sudden, seek medical attention now (call 995).');
  }
  host.innerHTML = bullets.map((b) => `<li>${b}</li>`).join('');
}

/**
 * Draw the face diagram SVG, highlighting the affected side/region.
 * @param {'L'|'R'|'none'|'unclear'} side
 * @param {string} pattern
 */
export function renderFaceDiagram(side, pattern) {
  const host = document.getElementById('face-diagram');
  if (!host) return;
  const hl = (test) => (test ? 'rgba(248,113,113,0.42)' : 'rgba(56,189,248,0.10)');
  const lowerL = side === 'L';
  const lowerR = side === 'R';
  // Un-mirrored diagram: patient LEFT on image right.
  host.innerHTML = `
    <svg viewBox="0 0 200 230" width="230" height="264" role="img" aria-label="Affected region">
      <defs>
        <linearGradient id="faceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#12273F"/><stop offset="1" stop-color="#0A1728"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="112" rx="72" ry="96" fill="url(#faceFill)" stroke="#223B5C" stroke-width="2"/>
      <path d="M100 18 A72 96 0 0 0 100 208 Z" fill="${hl(lowerR)}"/>
      <path d="M100 18 A72 96 0 0 1 100 208 Z" fill="${hl(lowerL)}"/>
      <line x1="100" y1="18" x2="100" y2="208" stroke="#223B5C" stroke-dasharray="3 5"/>
      <circle cx="70" cy="92" r="5.5" fill="#EAF2FB"/>
      <circle cx="130" cy="92" r="5.5" fill="#EAF2FB"/>
      <path d="M74 116 q10 -6 20 0" fill="none" stroke="#7d94b3" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M106 116 q10 -6 20 0" fill="none" stroke="#7d94b3" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M72 152 q28 22 56 0" fill="none" stroke="#EAF2FB" stroke-width="3" stroke-linecap="round"/>
      <text x="150" y="116" fill="#93A9C4" font-size="13" font-weight="600">L</text>
      <text x="40" y="116" fill="#93A9C4" font-size="13" font-weight="600">R</text>
    </svg>
    <p style="color:var(--text-dim);font-size:13px;margin:8px 0 0">${pattern && pattern !== 'none' ? 'Pattern: ' + prettyPattern(pattern) : 'No clear asymmetry pattern'}</p>
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
  const state = c.C11_indicator;
  const faiClass = state === 'red' ? 'is-red' : state === 'amber' ? 'is-amber' : 'is-green';
  const q17 = result.quality.Q17;
  const q17Class = q17 >= 75 ? 'is-green' : q17 >= 60 ? 'is-amber' : 'is-red';

  const card = (label, value, sub, opts = {}) => `
    <div class="kpi-card ${opts.accent ? 'kpi-card--accent' : ''}">
      <span class="kpi-card__label">${label}</span>
      <span class="kpi-card__value ${opts.valueClass || ''}">${value}</span>
      ${sub ? `<span class="kpi-card__sub">${sub}</span>` : ''}
    </div>`;

  const sideText = c.C06_affected_side === 'L' ? "Patient's LEFT"
    : c.C06_affected_side === 'R' ? "Patient's RIGHT"
    : c.C06_affected_side;

  panel.innerHTML = `
    <div class="kpi-grid">
      ${card('SMILE-FAI', c.C03_SMILE_FAI, 'Headline index (0–100)', { accent: true, valueClass: faiClass })}
      ${card('Indicator', capitalize(state), 'Traffic-light result', { valueClass: faiClass })}
      ${card('Pattern', prettyPattern(c.C05_pattern), 'Central / peripheral', {})}
      ${card('Affected side', sideText, 'Weaker hemiface', {})}
      ${card('NIHSS-4 (CV est.)', c.C08_nihss4_cv, 'Analogue of Item 4', {})}
      ${card('CPSS face', capitalize(c.C09_cpss_face_cv), 'Analogue', {})}
      ${card('Quality (Q17)', `${q17}/100`, 'Measurement quality', { valueClass: q17Class })}
    </div>
    <div class="clin-caveat">Provisional thresholds — research use only. NIHSS-4 shown is a CV-estimated analogue of Item 4, not a validated clinical score.</div>`;
}

function capitalize(s) { return typeof s === 'string' && s.length ? s[0].toUpperCase() + s.slice(1) : s; }
function prettyPattern(p) {
  return { none: 'None', central: 'Central', peripheral: 'Peripheral', bilateral_or_indeterminate: 'Indeterminate' }[p] || p;
}

function renderMetricsPanel(result) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="metrics"]');
  if (!panel) return;
  const m = result.metrics;
  const fmt = (v) => (v == null ? '—' : (typeof v === 'number' ? v.toFixed(2) : v));
  let html = '';
  for (const [group, ids] of Object.entries(PHASE_GROUPS)) {
    const cells = ids.filter((id) => m[id]).map((id) => {
      const r = m[id];
      const lr = (r.L != null || r.R != null) ? `L ${fmt(r.L)} · R ${fmt(r.R)}` : '';
      return `
        <div class="metric-cell is-${r.flag}">
          <span class="metric-cell__id">${id}${r.reason ? ' · ' + r.reason : ''}</span>
          <span class="metric-cell__value">${fmt(r.value)}${r.unit ? ' ' + r.unit : ''}</span>
          ${lr ? `<span class="metric-cell__lr">${lr}</span>` : ''}
          ${r.flag !== 'none' ? `<span class="metric-cell__flag flag flag--${r.flag}">${r.flag}</span>` : ''}
        </div>`;
    }).join('');
    if (cells) {
      html += `<div class="metric-group">
        <h4 class="metric-group__title">${group}</h4>
        <div class="metric-cards">${cells}</div>
      </div>`;
    }
  }
  panel.innerHTML = html || '<p style="color:var(--text-dim)">No metrics computed.</p>';
}

function renderEmotionPanel(emotion) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="emotion"]');
  if (!panel) return;
  if (!emotion || !emotion.X12 || !Object.keys(emotion.X12).length) {
    panel.innerHTML = '<p style="color:var(--text-dim)">Expression stream unavailable for this session.</p>';
    return;
  }
  const items = Object.entries(emotion.X12).map(([phase, means]) => {
    const dom = Object.entries(means).sort((a, b) => b[1] - a[1])[0];
    return `<li>
      <span class="phase">${phase}</span>
      <span class="dom">${dom ? capitalize(dom[0]) : '—'}</span>
      <span class="metric-cell__lr">${dom ? (dom[1] * 100).toFixed(0) + '%' : ''}</span>
    </li>`;
  }).join('');
  panel.innerHTML = `
    <h4 class="metric-group__title">Per-phase dominant expression</h4>
    <ul class="emotion-list">${items}</ul>
    <div class="clin-caveat">${t('clin.caveat')}</div>`;
}
