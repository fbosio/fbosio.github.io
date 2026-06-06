/**
 * Black‑Scholes‑Merton European call pricing and generic single‑variable solver.
 *
 * This file provides:
 *   - Standard Black‑Scholes call price (blackScholesCallPrice).
 *   - A generic bisection solver for any variable (S0,K,r,σ,T,C).
 *   - Legacy wrapper impliedVolatilityCall for backwards compatibility.
 */

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

/* ----------------------------------------------------------------- */
/*  Generic single‑variable bisection solver                         */
/* ----------------------------------------------------------------- */

/**
 * Solve for the given variable so that the Black‑Scholes call price
 * equals `marketPrice`.  Bisection is used, which requires a continuous,
 * monotonic relation between the variable and the call price.
 *
 * @param {Object} input
 * @param {string} input.variable   - One of 'S0','K','r','sigma','T','callPrice'.
 * @param {number} input.S0         - Spot price (ignored if solving for S0).
 * @param {number} input.K          - Strike price (ignored if solving for K).
 * @param {number} input.r          - Risk‑free rate (ignored if solving for r).
 * @param {number} input.sigma      - Volatility (ignored if solving for σ).
 * @param {number} input.T          - Time to maturity (ignored if solving for T).
 * @param {number} input.marketPrice - Observed call price.
 * @param {number} [input.maxIter=100] - Maximum bisection iterations.
 * @param {number} [input.tolerance=1e-6] - Convergence tolerance on price error.
 *
 * @returns {object} result with { converged, value?, sigma?, c?, reason?, iterations? }
 */
function solveForVariable(input) {
  var variable = input.variable;
  var S0 = input.S0;
  var K = input.K;
  var r = input.r;
  var sigma = input.sigma;
  var T = input.T;
  var marketPrice = input.marketPrice;
  var maxIter = input.maxIter || 100;
  var tol = input.tolerance || 1e-6;

  // ----- helpers -----
  function invalid(reason) {
    return { converged: false, reason: reason };
  }

  // ----- Fast path : the variable we are solving for is the call price itself -----
  if (variable === 'callPrice') {
    var callObj = blackScholesCallPrice(S0, K, r, sigma, T);
    if (isNaN(callObj.c)) return invalid('Cannot compute call price.');
    return { converged: true, value: callObj.c, c: callObj.c, iterations: 0 };
  }

  // ----- Validate the fields that are NOT being solved -----
  var dummy = {
    S0:    (variable === 'S0')    ? 1.0  : S0,
    K:     (variable === 'K')     ? 1.0  : K,
    r:     (variable === 'r')     ? 0.05 : r,
    sigma: (variable === 'sigma') ? 0.2  : sigma,
    T:     (variable === 'T')     ? 1.0  : T
  };
  var validation = validateInputs(dummy);
  if (validation !== null) {
    return invalid(validation.join('; '));
  }
  if (typeof marketPrice !== 'number' || isNaN(marketPrice) || !isFinite(marketPrice) || marketPrice < 0) {
    return invalid('Market price must be ≥ 0.');
  }

  // ----- price‑error function f(guess) = C(guess) - marketPrice -----
  function priceError(guess) {
    var call;
    if (variable === 'S0') {
      call = blackScholesCallPrice(guess, K, r, sigma, T);
    } else if (variable === 'K') {
      call = blackScholesCallPrice(S0, guess, r, sigma, T);
    } else if (variable === 'r') {
      call = blackScholesCallPrice(S0, K, guess, sigma, T);
    } else if (variable === 'sigma') {
      call = blackScholesCallPrice(S0, K, r, guess, T);
    } else if (variable === 'T') {
      call = blackScholesCallPrice(S0, K, r, sigma, guess);
    } else {
      return NaN;
    }
    return call.c - marketPrice;
  }

  // ----- choose initial bracket -----
  var low, high;
  if (variable === 'S0')          { low = 0.0001; high = Math.max(100000, 10 * K); }
  else if (variable === 'K')     { low = 0.0001; high = Math.max(100000, 10 * S0); }
  else if (variable === 'r')     { low = -1.0;   high = 5.0; }
  else if (variable === 'T')     { low = 0.0001; high = 10.0; }
  else if (variable === 'sigma') { low = 1e-4;   high = 4.0; }
  else { return invalid('unknown variable'); }

  // ----- expand bracket until f(low) and f(high) have opposite signs -----
  function f(x) { return priceError(x); }
  var fl = f(low);
  var fh = f(high);
  if (isNaN(fl) || isNaN(fh)) return invalid('Evaluation error at bracket edges.');

  for (var expand = 0; expand < 30; expand++) {
    if (fl * fh <= 0) break;
    if (Math.abs(fl) < Math.abs(fh)) {
      low = low / 2.0;
      fl = f(low);
    } else {
      high = high * 2.0;
      fh = f(high);
    }
    if (isNaN(fl) || isNaN(fh)) return invalid('Evaluation error while expanding bracket.');
  }
  if (fl * fh > 0) return invalid('no_bracket');

  // ----- bisection -----
  var l = low, h = high;
  var fl2 = fl, fh2 = fh;
  for (var iter = 1; iter <= maxIter; iter++) {
    var mid = (l + h) / 2.0;
    var fm = f(mid);
    if (isNaN(fm)) return invalid('NaN during bisection.');
    if (Math.abs(fm) <= tol) {
      // also compute the call price that corresponds to the solved value
      var callVal;
      if (variable === 'S0')    callVal = blackScholesCallPrice(mid, K, r, sigma, T);
      else if (variable === 'K') callVal = blackScholesCallPrice(S0, mid, r, sigma, T);
      else if (variable === 'r') callVal = blackScholesCallPrice(S0, K, mid, sigma, T);
      else if (variable === 'sigma') callVal = blackScholesCallPrice(S0, K, r, mid, T);
      else if (variable === 'T') callVal = blackScholesCallPrice(S0, K, r, sigma, mid);
      return {
        converged: true,
        value: mid,
        sigma: (variable === 'sigma' ? mid : undefined),   // backwards‑compat for old IV caller
        c: callVal ? callVal.c : NaN,
        iterations: iter
      };
    }
    if (fl2 * fm <= 0.0) {
      h = mid;
      fh2 = fm;
    } else {
      l = mid;
      fl2 = fm;
    }
  }

  return { converged: false, reason: 'max_iterations', iterations: maxIter };
}

