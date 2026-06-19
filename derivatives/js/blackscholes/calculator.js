/**
 * Black-Scholes-Merton European call and put pricing.
 * This module provides d1, d2, validation, call and put price.
 * Depends on a global normalCdf() function (from normal-cdf.js).
 */

function computeD1(S0, K, r, sigma, T) {
  if (S0 <= 0 || K <= 0 || sigma <= 0 || T <= 0) {
    return NaN;
  }
  var numerator = Math.log(S0 / K) + (r + (sigma * sigma) / 2.0) * T;
  var denominator = sigma * Math.sqrt(T);
  return numerator / denominator;
}

function computeD2(d1, sigma, T) {
  if (isNaN(d1) || sigma <= 0 || T <= 0) {
    return NaN;
  }
  return d1 - sigma * Math.sqrt(T);
}

function validateInputs(inputs) {
  var S0 = inputs.S0;
  var K = inputs.K;
  var r = inputs.r;
  var sigma = inputs.sigma;
  var T = inputs.T;

  var errors = [];
  if (typeof S0 !== 'number' || isNaN(S0) || S0 <= 0) {
    errors.push("Spot price S₀ must be greater than 0.");
  }
  if (typeof K !== 'number' || isNaN(K) || K <= 0) {
    errors.push("Strike price K must be greater than 0.");
  }
  if (typeof r !== 'number' || isNaN(r)) {
    errors.push("Risk-free rate r must be a number.");
  }
  if (typeof sigma !== 'number' || isNaN(sigma) || sigma <= 0) {
    errors.push("Volatility σ must be greater than 0.");
  }
  if (typeof T !== 'number' || isNaN(T) || T <= 0) {
    errors.push("Time to maturity T must be greater than 0.");
  }
  if (errors.length > 0) {
    return errors;
  }
  return null;
}

function blackScholesCallPrice(S0, K, r, sigma, T) {
  var validation = validateInputs({ S0: S0, K: K, r: r, sigma: sigma, T: T });
  if (validation !== null) {
    return {
      c: NaN,
      d1: NaN,
      d2: NaN,
      Nd1: NaN,
      Nd2: NaN
    };
  }

  var d1 = computeD1(S0, K, r, sigma, T);
  var d2 = computeD2(d1, sigma, T);
  var Nd1 = normalCdf(d1);
  var Nd2 = normalCdf(d2);

  var price = S0 * Nd1 - K * Math.exp(-r * T) * Nd2;

  return {
    c: price,
    d1: d1,
    d2: d2,
    Nd1: Nd1,
    Nd2: Nd2
  };
}

function blackScholesPutPrice(S0, K, r, sigma, T) {
  var validation = validateInputs({ S0: S0, K: K, r: r, sigma: sigma, T: T });
  if (validation !== null) {
    return {
      p: NaN,
      d1: NaN,
      d2: NaN,
      Nd1: NaN,
      Nd2: NaN
    };
  }

  var d1 = computeD1(S0, K, r, sigma, T);
  var d2 = computeD2(d1, sigma, T);
  var Nd1_ = normalCdf(-d1);
  var Nd2_ = normalCdf(-d2);

  var p = K * Math.exp(-r * T) * Nd2_ - S0 * Nd1_;

  return {
    p: p,
    d1: d1,
    d2: d2,
    Nd1: Nd1_,
    Nd2: Nd2_
  };
}

// Attach to global object for browser / test runners
if (typeof window !== 'undefined') {
  window.computeD1 = computeD1;
  window.computeD2 = computeD2;
  window.validateInputs = validateInputs;
  window.blackScholesCallPrice = blackScholesCallPrice;
  window.blackScholesPutPrice = blackScholesPutPrice;
}
if (typeof global !== 'undefined') {
  global.computeD1 = computeD1;
  global.computeD2 = computeD2;
  global.validateInputs = validateInputs;
  global.blackScholesCallPrice = blackScholesCallPrice;
  global.blackScholesPutPrice = blackScholesPutPrice;
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeD1: computeD1,
    computeD2: computeD2,
    validateInputs: validateInputs,
    blackScholesCallPrice: blackScholesCallPrice,
    blackScholesPutPrice: blackScholesPutPrice
  };
}
