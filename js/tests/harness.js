/**
 * SMILE-FA — tests/harness.js
 *
 * Minimal browser test harness (no framework, no build). Tests register with
 * describe/it and assertions; runAll() executes them and returns a summary the
 * tests.html page renders. Pure JS, runs in any modern browser.
 *
 * @module tests/harness
 */

/** @type {{name:string, fn:Function}[]} */
const suites = [];
let current = null;

/**
 * Register a suite.
 * @param {string} name
 * @param {() => void} fn defines it() cases synchronously
 */
export function describe(name, fn) {
  const suite = { name, cases: /** @type {{name:string, fn:Function}[]} */ ([]) };
  current = suite;
  fn();
  current = null;
  suites.push(suite);
}

/**
 * Register a test case.
 * @param {string} name
 * @param {() => void|Promise<void>} fn
 */
export function it(name, fn) {
  if (!current) throw new Error('it() called outside describe()');
  current.cases.push({ name, fn });
}

/* ---- Assertions ------------------------------------------------------- */

export function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * Assert |actual - expected| <= tol.
 * @param {number} actual
 * @param {number} expected
 * @param {number} tol
 * @param {string} [msg]
 */
export function assertClose(actual, expected, tol, msg) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(msg || `expected ${expected} ± ${tol}, got ${actual}`);
  }
}

export function assertNull(actual, msg) {
  if (actual !== null) throw new Error(msg || `expected null, got ${JSON.stringify(actual)}`);
}

/**
 * Run all registered suites.
 * @returns {Promise<{passed:number, failed:number, results:Array}>}
 */
export async function runAll() {
  let passed = 0, failed = 0;
  const results = [];
  for (const suite of suites) {
    const suiteResult = { name: suite.name, cases: [] };
    for (const c of suite.cases) {
      try {
        await c.fn();
        suiteResult.cases.push({ name: c.name, ok: true });
        passed++;
      } catch (err) {
        suiteResult.cases.push({ name: c.name, ok: false, error: err.message });
        failed++;
      }
    }
    results.push(suiteResult);
  }
  return { passed, failed, results };
}
