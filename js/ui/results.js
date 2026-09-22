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
import { renderClinicianCharts, resizeClinicianCharts } from './clinicianCharts.js';

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
const STATE_COLOR = { green: '#00e676', amber: '#ffcc00', red: '#ff3333', unable: '#6b7a99' };

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
    fill.style.stroke = STATE_COLOR[stateKey] || '#00e5ff';
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

  // Plain-English interpretation only (no NIHSS/CPSS jargon on the patient view).
  if (c.C05_pattern === 'central') {
    bullets.push('Lower-face weakness pattern detected');
    bullets.push('Forehead relatively unaffected (suggests stroke pattern)');
  } else if (c.C05_pattern === 'peripheral') {
    bullets.push('Whole side of the face affected, including the forehead');
  } else if (c.C05_pattern === 'bilateral_or_indeterminate') {
    bullets.push('Pattern unclear — please repeat or seek advice');
  } else {
    bullets.push('No clear one-sided weakness pattern detected');
  }

  if (c.C06_affected_side === 'L' || c.C06_affected_side === 'R') {
    bullets.push(`Weaker side: ${t('result.side.' + c.C06_affected_side)}`);
  }
  if (c.C11_indicator === 'red' || c.C11_indicator === 'amber') {
    bullets.push('If new or sudden, seek medical attention now (call 995)');
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
  const AMBER = 'rgba(255, 107, 0, 0.40)'; // affected hemiface highlight (orange emphasis)
  const CLEAR = 'rgba(0, 229, 255, 0.06)';
  const affL = side === 'L';
  const affR = side === 'R';
  // Un-mirrored diagram: patient LEFT on the image RIGHT, patient RIGHT on image LEFT.
  // "Weaker side →" arrow points toward the highlighted hemiface.
  const weakerLabel = (affL || affR)
    ? `<g>
         <text x="100" y="30" fill="#ff6b00" font-size="13" font-weight="700" text-anchor="middle">Weaker side ${affL ? '→' : '←'}</text>
       </g>`
    : '';
  host.innerHTML = `
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" role="img" aria-label="Affected region">
      <defs>
        <linearGradient id="faceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#111d35"/><stop offset="1" stop-color="#0a0f1e"/>
        </linearGradient>
      </defs>
      ${weakerLabel}
      <ellipse cx="100" cy="128" rx="78" ry="104" fill="url(#faceFill)" stroke="rgba(0,229,255,0.35)" stroke-width="2"/>
      <!-- Patient RIGHT half = image LEFT -->
      <path d="M100 26 A78 104 0 0 0 100 232 Z" fill="${affR ? AMBER : CLEAR}"/>
      <!-- Patient LEFT half = image RIGHT -->
      <path d="M100 26 A78 104 0 0 1 100 232 Z" fill="${affL ? AMBER : CLEAR}"/>
      <line x1="100" y1="26" x2="100" y2="232" stroke="rgba(0,229,255,0.35)" stroke-dasharray="3 5"/>
      <circle cx="66" cy="104" r="6" fill="#e8eaf0"/>
      <circle cx="134" cy="104" r="6" fill="#e8eaf0"/>
      <path d="M52 84 q14 -8 28 0" fill="none" stroke="#6b7a99" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M120 84 q14 -8 28 0" fill="none" stroke="#6b7a99" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M68 172 q32 24 64 0" fill="none" stroke="#e8eaf0" stroke-width="3.5" stroke-linecap="round"/>
      <!-- R/L labels anchored just outside the face outline -->
      <text x="14" y="132" fill="#6b7a99" font-size="15" font-weight="700">R</text>
      <text x="176" y="132" fill="#6b7a99" font-size="15" font-weight="700">L</text>
    </svg>
  `;
}

/* ---- S5 Clinician view ------------------------------------------------ */

/**
 * Render the clinician tabs (summary, metrics, emotion) and wire tab switching.
 * @param {object} result analyzeSession output
 * @param {object} [emotion] emotion summary { X12, X13 }
 */
