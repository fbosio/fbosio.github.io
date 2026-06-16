(function () {
  var tests = [];
  var assert = window.testUtils.assert;
  var assertAlmostEqual = window.testUtils.assertAlmostEqual;

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  // ---- Equity: no adjustment ----
  test("Equity: S_adj = S0", function () {
    var result = computeAdjustedInputs({
      type: "equity",
      S0: 100,
      T: 0.5,
      r: 0.05
    });

    assertAlmostEqual(result.S_adj, 100, 1e-10, "effective spot should equal S0");
    assertAlmostEqual(result.r_adj, 0.05, 1e-10, "risk-free rate unchanged");
  });

  // ---- Continuous dividend yield ----
  test("Equity with continuous yield: S_adj = S0 * exp(-q * T)", function () {
    var S0 = 100;
    var q = 0.03;
    var T = 1;
    var expected = S0 * Math.exp(-q * T);

    var result = computeAdjustedInputs({
      type: "equity",
      S0: S0,
      T: T,
      r: 0.05,
      q: q
    });

    assertAlmostEqual(result.S_adj, expected, 1e-10, "effective spot with continuous yield");
    assertAlmostEqual(result.r_adj, 0.05, 1e-10);
  });

  // ---- Discrete dividends ----
  test("Discrete dividends: S_adj = S0 - Σ D_i * exp(-r * t_i)", function () {
    var S0 = 100;
    var r = 0.05;
    var T = 0.5;
    var dividends = [
      { amount: 2.0, time: 0.2 },
      { amount: 1.5, time: 0.4 }
    ];
    var pv = 2.0 * Math.exp(-r * 0.2) + 1.5 * Math.exp(-r * 0.4);
    var expected = S0 - pv;

    var result = computeAdjustedInputs({
      type: "equity",
      S0: S0,
      T: T,
      r: r,
      dividends: dividends
    });

    assertAlmostEqual(result.S_adj, expected, 1e-10, "effective spot after discrete dividends");
    assertAlmostEqual(result.r_adj, r, 1e-10);
  });

  test("Discrete dividends: ignores cash flows after T", function () {
    var S0 = 100;
    var r = 0.05;
    var T = 0.5;
    var dividends = [
      { amount: 2.0, time: 0.6 },
      { amount: 1.0, time: 0.2 }
    ];
    var pv = 1.0 * Math.exp(-r * 0.2);
    var expected = S0 - pv;

    var result = computeAdjustedInputs({
      type: "equity",
      S0: S0,
      T: T,
      r: r,
      dividends: dividends
    });

    assertAlmostEqual(result.S_adj, expected, 1e-10, "only dividends before expiry are counted");
  });

  // ---- Index ----
  test("Index: S_adj = S0 * exp(-q * T)", function () {
    var S0 = 100;
    var q = 0.02;
    var T = 0.75;
    var expected = S0 * Math.exp(-q * T);

    var result = computeAdjustedInputs({
      type: "index",
      S0: S0,
      T: T,
      r: 0.05,
      q: q
    });

    assertAlmostEqual(result.S_adj, expected, 1e-10);
    assertAlmostEqual(result.r_adj, 0.05, 1e-10);
  });

  // ---- Currency ----
  test("Currency: S_adj = S0 * exp(-rf * T)", function () {
    var S0 = 1.25;
    var rf = 0.01;
    var T = 0.5;
    var expected = S0 * Math.exp(-rf * T);

    var result = computeAdjustedInputs({
      type: "currency",
      S0: S0,
      T: T,
      r: 0.03,
      rf: rf
    });

    assertAlmostEqual(result.S_adj, expected, 1e-10);
    assertAlmostEqual(result.r_adj, 0.03, 1e-10);
  });

  test("Currency with q fallback: S_adj = S0 * exp(-q * T)", function () {
    var S0 = 1.25;
    var q = 0.01;   // same numerical effect as rf
    var T = 0.5;
    var expected = S0 * Math.exp(-q * T);

    var result = computeAdjustedInputs({
      type: "currency",
      S0: S0,
      T: T,
      r: 0.03,
      q: q   // no rf provided
    });

    assertAlmostEqual(result.S_adj, expected, 1e-10);
    assertAlmostEqual(result.r_adj, 0.03, 1e-10);
  });

  // ---- Futures ----
  test("Futures: pass through observed futures price", function () {
    var F0 = 50;
    var r = 0.04;
    var T = 0.25;

    var result = computeAdjustedInputs({
      type: "futures",
      S0: F0,
      T: T,
      r: r
    });

    assertAlmostEqual(result.S_adj, F0, 1e-10, "futures price should pass through unchanged");
    assertAlmostEqual(result.r_adj, r, 1e-10);
  });

  // ---- Edge cases ----
  test("Empty dividend list -> S_adj = S0", function () {
    var result = computeAdjustedInputs({
      type: "equity",
      S0: 100,
      T: 0.5,
      r: 0.05,
      dividends: []
    });

    assertAlmostEqual(result.S_adj, 100, 1e-10);
  });

  test("Zero continuous yield -> S_adj = S0", function () {
    var result = computeAdjustedInputs({
      type: "equity",
      S0: 100,
      T: 0.5,
      r: 0.05,
      q: 0
    });

    assertAlmostEqual(result.S_adj, 100, 1e-10);
  });

  window.carryTests = tests;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = tests;
  }
})();
