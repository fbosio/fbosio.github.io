(function() {
  var tests = [];
  var assert = window.testUtils.assert;
  var assertAlmostEqual = window.testUtils.assertAlmostEqual;

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  test("normalCdf(0) ≈ 0.5", function() {
    assertAlmostEqual(normalCdf(0), 0.5, 1e-7);
  });

  test("symmetry: Φ(-x) = 1 - Φ(x)", function() {
    var values = [0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
    for (var i = 0; i < values.length; i++) {
      var x = values[i];
      assertAlmostEqual(normalCdf(-x), 1 - normalCdf(x), 1e-7, "Symmetry check failed for x = " + x);
    }
  });

  test("68-95-99.7 interval checks", function() {
    assertAlmostEqual(normalCdf(1) - normalCdf(-1), 0.68268, 1e-5);
    assertAlmostEqual(normalCdf(2) - normalCdf(-2), 0.9545, 1e-4);
    assertAlmostEqual(normalCdf(3) - normalCdf(-3), 0.9973, 1e-4);
  });

  test("monotonicity: if a < b, then Φ(a) < Φ(b)", function() {
    var points = [-4, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 4];
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i+1];
      assert(normalCdf(a) < normalCdf(b), "Monotonicity check failed: normalCdf(" + a + ") should be < normalCdf(" + b + ")");
    }
  });

  test("additional checks: Φ(1) ≈ 0.8413447", function() {
    assertAlmostEqual(normalCdf(1), 0.8413447, 1e-5);
  });

  test("additional checks: Φ(2) ≈ 0.9772499", function() {
    assertAlmostEqual(normalCdf(2), 0.9772499, 1e-5);
  });

  test("additional checks: Φ(3) ≈ 0.9986501", function() {
    assertAlmostEqual(normalCdf(3), 0.9986501, 1e-5);
  });

  window.normalCdfTests = tests;
})();
