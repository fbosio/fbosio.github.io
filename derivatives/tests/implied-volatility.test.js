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
})();
