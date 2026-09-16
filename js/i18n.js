/**
 * SMILE-FA — i18n.js  (T-13)
 *
 * Loads a locale JSON from /i18n and applies it to elements with [data-i18n].
 * Falls back to English for missing keys. Persists the choice in localStorage.
 *
 * @module i18n
 */

export const SUPPORTED = ['en', 'zh', 'ta', 'ms'];
const STORAGE_KEY = 'smilefa.lang';

let dict = {};
let fallback = {};
let currentLang = 'en';

/** @returns {string} current language code */
export const getLang = () => currentLang;

/**
 * Look up a translation key, falling back to English then the key itself.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return dict[key] ?? fallback[key] ?? key;
}

/**
 * Fetch a locale file.
 * @param {string} lang
 * @returns {Promise<Record<string,string>>}
 */
async function fetchLocale(lang) {
  const res = await fetch(`i18n/${lang}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`missing locale ${lang}`);
  return res.json();
}

/**
 * Load a language (and English fallback), apply to the DOM, persist choice.
 * @param {string} lang
 * @returns {Promise<void>}
 */
export async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) lang = 'en';
  currentLang = lang;
  if (!Object.keys(fallback).length) {
    try { fallback = await fetchLocale('en'); } catch { fallback = {}; }
  }
  dict = lang === 'en' ? fallback : await fetchLocale(lang).catch(() => fallback);
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  applyTranslations();
}

/** Apply current dict to all [data-i18n] elements. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val != null) el.textContent = val;
  });
}

/**
 * Initial language: stored choice, else browser preference, else English.
 * @returns {Promise<void>}
 */
export async function initI18n() {
  let lang = 'en';
  try { lang = localStorage.getItem(STORAGE_KEY) || ''; } catch { /* ignore */ }
  if (!SUPPORTED.includes(lang)) {
    const nav = (navigator.language || 'en').slice(0, 2);
    lang = SUPPORTED.includes(nav) ? nav : 'en';
  }
  await setLanguage(lang);
}