export function renderClinician(result, emotion, buffers) {
  wireTabs();
  renderSummaryPanel(result);
  renderMetricsPanel(result);
  renderEmotionPanel(emotion);
  // Draw Chart.js charts after the panels' canvases exist in the DOM (items 11–13).
  renderClinicianCharts(buffers, emotion);
}

function wireTabs() {
  const tabs = document.querySelectorAll('#s5-clinician .tab');
  tabs.forEach((tab) => {
    tab.onclick = () => {
      tabs.forEach((t2) => t2.setAttribute('aria-selected', String(t2 === tab)));
      document.querySelectorAll('#s5-clinician .tab-panel').forEach((p) => {
        p.hidden = p.dataset.panel !== tab.dataset.tab;
      });
      // Charts inside a now-visible tab need a resize (Chart.js can't size in display:none).
      if (tab.dataset.tab === 'metrics' || tab.dataset.tab === 'emotion') resizeClinicianCharts();
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

  // Left-border flag class per card (item 7): green=none, amber=border, red=sig, grey=no flag.
  const stateFlag = state === 'red' ? 'sig' : state === 'amber' ? 'border' : state === 'green' ? 'none' : 'grey';
  const q17Flag = q17 >= 75 ? 'none' : q17 >= 60 ? 'border' : 'sig';

  const card = (id, subtitle, value, sub, opts = {}) => `
    <div class="kpi-card ${opts.accent ? 'kpi-card--accent' : ''} kpi-card--flag-${opts.flag || 'grey'}">
      <span class="kpi-card__label">${id} <span class="kpi-card__subtitle">· ${subtitle}</span></span>
      <span class="kpi-card__value ${opts.valueClass || ''}">${value}</span>
      ${sub ? `<span class="kpi-card__sub">${sub}</span>` : ''}
    </div>`;

  const sideText = c.C06_affected_side === 'L' ? "Patient's LEFT"
    : c.C06_affected_side === 'R' ? "Patient's RIGHT"
    : capitalize(c.C06_affected_side);

  // Participant subtitle row (clinician only — never shown on the patient screen).
  const meta = result.meta || {};
  const genderLabel = { male: 'Male', female: 'Female', prefer_not: 'Prefer not to say' }[meta.gender] || '—';
  const participantRow = `
    <div class="participant-row">
      <span><strong>${escapeHtml(meta.participantName || '—')}</strong></span>
      <span>${genderLabel}</span>
      <span>YOB ${meta.yearOfBirth ?? '—'}</span>
      <span>${meta.M03 || meta.timestamp || ''}</span>
    </div>`;

  // Item 6 subtitles; item 7 flag borders.
  panel.innerHTML = `
    ${participantRow}
    <div class="kpi-grid">
      ${card('C03', 'SMILE-FAI', c.C03_SMILE_FAI, 'Headline index (0–100)', { accent: true, valueClass: faiClass, flag: stateFlag })}
      ${card('C11', 'Indicator', capitalize(state), 'Traffic-light result', { valueClass: faiClass, flag: stateFlag })}
      ${card('C05', 'Pattern', prettyPattern(c.C05_pattern), 'Central / peripheral', { flag: c.C05_pattern === 'none' ? 'none' : 'grey' })}
      ${card('C06', 'Affected side', sideText, 'Weaker hemiface', { flag: 'grey' })}
      ${card('C08', 'NIHSS-4 analogue', c.C08_nihss4_cv, 'CV estimate of Item 4', { flag: c.C08_nihss4_cv >= 2 ? 'sig' : c.C08_nihss4_cv === 1 ? 'border' : 'none' })}
      ${card('C09', 'CPSS analogue', capitalize(c.C09_cpss_face_cv), 'Face-droop analogue', { flag: c.C09_cpss_face_cv === 'abnormal' ? 'border' : 'none' })}
      ${card('Q17', 'Measurement quality', `${q17}/100`, 'Overall capture quality', { valueClass: q17Class, flag: q17Flag })}
    </div>
    <div class="clin-caveat">Provisional thresholds — research use only. NIHSS-4 shown is a CV-estimated analogue of Item 4, not a validated clinical score.</div>`;
}

function capitalize(s) { return typeof s === 'string' && s.length ? s[0].toUpperCase() + s.slice(1) : s; }
/** Escape user-provided text (e.g. participant name) before inserting as HTML. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
function prettyPattern(p) {
  return { none: 'None', central: 'Central', peripheral: 'Peripheral', bilateral_or_indeterminate: 'Indeterminate' }[p] || p;
}

/** Human-readable reason for a null metric (item 9 tooltip). */
const REASON_TEXT = {
  not_performed: 'Task not performed or not detected',
  below_floor: 'Movement below the minimum measurable threshold',
  low_quality: 'Insufficient measurement quality for this metric',
  not_detected: 'Landmark not detected',
};

function renderMetricsPanel(result) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="metrics"]');
  if (!panel) return;
  const m = result.metrics;
  const fmt = (v) => (v == null ? '—' : (typeof v === 'number' ? v.toFixed(2) : v));
  let html = '';
  for (const [group, ids] of Object.entries(PHASE_GROUPS)) {
    const cells = ids.filter((id) => m[id]).map((id) => {
      const r = m[id];
      const flagClass = r.flag || 'none';
      const lr = (r.L != null || r.R != null) ? `L ${fmt(r.L)} · R ${fmt(r.R)}` : '';

      // Item 9: null value → "Not measured" grey italic + ⓘ tooltip with reason.
      let valueHtml;
      if (r.value == null) {
        const reason = r.reason && REASON_TEXT[r.reason] ? REASON_TEXT[r.reason] : 'Not measured';
        valueHtml = `<span class="metric-cell__value metric-cell__value--null">Not measured
          <span class="info-icon" tabindex="0" role="img" aria-label="${reason}" data-tip="${reason}${r.reason ? ' (' + r.reason + ')' : ''}">ⓘ</span>
        </span>`;
      } else {
        valueHtml = `<span class="metric-cell__value">${fmt(r.value)}${r.unit ? ' ' + r.unit : ''}</span>`;
      }

      return `
        <div class="metric-cell is-${flagClass}">
          <span class="metric-cell__id">${id}</span>
          ${valueHtml}
          ${lr ? `<span class="metric-cell__lr">${lr}</span>` : ''}
          ${flagClass !== 'none' ? `<span class="metric-cell__flag flag flag--${flagClass}">${flagClass}</span>` : ''}
        </div>`;
    }).join('');
    if (cells) {
      html += `<div class="metric-group">
        <h4 class="metric-group__title">${group}</h4>
        <div class="metric-cards">${cells}</div>
      </div>`;
    }
  }

  // Item 11: time-series section with two dual-line charts + phase bands.
  html += `
    <div class="metric-group">
      <h4 class="metric-group__title">Time series (L vs R)</h4>
      <div class="ts-chart-wrap"><canvas id="ts-commissure"></canvas></div>
      <div class="ts-chart-wrap"><canvas id="ts-brow"></canvas></div>
    </div>`;

  panel.innerHTML = html || '<p style="color:var(--text-dim)">No metrics computed.</p>';
}

function renderEmotionPanel(emotion) {
  const panel = document.querySelector('#s5-clinician .tab-panel[data-panel="emotion"]');
  if (!panel) return;
  if (!emotion || !emotion.X12 || !Object.keys(emotion.X12).length) {
    panel.innerHTML = '<p style="color:var(--text-dim)">Expression stream unavailable for this session.</p>';
    return;
  }
  // Item 12: 100% stacked bar per phase. Item 14: single banner below it.
  // Item 13: multi-line timeline. Item 15: amber italic interpretive note.
  panel.innerHTML = `
    <h4 class="metric-group__title">Expression mix by phase</h4>
    <div class="em-chart-wrap"><canvas id="em-stacked"></canvas></div>
    <div class="clin-caveat">${t('clin.caveat')}</div>

    <h4 class="metric-group__title">Expression probability timeline</h4>
    <div class="em-chart-wrap em-chart-wrap--tall"><canvas id="em-timeline"></canvas></div>
    <p class="em-interpret-note">Note: facial weakness may suppress “happy” probability during smile tasks — interpret expression output alongside asymmetry metrics.</p>`;
}
