/**
 * SMILE-FA — data/store.js  (T-21, R8/R9.1/R9.4)
 *
 * IndexedDB persistence for sessions and the personal baseline. All data stays
 * on-device (R9.1). Also computes C10 baseline-change z-scores (R8.2) and
 * supports deleting all local data (R9.4).
 *
 * @module data/store
 */

const DB_NAME = 'smilefa';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_META = 'meta';

/** Open (and upgrade) the database. @returns {Promise<IDBDatabase>} */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

/** Generate a session id. */
function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'sess-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

/**
 * Save a session result.
 * @param {object} result analyzeSession output
 * @returns {Promise<string>} session id
 */
export async function saveSession(result) {
  const db = await openDB();
  const id = result.id || uuid();
  const record = { id, savedAt: new Date().toISOString(), ...result };
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_SESSIONS, 'readwrite');
    const req = store.put(record);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

/** List all sessions, newest first. @returns {Promise<object[]>} */
export async function listSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_SESSIONS, 'readonly').getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)));
    req.onerror = () => reject(req.error);
  });
}

/** Delete one session. @param {string} id */
export async function deleteSession(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_SESSIONS, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete ALL local data (R9.4). */
export async function deleteAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction([STORE_SESSIONS, STORE_META], 'readwrite');
    t.objectStore(STORE_SESSIONS).clear();
    t.objectStore(STORE_META).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/**
 * Set the personal baseline to a session id (R8.1).
 * @param {string} sessionId
 */
export async function setBaseline(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_META, 'readwrite').put({ key: 'baseline', sessionId });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Get the baseline session id, or null. @returns {Promise<string|null>} */
export async function getBaselineId() {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = tx(db, STORE_META, 'readonly').get('baseline');
    req.onsuccess = () => resolve(req.result ? req.result.sessionId : null);
    req.onerror = () => resolve(null);
  });
}

/** Key metrics tracked for baseline z (C10). */
const BASELINE_KEYS = ['S02', 'B02', 'R02', 'C03'];

/**
 * Compute C10 baseline-change z: max |z| among key metrics vs baseline mean/SD.
 * Needs ≥2 prior sessions for SD; SD floored to avoid divide-by-noise.
 *
 * @param {object} current analyzeSession output
 * @param {object[]} history prior sessions (excluding current)
 * @param {number} [sdFloor=0.5] minimum SD (Q11-style floor)
 * @returns {number|null}
 */
export function baselineChangeZ(current, history, sdFloor = 0.5) {
  if (!history || history.length < 2) return null;
  const valueOf = (sess, key) => {
    if (key === 'C03') return sess.composites ? sess.composites.C03_SMILE_FAI : null;
    return sess.metrics && sess.metrics[key] ? sess.metrics[key].value : null;
  };
  let maxZ = 0, any = false;
  for (const key of BASELINE_KEYS) {
    const vals = history.map((s) => valueOf(s, key)).filter((v) => typeof v === 'number');
    const cur = valueOf(current, key);
    if (vals.length < 2 || typeof cur !== 'number') continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1);
    const sd = Math.max(Math.sqrt(variance), sdFloor);
    const z = Math.abs((cur - mean) / sd);
    if (z > maxZ) maxZ = z;
    any = true;
  }
  return any ? maxZ : null;
}
