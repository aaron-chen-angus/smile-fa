/**
 * SMILE-FA — data/sheets.js
 *
 * Optional integration: POST a completed assessment to a Google Apps Script
 * Web App, which appends one row to a Google Sheet.
 *
 * PRIVACY NOTE: enabling this transmits session data OFF the device, which is a
 * departure from the app's default on-device design (D5 / README §4.7). It is
 * opt-in via config/integrations.json and gated on consent in the UI. The
 * participant NAME is only included when sendParticipantName is true.
 *
 * The row is a FLAT object whose keys match the Google Sheet header row exactly
 * (see README "Google Sheets" section / buildRow below).
 *
 * @module data/sheets
 */

/** Ordered metric IDs sent as columns (mirror the Data Dictionary + header row). */
export const METRIC_COLUMNS = [
  // Rest (R)
  'R02', 'R03', 'R04', 'R07', 'R09', 'R12',
  // Brow (B)
  'B01', 'B02', 'B03',
  // Eyes (E)
  'E01', 'E02', 'E03', 'E05',
  // Smile (S)
  'S01', 'S02', 'S03', 'S07', 'S08', 'S13', 'S14',
  // Pucker / snarl (P/N)
  'P01', 'P02', 'N01', 'N02',
];

/** Metric fields emitted per metric id: value, L, R, flag. */
function metricCells(metrics, id) {
  const m = metrics && metrics[id];
  return {
    [`${id}_value`]: m && m.value != null ? m.value : '',
    [`${id}_L`]: m && m.L != null ? m.L : '',
    [`${id}_R`]: m && m.R != null ? m.R : '',
    [`${id}_flag`]: m ? m.flag : '',
  };
}

/**
 * Flatten a session result into a single flat row object.
 * @param {object} result analyzeSession output
 * @param {object} cfg { integrations } config
 * @returns {Record<string, string|number>}
 */
export function buildRow(result, cfg) {
  const meta = result.meta || {};
  const c = result.composites || {};
  const q = result.quality || {};
  const sendName = !!(cfg && cfg.integrations && cfg.integrations.google_sheets && cfg.integrations.google_sheets.sendParticipantName);

  const row = {
    // Session + participant metadata (M-series)
    submitted_at: new Date().toISOString(),
    M03_timestamp: meta.M03 || meta.timestamp || '',
    participant_name: sendName ? (meta.participantName || '') : '',
    gender: meta.gender || '',
    year_of_birth: meta.yearOfBirth ?? '',
    mode: meta.mode || '',
    language: meta.lang || '',
    M10_symptom_onset: meta.m10 || '',
    M11_confounders: Array.isArray(meta.m11) ? meta.m11.join('|') : '',
    thresholds_version: meta.thresholds_version || '',

    // Composites (C-series)
    C01_UFAI: c.C01_UFAI ?? '',
    C02_LFAI: c.C02_LFAI ?? '',
    C03_SMILE_FAI: c.C03_SMILE_FAI ?? '',
    C04_lower_upper_ratio: c.C04_lower_upper_ratio ?? '',
    C05_pattern: c.C05_pattern ?? '',
    C06_affected_side: c.C06_affected_side ?? '',
    C08_nihss4_cv: c.C08_nihss4_cv ?? '',
    C09_cpss_face_cv: c.C09_cpss_face_cv ?? '',
    C10_baseline_z: c.C10_baseline_z ?? '',
    C11_indicator: c.C11_indicator ?? '',
    C12_flags: Array.isArray(c.C12_flags) ? c.C12_flags.map((f) => f.id).join('|') : '',

    // Quality
    Q17_quality: q.Q17 ?? '',
  };

  // Per-metric columns (value / L / R / flag)
  for (const id of METRIC_COLUMNS) Object.assign(row, metricCells(result.metrics, id));

  return row;
}

/**
 * Send a completed assessment to the configured Google Sheet, if enabled.
 * Fails silently (logs a warning) so a network problem never blocks the UI.
 *
 * @param {object} result analyzeSession output
 * @param {object} cfg { integrations } config
 * @returns {Promise<boolean>} true if a request was sent
 */
export async function sendToGoogleSheet(result, cfg) {
  const gs = cfg && cfg.integrations && cfg.integrations.google_sheets;
  if (!gs || !gs.enabled || !gs.webAppUrl) return false;

  const row = buildRow(result, cfg);
  try {
    await fetch(gs.webAppUrl, {
      method: 'POST',
      // text/plain avoids a CORS preflight; Apps Script reads e.postData.contents.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(row),
      // Apps Script web apps don't send CORS headers; no-cors lets the POST through.
      mode: 'no-cors',
      keepalive: true,
    });
    return true;
  } catch (err) {
    console.warn('[sheets] failed to send result to Google Sheet', err);
    return false;
  }
}
