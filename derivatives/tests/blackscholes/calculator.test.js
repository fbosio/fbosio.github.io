(function() {
  var tests = [];
  var assert = window.testUtils.assert;
  var assertAlmostEqual = window.testUtils.assertAlmostEqual;

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  // ============================================================
  //  Call valuation
  // ============================================================
  test("1. Classic at-the-money benchmark", function() {
    var result = blackScholesCallPrice(100, 100, 0.05, 0.2, 1);
    assertAlmostEqual(result.d1, 0.35, 1e-2, "d1");
    assertAlmostEqual(result.d2, 0.15, 1e-2, "d2");
    assertAlmostEqual(result.c, 10.45058, 1e-4, "price");
  });

  test("2. At-the-money, unit volatility", function() {
    var result = blackScholesCallPrice(100, 100, 0, 1, 1);
    assertAlmostEqual(result.d1, 0.5, 1e-7, "d1");
    assertAlmostEqual(result.d2, -0.5, 1e-7, "d2");
    assertAlmostEqual(result.Nd1, 0.69146, 1e-5, "Nd1");
    assertAlmostEqual(result.Nd2, 0.30853, 1e-5, "Nd2");
    assertAlmostEqual(result.c, 38.29249, 1e-5, "price");
  });

  test("3. Deep in the money", function() {
    var result = blackScholesCallPrice(200, 100, 0.05, 0.2, 1);
    var atm = blackScholesCallPrice(100, 100, 0.05, 0.2, 1);
    assert(result.c > atm.c, "Price should be larger than ATM benchmark");
    assert(result.d1 > 0, "d1 should be positive");
    assert(result.d2 > 0, "d2 should be positive");
  });

  test("4. Deep out of the money", function() {
    var result = blackScholesCallPrice(50, 100, 0.05, 0.2, 1);
    assert(result.c < 1.0, "Price should be small");
    assert(result.d1 < 0, "d1 should be negative");
    assert(result.d2 < 0, "d2 should be negative");
  });

  test("5. Near-zero time to maturity", function() {
    var result = blackScholesCallPrice(100, 100, 0.05, 0.2, 1e-8);
    assertAlmostEqual(result.c, 0, 1e-3, "Price close to intrinsic");
    assert(isFinite(result.c), "Price remains finite");
  });

  test("6. Very high volatility", function() {
    var result = blackScholesCallPrice(100, 100, 0.05, 3, 1);
    assert(result.c > 50, "Price should be high");
    assert(isFinite(result.d1), "d1 remains finite");
    assert(isFinite(result.d2), "d2 remains finite");
  });

  test("7. Long maturity", function() {
    var result = blackScholesCallPrice(100, 100, 0.05, 0.2, 30);
    assert(isFinite(result.c), "Price remains finite");
    assert(result.c > 0, "Price is positive");
  });

  test("8. Negative rate", function() {
    var result = blackScholesCallPrice(100, 100, -0.01, 0.2, 1);
    assert(isFinite(result.c), "Price remains finite");
    assert(!isNaN(result.c), "Price computes normally");
  });

  test("Greeks: delta > 0 - price increases with S0", function() {
    var p1 = blackScholesCallPrice(100, 100, 0.05, 0.2, 1).c;
    var p2 = blackScholesCallPrice(105, 100, 0.05, 0.2, 1).c;
    assert(p2 > p1, "Price increases with spot price");
  });

  test("Greeks: vega > 0 - price increases with sigma", function() {
    var p1 = blackScholesCallPrice(100, 100, 0.05, 0.2, 1).c;
    var p2 = blackScholesCallPrice(100, 100, 0.05, 0.3, 1).c;
    assert(p2 > p1, "Price increases with volatility");
  });

  var callTests = tests.slice();
  tests = [];

  // ============================================================
  //  Put valuation
  // ============================================================
  test("Put: Classic at-the-money benchmark", function() {
    var result = blackScholesPutPrice(100, 100, 0.05, 0.2, 1);
    // Parity: call = 10.45058, put = call - S0 + K*exp(-rT) = 5.573522
    assertAlmostEqual(result.p, 5.573522, 1e-4, "Put price");
  });

  test("Put: Parity with call price", function() {
    var S0 = 100, K = 100, r = 0.05, sigma = 0.2, T = 1;
    var call = blackScholesCallPrice(S0, K, r, sigma, T);
    var put = blackScholesPutPrice(S0, K, r, sigma, T);
    var parityPut = call.c - S0 + K * Math.exp(-r * T);
    assertAlmostEqual(put.p, parityPut, 1e-4, "Parity holds");
  });

  test("Put: Deep in the money (put)", function() {
    var result = blackScholesPutPrice(50, 100, 0.05, 0.2, 1);
    assert(result.p > 45, "Put price should be high");
  });

  test("Put: Deep out of the money (put)", function() {
    var result = blackScholesPutPrice(150, 100, 0.05, 0.2, 1);
    assert(result.p < 1, "Put price should be small");
  });

  test("Put: Invalid S0 = 0 returns NaN", function() {
    var result = blackScholesPutPrice(0, 100, 0.05, 0.2, 1);
    assert(isNaN(result.p), "Put price should be NaN");
    assert(isNaN(result.d1), "d1 should be NaN");
  });

  var putTests = tests;

  window.callTests = callTests;
  window.putTests = putTests;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      'Call valuation': callTests,
      'Put valuation': putTests
    };
  }
})();
