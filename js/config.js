/**
 * SMILE-FA — config.js
 *
 * Loads the JSON config files (landmarks, thresholds, protocol) once and caches
 * them. Uses fetch (works on GitHub Pages) rather than import assertions.
 *
 * @module config
 */

let cache = null;

/**
 * Load all configs. Cached after first call.
 * @returns {Promise<{landmarks:object, thresholds:object, protocol:object}>}
 */
export async function loadConfigs() {
  if (cache) return cache;
  const [landmarks, thresholds, protocol] = await Promise.all([
    fetch('config/landmarks.json', { cache: 'no-store' }).then((r) => r.json()),
    fetch('config/thresholds.json', { cache: 'no-store' }).then((r) => r.json()),
    fetch('config/protocol.json', { cache: 'no-store' }).then((r) => r.json()),
  ]);
  cache = { landmarks, thresholds, protocol };
  return cache;
}
