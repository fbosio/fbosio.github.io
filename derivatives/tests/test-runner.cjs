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
  global.blackScholesPutPrice = global.blackScholesPutPrice || calcMod.blackScholesPutPrice;
}

var solverMod = require('../js/blackscholes/solver');

if (typeof solverMod === 'function') {
  // unlikely, but handle gracefully
  global.solveForVariable = global.solveForVariable || solverMod;
} else if (typeof solverMod === 'object') {
  global.solveForVariable = global.solveForVariable || solverMod.solveForVariable;
  global.impliedVolatilityCall = global.impliedVolatilityCall || solverMod.impliedVolatilityCall;
}

// ---------- Load the adjuster module ----------
var adjusterMod = require('../js/carry');
if (typeof adjusterMod === 'object') {
  global.computeAdjustedInputs = global.computeAdjustedInputs || adjusterMod.computeAdjustedInputs;
}

// ---------- Accumulate overall failures ----------
var totalFailed = 0;

// ---------- Helper to run a test suite ----------
function runSuite(title, testArray) {
  console.log("Hey, let's test " + title + "!");
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

// ---------- Automatic test discovery ----------
var path = require('path');
var fs = require('fs');

var testsDir = path.join(__dirname, '.');
var excludedFiles = ['test-utils.js', 'test-runner.cjs', 'test-runner.html'];

function humanize(filename) {
  // Remove '.test.js' suffix, split by '-' or '_', capitalise each word
  var name = filename.replace(/\.test\.js$/i, '');
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
}

function collectTestFiles(dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(collectTestFiles(fullPath));
    } else if (/\.test\.js$/i.test(item) && excludedFiles.indexOf(item) === -1) {
      results.push(fullPath);
    }
  }
  return results;
}

var testFiles = collectTestFiles(testsDir);

for (var f = 0; f < testFiles.length; f++) {
  var filePath = testFiles[f];
  // compute relative path starting from the tests folder
  var relPath = path.relative(testsDir, filePath);
  var exported = require('./' + relPath);
  if (Array.isArray(exported)) {
    // plain array → suite named after the file
    var suiteName = humanize(path.basename(filePath));
    runSuite(suiteName, exported);
  } else if (typeof exported === 'object' && exported !== null) {
    var keys = Object.keys(exported);
    // if keys look like numeric indices, treat as an array‑like single suite
    if (keys.length > 0 && /^\d+$/.test(keys[0])) {
      var suiteName = humanize(path.basename(filePath));
      var testsArr = [];
      for (var k = 0; k < keys.length; k++) testsArr.push(exported[keys[k]]);
      runSuite(suiteName, testsArr);
    } else {
      // named suites – each key is the suite name
      for (var k = 0; k < keys.length; k++) {
        runSuite(keys[k], exported[keys[k]]);
      }
    }
  }
}

// ---------- Set exit code for CI / aider ----------
process.exitCode = totalFailed > 0 ? 1 : 0;
