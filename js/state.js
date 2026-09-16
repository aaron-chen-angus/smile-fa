/**
 * SMILE-FA — state.js
 *
 * Tiny shared app state + screen router. No framework. The router toggles the
 * [hidden] attribute on <section.screen> elements (design.md §2 state machine).
 *
 * @module state
 */

export const SCREENS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6'];

/** @type {{screen:string, mode:string, lang:string, session:object|null, result:object|null}} */
export const state = {
  screen: 's0',
  mode: 'self_screen',
  lang: 'en',
  meta: { m10: 'none', m11: [], consent: false },
  session: null,
  result: null,
};

const listeners = new Set();

/** Subscribe to screen changes. @param {(screen:string)=>void} fn */
export function onScreenChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/**
 * Show one screen, hide the rest.
 * @param {string} screen
 */
export function showScreen(screen) {
  state.screen = screen;
  document.querySelectorAll('.screen[data-screen]').forEach((el) => {
    el.hidden = el.dataset.screen !== screen;
  });
  for (const fn of listeners) fn(screen);
}
