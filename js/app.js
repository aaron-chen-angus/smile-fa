/**
 * SMILE-FA — app.js (shell bootstrap placeholder).
 *
 * This is a minimal ES-module entry point created in T-01 so index.html loads
 * without a 404. The full screen router + state machine is built in T-16
 * (see .kiro/specs/smile-facial-asymmetry/tasks.md and design.md §2).
 *
 * No build step: this file is loaded directly as <script type="module">.
 * @module app
 */

/** Screen ids in navigation order (each is a <section data-screen> in index.html). */
export const SCREENS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6'];

/**
 * Show one screen and hide the rest by toggling the [hidden] attribute.
 * Kept intentionally tiny here; T-16 replaces this with the full router.
 * @param {string} screenId one of SCREENS
 */
export function showScreen(screenId) {
  const sections = document.querySelectorAll('.screen[data-screen]');
  sections.forEach((el) => {
    el.hidden = el.dataset.screen !== screenId;
  });
}

// Mark the shell as ready for debugging/manual verification.
document.documentElement.dataset.smileReady = 'true';
