/**
 * SMILE-FA — ui/welcome.js  (T-14, R2)
 *
 * S0 welcome (language + mode + Start) and S1 consent/symptoms/confounders with
 * the 995 emergency banner (M10 sudden_now → show immediately, R2.3).
 *
 * @module ui/welcome
 */

import { state, showScreen } from '../state.js';
import { setLanguage, applyTranslations, getLang } from '../i18n.js';
import { setVoiceLang } from '../voice.js';

/**
 * Wire up S0 + S1. Called once at startup.
 * @param {{ onBeginSetup: () => void }} hooks
 */
export function initWelcome(hooks) {
  wireLanguage();
  wireMode();
  wireStart();
  wireConsent(hooks);
}

function wireLanguage() {
  const buttons = document.querySelectorAll('#language-select .lang-btn');
  const markActive = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      await setLanguage(btn.dataset.lang);
      state.lang = getLang();
      setVoiceLang(state.lang);
      markActive();
    });
  });
  markActive();
}

function wireMode() {
  document.querySelectorAll('input[name="mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      if (r.checked) state.mode = r.value;
    });
  });
}

function wireStart() {
  const start = document.getElementById('btn-start');
  if (start) start.addEventListener('click', () => showScreen('s1'));
}

function wireConsent(hooks) {
  const consent = document.getElementById('m12-consent');
  const onset = document.getElementById('m10-onset');
  const cont = document.getElementById('btn-to-setup');
  const banner = document.getElementById('emergency-banner');
  const nameInput = document.getElementById('participant-name');
  const yobInput = document.getElementById('participant-yob');
  const dataShare = document.getElementById('consent-datashare');

  // Clamp Year of Birth to a sensible range ending at the current year.
  const currentYear = new Date().getFullYear();
  if (yobInput) yobInput.max = String(currentYear);

  /** Are all required participant fields valid? */
  const participantValid = () => {
    const name = (nameInput && nameInput.value.trim()) || '';
    const gender = document.querySelector('input[name="gender"]:checked');
    const yob = yobInput ? parseInt(yobInput.value, 10) : NaN;
    const yobOk = Number.isInteger(yob) && yob >= 1900 && yob <= currentYear;
    return name.length > 0 && !!gender && yobOk;
  };

  const refresh = () => {
    state.meta.consent = !!(consent && consent.checked);
    state.meta.m10 = onset ? onset.value : 'none';
    state.meta.m11 = Array.from(document.querySelectorAll('input[name="m11"]:checked')).map((c) => c.value);

    // Off-device data-sharing consent (gates the optional Google Sheets send only;
    // does NOT block the test itself).
    state.meta.consentDataShare = !!(dataShare && dataShare.checked);

    // Participant identity (name stored locally only; year of birth, not full DOB).
    state.meta.participantName = (nameInput && nameInput.value.trim()) || '';
    const gender = document.querySelector('input[name="gender"]:checked');
    state.meta.gender = gender ? gender.value : null;
    const yob = yobInput ? parseInt(yobInput.value, 10) : NaN;
    state.meta.yearOfBirth = Number.isInteger(yob) ? yob : null;

    // 995 banner when sudden symptoms are reported now (R2.3).
    if (banner) banner.hidden = state.meta.m10 !== 'sudden_now';
    // All required before proceeding: consent + name + gender + year of birth.
    if (cont) cont.disabled = !(state.meta.consent && participantValid());
  };

  consent && consent.addEventListener('change', refresh);
  dataShare && dataShare.addEventListener('change', refresh);
  onset && onset.addEventListener('change', refresh);
  nameInput && nameInput.addEventListener('input', refresh);
  yobInput && yobInput.addEventListener('input', refresh);
  document.querySelectorAll('input[name="gender"]').forEach((r) => r.addEventListener('change', refresh));
  document.querySelectorAll('input[name="m11"]').forEach((c) => c.addEventListener('change', refresh));

  if (cont) {
    cont.addEventListener('click', () => {
      // R2.2: no camera before consent; all required fields must be valid.
      if (!state.meta.consent || !participantValid()) return;
      showScreen('s2');
      hooks.onBeginSetup();
    });
  }

  refresh();
  applyTranslations();
}
