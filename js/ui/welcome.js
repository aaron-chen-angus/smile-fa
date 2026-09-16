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

  const refresh = () => {
    state.meta.consent = !!(consent && consent.checked);
    state.meta.m10 = onset ? onset.value : 'none';
    state.meta.m11 = Array.from(document.querySelectorAll('input[name="m11"]:checked')).map((c) => c.value);
    // 995 banner when sudden symptoms are reported now (R2.3).
    if (banner) banner.hidden = state.meta.m10 !== 'sudden_now';
    if (cont) cont.disabled = !state.meta.consent;
  };

  consent && consent.addEventListener('change', refresh);
  onset && onset.addEventListener('change', refresh);
  document.querySelectorAll('input[name="m11"]').forEach((c) => c.addEventListener('change', refresh));

  if (cont) {
    cont.addEventListener('click', () => {
      if (!state.meta.consent) return; // R2.2: no camera before consent
      showScreen('s2');
      hooks.onBeginSetup();
    });
  }

  refresh();
  applyTranslations();
}
