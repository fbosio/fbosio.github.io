/**
 * Abramowitz-Stegun 7.1.26 approximation for the error function.
 * Accurate to about 1.5e-7.
 * Reference: https://personal.math.ubc.ca/~cbm/aands/page_299.htm
 * Horner's implementation reference: https://www.johndcook.com/blog/2009/01/19/stand-alone-error-function-erf/
 *
 * @param {number} x - The input value.
 * @returns {number} The approximated erf(x).
 */
function erf(x) {
  var sign = x < 0 ? -1 : 1;
  var absX = Math.abs(x);

  var p = 0.3275911;
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;

  var t = 1.0 / (1.0 + p * absX);
  
  // Horner's method implementation
  var term = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  var erfVal = 1.0 - term * Math.exp(-absX * absX);

  return sign * erfVal;
}

/**
 * Standard normal cumulative distribution function.
 *
 * @param {number} x - The input value.
 * @returns {number} The cumulative probability under the standard normal curve.
 */
function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}
