(function() {
  var tests = [];
  var assert = window.testUtils.assert;
  var assertAlmostEqual = window.testUtils.assertAlmostEqual;

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  // ============================================================
  //  Implied volatility
  // ============================================================

  test('round‑trip ATM moderate T', function () {
    var S0 = 100, K = 100, r = 0.05, sigmaTrue = 0.2, T = 1.0;
    var call = blackScholesCallPrice(S0, K, r, sigmaTrue, T);
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: call.c });
    assert(res.converged === true, 'ATM converged');
    assertAlmostEqual(res.sigma, sigmaTrue, 1e-3, 'ATM sigma within 1e-3');
  });

  test('round‑trip deep ITM', function () {
    var S0 = 120, K = 80, sigmaTrue = 0.3, r = 0.02, T = 0.5;
    var call = blackScholesCallPrice(S0, K, r, sigmaTrue, T);
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: call.c });
    assert(res.converged === true, 'deep ITM converged');
    assertAlmostEqual(res.sigma, sigmaTrue, 1e-3, 'deep ITM sigma within 1e-3');
  });

  test('round‑trip deep OTM', function () {
    var S0 = 80, K = 120, sigmaTrue = 0.25, r = 0.02, T = 0.5;
    var call = blackScholesCallPrice(S0, K, r, sigmaTrue, T);
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: call.c });
    assert(res.converged === true, 'deep OTM converged');
    assertAlmostEqual(res.sigma, sigmaTrue, 1e-3, 'deep OTM sigma within 1e-3');
  });

  test('round‑trip short T', function () {
    var S0 = 100, K = 100, sigmaTrue = 0.15, r = 0.03, T = 0.01;
    var call = blackScholesCallPrice(S0, K, r, sigmaTrue, T);
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: call.c });
    assert(res.converged === true, 'short T converged');
    assertAlmostEqual(res.sigma, sigmaTrue, 1e-3, 'short T sigma within 1e-3');
  });

  test('invalid S0 = 0', function () {
    var res = impliedVolatilityCall({ S0: 0, K: 100, r: 0.05, T: 1, marketPrice: 10 });
    assert(res.converged === false && res.sigma === null && res.reason === 'invalid_input',
           'S0=0 should be invalid');
  });

  test('invalid T = 0', function () {
    var res = impliedVolatilityCall({ S0: 100, K: 100, r: 0.05, T: 0, marketPrice: 10 });
    assert(res.converged === false && res.sigma === null && res.reason === 'invalid_input',
           'T=0 should be invalid');
  });

  test('negative marketPrice', function () {
    var res = impliedVolatilityCall({ S0: 100, K: 100, r: 0.05, T: 1, marketPrice: -5 });
    assert(res.converged === false && res.sigma === null && res.reason === 'invalid_input',
           'negative marketPrice should be invalid');
  });

  test('non‑finite marketPrice', function () {
    var res = impliedVolatilityCall({ S0: 100, K: 100, r: 0.05, T: 1, marketPrice: NaN });
    assert(res.converged === false && res.sigma === null && res.reason === 'invalid_input',
           'non‑finite marketPrice should be invalid');
  });

  test('missing marketPrice', function () {
    var res = impliedVolatilityCall({ S0: 100, K: 100, r: 0.05, T: 1 });
    assert(res.converged === false && res.sigma === null && res.reason === 'invalid_input',
           'missing marketPrice should be invalid');
  });

  test('price below lower bound', function () {
    var S0 = 100, K = 80, r = 0.05, T = 1;
    var discount = Math.exp(-r * T);
    var lowerBound = Math.max(S0 - K * discount, 0);   // ≈ 23.9
    assert( lowerBound > 1e-8, 'lower bound > 0 for test');
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: 20 });
    assert(res.converged === false && res.sigma === null && res.reason === 'no_arbitrage_violation',
           'price below lower bound should be a violation');
  });

  test('price above upper bound', function () {
    var S0 = 100, K = 80, r = 0.05, T = 1;
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: 105 });
    assert(res.converged === false && res.sigma === null && res.reason === 'no_arbitrage_violation',
           'price above S0 should be a violation');
  });

  test('no bracket (price = S0)', function () {
    var S0 = 100, K = 80, r = 0.05, T = 1;
    var res = impliedVolatilityCall({ S0: S0, K: K, r: r, T: T, marketPrice: S0 });
    assert(res.converged === false && res.sigma === null && res.reason === 'no_bracket',
           'price == S0 should cause no bracket');
  });

  test('max iterations with small limit', function () {
    var S0 = 100, K = 100, sigmaTrue = 0.2, r = 0.05, T = 1;
    var call = blackScholesCallPrice(S0, K, r, sigmaTrue, T);
    var res = impliedVolatilityCall(
      { S0: S0, K: K, r: r, T: T, marketPrice: call.c },
      { maxIterations: 1, priceTolerance: 1e-12 }
    );
    assert(res.converged === false && res.reason === 'max_iterations',
           'maxIterations=1 should fail with max_iterations');
  });

  window.impliedVolatilityTests = tests;

  // ============================================================
  //  Implied time (variable = T)
  // ============================================================
  var timeTests = [];
  function testTime(name, fn) {
    timeTests.push({ name: name, fn: fn });
  }

  testTime('round‑trip ATM moderate T', function () {
    var S0 = 100, K = 100, r = 0.05, sigma = 0.2, trueT = 1.0;
    var call = blackScholesCallPrice(S0, K, r, sigma, trueT);
    var res = solveForVariable({
      variable: 'T',
      S0: S0,
      K: K,
      r: r,
      sigma: sigma,
      marketPrice: call.c
    });
    assert(res.converged === true, 'ATM T converged');
    assertAlmostEqual(res.value, trueT, 1e-4, 'T recovered');
  });

  testTime('round‑trip deep ITM', function () {
    var S0 = 120, K = 80, r = 0.02, sigma = 0.3, trueT = 0.5;
    var call = blackScholesCallPrice(S0, K, r, sigma, trueT);
    var res = solveForVariable({
      variable: 'T',
      S0: S0,
      K: K,
      r: r,
      sigma: sigma,
      marketPrice: call.c
    });
    assert(res.converged === true, 'deep ITM T converged');
    assertAlmostEqual(res.value, trueT, 1e-4, 'T recovered');
  });

  testTime('round‑trip deep OTM', function () {
    var S0 = 80, K = 120, r = 0.02, sigma = 0.25, trueT = 0.5;
    var call = blackScholesCallPrice(S0, K, r, sigma, trueT);
    var res = solveForVariable({
      variable: 'T',
      S0: S0,
      K: K,
      r: r,
      sigma: sigma,
      marketPrice: call.c
    });
    assert(res.converged === true, 'deep OTM T converged');
    assertAlmostEqual(res.value, trueT, 1e-4, 'T recovered');
  });

  testTime('very small maturity', function () {
    var S0 = 100, K = 95, r = 0.05, sigma = 0.2, trueT = 0.001;
    var call = blackScholesCallPrice(S0, K, r, sigma, trueT);
    var res = solveForVariable({
      variable: 'T',
      S0: S0,
      K: K,
      r: r,
      sigma: sigma,
      marketPrice: call.c
    });
    assert(res.converged === true, 'very small T converged');
    assertAlmostEqual(res.value, trueT, 1e-4, 'T recovered');
  });

  testTime('negative marketPrice', function () {
    var res = solveForVariable({
      variable: 'T',
      S0: 100,
      K: 100,
      r: 0.05,
      sigma: 0.2,
      marketPrice: -5
    });
    assert(res.converged === false && res.reason === 'Market price must be ≥ 0.',
           'negative marketPrice should be invalid');
  });

  testTime('missing marketPrice', function () {
    var res = solveForVariable({
      variable: 'T',
      S0: 100,
      K: 100,
      r: 0.05,
      sigma: 0.2
    });
    assert(res.converged === false && res.reason === 'Market price must be ≥ 0.',
           'missing marketPrice should be invalid');
  });

  testTime('non‑finite marketPrice (NaN)', function () {
    var res = solveForVariable({
      variable: 'T',
      S0: 100,
      K: 100,
      r: 0.05,
      sigma: 0.2,
      marketPrice: NaN
    });
    assert(res.converged === false && res.reason === 'Market price must be ≥ 0.',
           'NaN marketPrice should be invalid');
  });

  testTime('marketPrice too high -> no bracket', function () {
    var res = solveForVariable({
      variable: 'T',
      S0: 100,
      K: 80,
      r: 0.05,
      sigma: 0.2,
      marketPrice: 110
    });
    assert(res.converged === false && res.reason === 'no_bracket',
           'price above maximum attainable should cause no_bracket');
  });

  testTime('max iterations with small limit', function () {
    var S0 = 100, K = 100, r = 0.05, sigma = 0.2, trueT = 1.0;
    var call = blackScholesCallPrice(S0, K, r, sigma, trueT);
    var res = solveForVariable({
      variable: 'T',
      S0: S0,
      K: K,
      r: r,
      sigma: sigma,
      marketPrice: call.c,
      maxIter: 1,
      tolerance: 1e-12
    });
    assert(res.converged === false && res.reason === 'max_iterations',
           'maxIterations=1 should fail with max_iterations');
  });

  // ============================================================
  //  Implied spot price (variable: 'S0')
  // ============================================================
  var spotTests = [];

  function spotTest(name, fn) {
    spotTests.push({ name: name, fn: fn });
  }

  function solveS0(K, r, sigma, T, marketPrice) {
    return solveForVariable({
      variable: 'S0',
      S0: undefined, K: K, r: r, sigma: sigma, T: T,
      marketPrice: marketPrice,
      maxIter: 200,
      tolerance: 1e-7
    });
  }

  spotTest('ATM round-trip', function() {
    var price = blackScholesCallPrice(100, 100, 0.05, 0.2, 1).c;
    var res = solveS0(100, 0.05, 0.2, 1, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 100, 1e-4);
  });

  spotTest('ITM round-trip', function() {
    var price = blackScholesCallPrice(120, 100, 0.03, 0.25, 0.5).c;
    var res = solveS0(100, 0.03, 0.25, 0.5, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 120, 1e-4);
  });

  spotTest('OTM round-trip', function() {
    var price = blackScholesCallPrice(80, 100, 0.02, 0.3, 2).c;
    var res = solveS0(100, 0.02, 0.3, 2, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 80, 1e-4);
  });

  spotTest('Extreme parameters still converge or clean failure', function() {
    var price = blackScholesCallPrice(100, 100, 0.05, 0.0001, 1).c;
    var res = solveS0(100, 0.05, 0.0001, 1, price);
    if (res.converged) {
      assertAlmostEqual(res.value, 100, 0.5);
    } else {
      assert(res.reason !== undefined, 'Clean failure');
    }
  });

  // ============================================================
  //  Implied strike (variable: 'K')
  // ============================================================
  var strikeTests = [];

  function strikeTest(name, fn) {
    strikeTests.push({ name: name, fn: fn });
  }

  function solveK(S0, r, sigma, T, marketPrice) {
    return solveForVariable({
      variable: 'K',
      S0: S0, K: undefined, r: r, sigma: sigma, T: T,
      marketPrice: marketPrice,
      maxIter: 200,
      tolerance: 1e-7
    });
  }

  strikeTest('ITM round-trip', function() {
    var price = blackScholesCallPrice(100, 80, 0.05, 0.2, 1).c;
    var res = solveK(100, 0.05, 0.2, 1, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 80, 1e-4);
  });

  strikeTest('OTM round-trip', function() {
    var price = blackScholesCallPrice(100, 120, 0.05, 0.2, 1).c;
    var res = solveK(100, 0.05, 0.2, 1, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 120, 1e-4);
  });

  strikeTest('Price above S0 (no bracket)', function() {
    var res = solveK(100, 0.05, 0.2, 1, 105);
    assert(!res.converged && res.reason === 'no_bracket', 'Should get no_bracket');
  });

  strikeTest('Very deep ITM – still converges', function() {
    var price = blackScholesCallPrice(200, 50, 0.05, 0.2, 0.5).c;
    var res = solveK(200, 0.05, 0.2, 0.5, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 50, 1e-4);
  });

  // ============================================================
  //  Implied risk‑free rate (variable: 'r')
  // ============================================================
  var rateTests = [];

  function rateTest(name, fn) {
    rateTests.push({ name: name, fn: fn });
  }

  function solveR(S0, K, sigma, T, marketPrice) {
    return solveForVariable({
      variable: 'r',
      S0: S0, K: K, r: undefined, sigma: sigma, T: T,
      marketPrice: marketPrice,
      maxIter: 200,
      tolerance: 1e-7
    });
  }

  rateTest('ATM round-trip r=0.05', function() {
    var price = blackScholesCallPrice(100, 100, 0.05, 0.2, 1).c;
    var res = solveR(100, 100, 0.2, 1, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 0.05, 1e-4);
  });

  rateTest('Negative rate round-trip', function() {
    var price = blackScholesCallPrice(100, 100, -0.02, 0.2, 1).c;
    var res = solveR(100, 100, 0.2, 1, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, -0.02, 1e-4);
  });

  rateTest('High rate round-trip', function() {
    var price = blackScholesCallPrice(100, 100, 0.5, 0.2, 0.5).c;
    var res = solveR(100, 100, 0.2, 0.5, price);
    assert(res.converged, 'Should converge');
    assertAlmostEqual(res.value, 0.5, 1e-3);
  });

  rateTest('Impossible negative price – fails', function() {
    var res = solveR(100, 100, 0.2, 1, -0.1);
    assert(!res.converged, 'Should fail for negative price');
  });

  // ============================================================
  //  Discrete dividends (equity)
  // ============================================================
  var dividendTests = [];

  function divTest(name, fn) {
    dividendTests.push({ name: name, fn: fn });
  }

  function solveWithDiv(variable, params) {
    return solveForVariable({
      variable: variable,
      S0: params.S0,
      K: params.K,
      r: params.r,
      sigma: params.sigma,
      T: params.T,
      marketPrice: params.marketPrice,
      maxIter: params.maxIter || 200,
      tolerance: params.tolerance || 1e-7,
      carry: {
        type: 'equity',
        dividends: params.dividends || [],
        q: 0,
        rf: 0
      }
    });
  }

  divTest('IV round‑trip with a single dividend at 0.5y', function () {
    var S0 = 100, K = 100, r = 0.05, sigmaTrue = 0.2, T = 1;
    var dividends = [{time: 0.5, amount: 2}];
    var adj = computeAdjustedInputs({
      type: 'equity', S0: S0, T: T, r: r, q: 0, rf: 0,
      dividends: dividends
    });
    var call = blackScholesCallPrice(adj.S_adj, K, adj.r_adj, sigmaTrue, T);
    var res = solveWithDiv('sigma', {
      S0: S0, K: K, r: r, T: T, marketPrice: call.c,
      dividends: dividends
    });
    assert(res.converged === true, 'Converged');
    assertAlmostEqual(res.sigma, sigmaTrue, 1e-3, 'IV recovered');
  });

  divTest('IV round‑trip with multiple dividends', function () {
    var S0 = 100, K = 100, r = 0.05, sigmaTrue = 0.2, T = 1;
    var dividends = [{time: 0.2, amount: 1}, {time: 0.8, amount: 1.5}];
    var adj = computeAdjustedInputs({
      type: 'equity', S0: S0, T: T, r: r, q: 0, rf: 0,
      dividends: dividends
    });
    var call = blackScholesCallPrice(adj.S_adj, K, adj.r_adj, sigmaTrue, T);
    var res = solveWithDiv('sigma', {
      S0: S0, K: K, r: r, T: T, marketPrice: call.c,
      dividends: dividends
    });
    assert(res.converged === true, 'Converged');
    assertAlmostEqual(res.sigma, sigmaTrue, 1e-3, 'IV recovered');
  });

  divTest('Time round‑trip with dividends', function () {
    var S0 = 100, K = 100, r = 0.05, sigma = 0.2, trueT = 1;
    var dividends = [{time: 0.3, amount: 3}];
    var adj = computeAdjustedInputs({
      type: 'equity', S0: S0, T: trueT, r: r, q: 0, rf: 0,
      dividends: dividends
    });
    var call = blackScholesCallPrice(adj.S_adj, K, adj.r_adj, sigma, trueT);
    var res = solveWithDiv('T', {
      S0: S0, K: K, r: r, sigma: sigma, marketPrice: call.c,
      dividends: dividends
    });
    assert(res.converged === true, 'Converged');
    assertAlmostEqual(res.value, trueT, 1e-4, 'T recovered');
  });

  divTest('S0 round‑trip with dividends', function () {
    var S0True = 100, K = 100, r = 0.05, sigma = 0.2, T = 1;
    var dividends = [{time: 0.4, amount: 4}];
    var adj = computeAdjustedInputs({
      type: 'equity', S0: S0True, T: T, r: r, q: 0, rf: 0,
      dividends: dividends
    });
    var call = blackScholesCallPrice(adj.S_adj, K, adj.r_adj, sigma, T);
    var res = solveWithDiv('S0', {
      S0: undefined, K: K, r: r, sigma: sigma, T: T,
      marketPrice: call.c, dividends: dividends
    });
    assert(res.converged === true, 'Converged');
    assertAlmostEqual(res.value, S0True, 1e-4, 'S0 recovered');
  });

  divTest('K round‑trip with dividends', function () {
    var S0 = 100, KTrue = 90, r = 0.05, sigma = 0.2, T = 1;
    var dividends = [{time: 0.7, amount: 2}];
    var adj = computeAdjustedInputs({
      type: 'equity', S0: S0, T: T, r: r, q: 0, rf: 0,
      dividends: dividends
    });
    var call = blackScholesCallPrice(adj.S_adj, KTrue, adj.r_adj, sigma, T);
    var res = solveWithDiv('K', {
      S0: S0, K: undefined, r: r, sigma: sigma, T: T,
      marketPrice: call.c, dividends: dividends
    });
    assert(res.converged === true, 'Converged');
    assertAlmostEqual(res.value, KTrue, 1e-4, 'K recovered');
  });

  divTest('r round‑trip with dividends', function () {
    var S0 = 100, K = 100, rTrue = 0.05, sigma = 0.2, T = 1;
    var dividends = [{time: 0.5, amount: 2}];
    var adj = computeAdjustedInputs({
      type: 'equity', S0: S0, T: T, r: rTrue, q: 0, rf: 0,
      dividends: dividends
    });
    var call = blackScholesCallPrice(adj.S_adj, K, adj.r_adj, sigma, T);
    var res = solveWithDiv('r', {
      S0: S0, K: K, r: undefined, sigma: sigma, T: T,
      marketPrice: call.c, dividends: dividends
    });
    assert(res.converged === true, 'Converged');
    assertAlmostEqual(res.value, rTrue, 1e-4, 'r recovered');
  });

  divTest('Clean failure for invalid dividend (time < 0)', function () {
    var dividends = [{time: -0.1, amount: 2}];
    var res = solveWithDiv('sigma', {
      S0: 100, K: 100, r: 0.05, T: 1,
      marketPrice: 5, dividends: dividends
    });
    assert(!res.converged, 'Should fail on invalid dividend');
  });

  divTest('No‑arbitrage violation with excessive dividends', function () {
    var S0 = 100, K = 80, r = 0.05, T = 1;
    var dividends = [{time: 0.1, amount: 110}];  // makes S0‑adj negative
    var res = solveWithDiv('sigma', {
      S0: S0, K: K, r: r, T: T,
      marketPrice: 10, dividends: dividends
    });
    assert(!res.converged, 'Should fail because adjusted S0 <= 0');
  });

  // ---- Update the exports (window) ----
  window.impliedVolatilityTests = tests;
  window.impliedTimeTests = timeTests;
  window.impliedSpotTests = spotTests;
  window.impliedStrikeTests = strikeTests;
  window.impliedRateTests = rateTests;
  window.impliedDividendTests = dividendTests;

  // ---- Node.js export ----
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      'Implied Volatility': tests,
      'Implied Time': timeTests,
      'Implied Spot': spotTests,
      'Implied Strike': strikeTests,
      'Implied Rate': rateTests,
      'Implied Dividends': dividendTests
    };
  }
})();
