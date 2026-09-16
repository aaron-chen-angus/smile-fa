/**
 * SMILE-FA — voice.js  (T-13)
 *
 * Spoken prompts via the Web Speech API (speechSynthesis) with graceful
 * fallback to on-screen text only when speech is unavailable or disabled
 * (tech.md). Language-aware; picks a matching voice when present.
 *
 * @module voice
 */

const BCP47 = { en: 'en-US', zh: 'zh-CN', ms: 'ms-MY', ta: 'ta-IN' };

let enabled = true;
let lang = 'en';
/** @type {SpeechSynthesisVoice[]} */
let voices = [];

/** @returns {boolean} whether speechSynthesis exists */
export const isSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Enable/disable spoken output (text prompts still shown by the UI). */
export function setVoiceEnabled(on) { enabled = !!on; }

/** Set current language for voice selection. */
export function setVoiceLang(l) { lang = l in BCP47 ? l : 'en'; }

/** Cache available voices (they load asynchronously in some browsers). */
function refreshVoices() {
  if (!isSupported()) return;
  voices = window.speechSynthesis.getVoices();
}

if (isSupported()) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

/** Pick the best voice for the current language, or null. */
function pickVoice() {
  const target = BCP47[lang];
  return (
    voices.find((v) => v.lang === target) ||
    voices.find((v) => v.lang && v.lang.startsWith(lang)) ||
    null
  );
}

/**
 * Speak a phrase. No-op (resolves immediately) if unsupported or disabled.
 * Cancels any in-progress utterance first so prompts don't queue up.
 * @param {string} text
 * @returns {Promise<void>}
 */
export function speak(text) {
  if (!enabled || !isSupported() || !text) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[lang] || 'en-US';
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 0.98;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

/** Stop any current speech. */
export function stopSpeaking() {
  if (isSupported()) window.speechSynthesis.cancel();
}
