/**
 * Compute d1 parameter of Black-Scholes (Hull notation).
 * Formula: d1 = [ln(S0/K) + (r + sigma^2 / 2) * T] / (sigma * sqrt(T))
 *
 * @param {number} S0 - Stock price at time 0
 * @param {number} K - Strike price
 * @param {number} r - Risk-free interest rate
 * @param {number} sigma - Volatility of the stock price
 * @param {number} T - Time to expiration in years
 * @returns {number} The d1 value, or NaN if inputs are invalid.
 */
function computeD1(S0, K, r, sigma, T) {
  if (S0 <= 0 || K <= 0 || sigma <= 0 || T <= 0) {
    return NaN;
  }
  var numerator = Math.log(S0 / K) + (r + (sigma * sigma) / 2.0) * T;
  var denominator = sigma * Math.sqrt(T);
  return numerator / denominator;
}

/**
 * Compute d2 parameter of Black-Scholes (Hull notation).
 * Formula: d2 = d1 - sigma * sqrt(T)
 *
 * @param {number} d1 - d1 value
 * @param {number} sigma - Volatility of the stock price
 * @param {number} T - Time to expiration in years
 * @returns {number} The d2 value, or NaN if inputs are invalid.
 */
function computeD2(d1, sigma, T) {
  if (isNaN(d1) || sigma <= 0 || T <= 0) {
    return NaN;
  }
  return d1 - sigma * Math.sqrt(T);
}

/**
 * Validate inputs. Returns null if valid, or an array of error messages.
 *
 * @param {object} inputs - Input values { S0, K, r, sigma, T }
 * @returns {string[]|null} Array of validation errors or null if valid.
 */
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

/**
 * Compute Black-Scholes European call option price (Hull notation).
 * Formula: c = S0 * N(d1) - K * e^(-rT) * N(d2)
 *
 * @param {number} S0 - Stock price at time 0
 * @param {number} K - Strike price
 * @param {number} r - Risk-free interest rate
 * @param {number} sigma - Volatility of the stock price
 * @param {number} T - Time to expiration in years
 * @returns {object} Calculated prices and parameters.
 */
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

// ---- Phase 1: implied volatility (bisection) ----

/**
 * Implied volatility of a European call under Black–Scholes.
 *
 * @param {Object} params
 * @param {number} params.S0          Spot price
 * @param {number} params.K           Strike
 * @param {number} params.r           Risk-free rate (continuous compounding)
 * @param {number} params.T           Time to maturity in years
 * @param {number} params.marketPrice Observed call price
 * @param {Object} [options]          Optional tuning parameters.
 * @param {number} [options.maxIterations=50]  Maximum bisection iterations.
 * @param {number} [options.priceTolerance=1e-5]  Convergence tolerance on price error.
 *
 * @returns {Object} result
 */
function impliedVolatilityCall(params) {
  // ----- helpers -----
  function invalid(reason) {
    return { sigma: null, converged: false, reason: reason };
  }

  // ----- input validation -----
  var S0 = params.S0;
  var K  = params.K;
  var r  = params.r;
  var T  = params.T;
  var marketPrice = params.marketPrice;

  if (typeof S0 !== 'number' || isNaN(S0) || S0 <= 0) return invalid('invalid_input');
  if (typeof K  !== 'number' || isNaN(K)  || K  <= 0) return invalid('invalid_input');
  if (typeof T  !== 'number' || isNaN(T)  || T  <= 0) return invalid('invalid_input');
  if (typeof marketPrice !== 'number' || isNaN(marketPrice) || !isFinite(marketPrice) || marketPrice < 0) return invalid('invalid_input');

  // ----- no‑arbitrage bounds -----
  var discount = Math.exp(-r * T);
  var lowerBound = Math.max(S0 - K * discount, 0);
  var upperBound = S0;
  var eps = 1e-8;                     // used to treat exact bounds as valid
  if (marketPrice < lowerBound - eps || marketPrice > upperBound + eps) {
    return invalid('no_arbitrage_violation');
  }

  // ----- optional parameters -----
  var opts = arguments.length > 1 ? arguments[1] : {};
  var maxIter = opts.maxIterations !== undefined ? opts.maxIterations : 50;
  var tol    = opts.priceTolerance !== undefined ? opts.priceTolerance : 1e-5;

  // ----- price‑error function f(σ) = C(σ) - marketPrice -----
  function priceDiff(sigma) {
    var call = blackScholesCallPrice(S0, K, r, sigma, T);
    return call.c - marketPrice;
  }

  // ----- initial bracket -----
  var sigmaLow  = 1e-4;
  var sigmaHigh = 4.0;

  var fLow  = priceDiff(sigmaLow);
  var fHigh = priceDiff(sigmaHigh);

  if (isNaN(fLow) || isNaN(fHigh)) {
    return invalid('no_bracket');
  }

  if (fLow * fHigh > 0) {
    return invalid('no_bracket');
  }

  // ----- bisection -----
  var low = sigmaLow;
  var high = sigmaHigh;
  var fL  = fLow;
  var fH  = fHigh;

  for (var iter = 1; iter <= maxIter; iter++) {
    var sigmaMid = (low + high) / 2;
    var fMid     = priceDiff(sigmaMid);

    if (isNaN(fMid)) {
      return invalid('no_bracket');
    }

    if (Math.abs(fMid) <= tol) {
      return { sigma: sigmaMid, converged: true, iterations: iter };
    }

    if (fL * fMid <= 0) {
      high = sigmaMid;
      fH   = fMid;
    } else {
      low = sigmaMid;
      fL  = fMid;
    }
  }

  // maximum iterations reached without convergence
  return { sigma: null, converged: false, iterations: maxIter, reason: 'max_iterations' };
}