/* ----------------------------------------------------------------- */
/*  Legacy implied‑volatility wrapper (unchanged signature)          */
/* ----------------------------------------------------------------- */

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
function impliedVolatilityCall(params, options) {
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
  var eps = 1e-8;
  if (marketPrice < lowerBound - eps || marketPrice > upperBound + eps) {
    return invalid('no_arbitrage_violation');
  }

  // If the market price equals (or is extremely close to) the upper bound,
  // no finite volatility can reproduce it → no bracket.
  if (marketPrice >= upperBound - 1e-12) {
    return invalid('no_bracket');
  }

  // ----- optional parameters -----
  var opts = arguments.length > 1 ? arguments[1] : {};
  var maxIter = opts.maxIterations !== undefined ? opts.maxIterations : 50;
  var tol    = opts.priceTolerance !== undefined ? opts.priceTolerance : 1e-5;

  // delegate to the generic solver
  var sol = solveForVariable({
    variable: 'sigma',
    S0: S0,
    K: K,
    r: r,
    sigma: undefined,          // not used, internally replaced by guess
    T: T,
    marketPrice: marketPrice,
    maxIter: maxIter,
    tolerance: tol
  });

  if (!sol.converged) {
    return invalid(sol.reason || 'unknown');
  }
  return { sigma: sol.value, converged: true, iterations: sol.iterations };
}

// Ensure the functions are accessible from other scripts (e.g. ui.js)
if (typeof window !== 'undefined') {
  window.impliedVolatilityCall = impliedVolatilityCall;
  window.solveForVariable = solveForVariable;
}
