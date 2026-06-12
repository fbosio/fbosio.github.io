/**
 * Black-Scholes-Merton European call – variable solver.
 * Requires calculator.js (provides blackScholesCallPrice and validateInputs).
 * Provides solveForVariable and impliedVolatilityCall.
 */

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

// Export to global scope
if (typeof window !== 'undefined') {
  window.solveForVariable = solveForVariable;
  window.impliedVolatilityCall = impliedVolatilityCall;
}
