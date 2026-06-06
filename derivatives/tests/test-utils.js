(function() {
  window.testUtils = {
    assert: function(condition, message) {
      if (!condition) {
        throw new Error(message || "Assertion failed");
      }
    },
    assertAlmostEqual: function(actual, expected, tolerance, message) {
      var tol = tolerance || 1e-4;
      var diff = Math.abs(actual - expected);
      if (isNaN(actual) || isNaN(expected) || diff > tol) {
        throw new Error((message || "") + " Expected " + expected + " within " + tol + " but got " + actual);
      }
    }
  };
})();
