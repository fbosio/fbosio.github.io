(function() {
  var tests = [];
  var assert = window.testUtils.assert;
  var assertAlmostEqual = window.testUtils.assertAlmostEqual;

  // ============================================================
  //  computeAdjustedInputs – discrete dividends
  // ============================================================

  var carryTests = [];

  function carryTest(name, fn) {
    carryTests.push({ name: name, fn: fn });
  }

  carryTest('single dividend reduces S0 by present value', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [{time: 0.5, amount: 2}]
    };
    var adj = computeAdjustedInputs(params);
    var pvDiv = 2 * Math.exp(-0.05 * 0.5);
    var expectedS0 = 100 - pvDiv;
    assertAlmostEqual(adj.S_adj, expectedS0, 1e-8, 'S0 reduced by PV of dividend');
    assertAlmostEqual(adj.r_adj, 0.05, 1e-8, 'r unchanged for equity');
  });

  carryTest('multiple dividends reduce S0 correctly', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [
        {time: 0.2, amount: 1},
        {time: 0.8, amount: 1.5}
      ]
    };
    var adj = computeAdjustedInputs(params);
    var pv1 = 1 * Math.exp(-0.05 * 0.2);
    var pv2 = 1.5 * Math.exp(-0.05 * 0.8);
    var expected = 100 - (pv1 + pv2);
    assertAlmostEqual(adj.S_adj, expected, 1e-8);
  });

  carryTest('dividend at time 0 reduces S0 by full amount', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [{time: 0, amount: 5}]
    };
    var adj = computeAdjustedInputs(params);
    assertAlmostEqual(adj.S_adj, 95, 1e-8, 'S0 reduced by full amount');
  });

  carryTest('dividend after maturity is ignored (time >= T)', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [{time: 1.1, amount: 10}]
    };
    var adj = computeAdjustedInputs(params);
    assertAlmostEqual(adj.S_adj, 100, 1e-8, 'Dividend after T ignored');
  });

  carryTest('empty dividends list leaves S0 unchanged', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: []
    };
    var adj = computeAdjustedInputs(params);
    assertAlmostEqual(adj.S_adj, 100, 1e-8);
  });

  carryTest('no‑dividend field (undefined) leaves S0 unchanged', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0
      // no dividends field
    };
    var adj = computeAdjustedInputs(params);
    assertAlmostEqual(adj.S_adj, 100, 1e-8);
  });

  carryTest('invalid dividend (negative amount) returns NaN S_adj', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [{time: 0.5, amount: -1}]
    };
    var adj = computeAdjustedInputs(params);
    assert(isNaN(adj.S_adj), 'S_adj becomes NaN for negative dividend');
  });

  carryTest('invalid dividend (time > T) is ignored, not NaN', function() {
    var params = {
      type: 'equity', S0: 100, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [{time: 2, amount: 5}]
    };
    var adj = computeAdjustedInputs(params);
    assertAlmostEqual(adj.S_adj, 100, 1e-8, 'S0 unchanged');
  });

  carryTest('adjustment makes S_adj negative returns NaN', function() {
    var params = {
      type: 'equity', S0: 10, T: 1, r: 0.05, q: 0, rf: 0,
      dividends: [{time: 0.5, amount: 12}]
    };
    var adj = computeAdjustedInputs(params);
    assert(isNaN(adj.S_adj), 'S_adj becomes NaN if adjusted S0 < 0');
  });

  window.carryTests = carryTests;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = carryTests;
  }
})();
