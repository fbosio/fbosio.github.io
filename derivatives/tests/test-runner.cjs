'use strict';

// ---------- Set up a browser‑like environment for Node ----------
global.window = global;

// Minimal test‑utility implementation (mirrors browser testUtils)
global.testUtils = {
  assert: function(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  },
  assertAlmostEqual: function(actual, expected, tolerance, message) {
    if (typeof tolerance !== 'number') tolerance = 1e-4;
    if (isNaN(actual) || isNaN(expected) || Math.abs(actual - expected) > tolerance) {
      throw new Error(
        (message || '') + ' Expected ' + expected + ' ± ' + tolerance + ' but got ' + actual
      );
    }
  }
};

// ---------- Load the maths modules and expose them globally ----------
var erfMod = require('../js/normal-cdf');

// Ensure global.normalCdf and global.erf are available
if (typeof erfMod === 'function') {
  // module exported a single function (normalCdf)
  global.normalCdf = global.normalCdf || erfMod;
  if (!global.erf && typeof erfMod.erf === 'function') {
    global.erf = erfMod.erf;
  }
} else if (typeof erfMod === 'object') {
  global.normalCdf = global.normalCdf || erfMod.normalCdf;
  global.erf = global.erf || erfMod.erf;
}

var calcMod = require('../js/blackscholes/calculator');

if (typeof calcMod === 'function') {
  // module exported a single function (blackScholesCallPrice)
  global.blackScholesCallPrice = global.blackScholesCallPrice || calcMod;
  if (!global.computeD1 && typeof calcMod.computeD1 === 'function') global.computeD1 = calcMod.computeD1;
  if (!global.computeD2 && typeof calcMod.computeD2 === 'function') global.computeD2 = calcMod.computeD2;
  if (!global.validateInputs && typeof calcMod.validateInputs === 'function') global.validateInputs = calcMod.validateInputs;
} else if (typeof calcMod === 'object') {
  global.blackScholesCallPrice = global.blackScholesCallPrice || calcMod.blackScholesCallPrice;
  global.computeD1 = global.computeD1 || calcMod.computeD1;
  global.computeD2 = global.computeD2 || calcMod.computeD2;
  global.validateInputs = global.validateInputs || calcMod.validateInputs;
}

var solverMod = require('../js/blackscholes/solver');

if (typeof solverMod === 'function') {
  // unlikely, but handle gracefully
  global.solveForVariable = global.solveForVariable || solverMod;
} else if (typeof solverMod === 'object') {
  global.solveForVariable = global.solveForVariable || solverMod.solveForVariable;
  global.impliedVolatilityCall = global.impliedVolatilityCall || solverMod.impliedVolatilityCall;
}

// ---------- Accumulate overall failures ----------
var totalFailed = 0;

// ---------- Helper to run a test suite ----------
function runSuite(title, testArray) {
  console.log('=== ' + title + ' ===');
  var passed = 0;
  var failed = 0;
  for (var i = 0; i < testArray.length; i++) {
    var t = testArray[i];
    try {
      t.fn();
      passed++;
    } catch (err) {
      failed++;
      console.error('  FAIL ' + t.name);
      console.error('    ' + (err.message || err));
    }
  }
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + testArray.length + ' total\n');
  totalFailed += failed;
  return { passed: passed, failed: failed };
}

// ---------- Load the test files (they populate the required arrays) ----------
var normalCdfTests = require('./normal-cdf.test');
var callValTests = require('./blackscholes/calculator.test');
var solverTests = require('./blackscholes/solver.test');

// ---------- Execute every suite ----------
runSuite('Normal CDF', normalCdfTests);
runSuite('Call valuation', callValTests);
runSuite('Implied Volatility', solverTests.impliedVolatilityTests);
runSuite('Implied Time', solverTests.impliedTimeTests);
runSuite('Implied Spot', solverTests.impliedSpotTests);
runSuite('Implied Strike', solverTests.impliedStrikeTests);
runSuite('Implied Rate', solverTests.impliedRateTests);

// ---------- Set exit code for CI / aider ----------
process.exitCode = totalFailed > 0 ? 1 : 0;
