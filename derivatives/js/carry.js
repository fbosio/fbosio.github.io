/**
 * Compute effective spot price and risk‑free rate, adjusting for
 * underlying type, continuous carry (dividend yield / foreign rate),
 * and discrete cash flows.
 *
 * @param {Object} params
 * @param {string}  params.type       – 'equity' | 'currency' | 'index' | 'futures'
 * @param {number}  params.S0         – current spot price (or futures price for futures)
 * @param {number}  params.T          – time to expiration (years)
 * @param {number}  params.r          – domestic risk‑free interest rate (continuous)
 * @param {number} [params.q=0]       – continuous dividend yield
 * @param {number} [params.rf=0]      – foreign risk‑free rate (for currency)
 * @param {Array<{amount:number, time:number}>} [params.dividends=[]] – discrete cash flows
 * @returns {Object} { S_adj: number, r_adj: number }
 */
function computeAdjustedInputs(params) {
  var type = params.type;
  var S0 = params.S0;
  var T = params.T;
  var r = params.r;
  var q = (typeof params.q !== 'undefined' && params.q !== null) ? params.q : 0;
  var rf = (typeof params.rf !== 'undefined' && params.rf !== null) ? params.rf : 0;
  var dividends = params.dividends || [];
  var adjS0;

  if (type === 'futures') {
    // Futures price already reflects cost‑of‑carry; use as‑is.
    adjS0 = S0;
  } else if (dividends.length > 0) {
    // Subtract present value of discrete cash flows before expiry.
    var pv = 0;
    for (var i = 0; i < dividends.length; i++) {
      var div = dividends[i];
      // Reject clearly invalid dividend parameters.
      if (div.time < 0 || div.amount < 0) {
        // Invalid input → make the solver fail cleanly by returning NaN.
        return { S_adj: NaN, r_adj: r };
      }
      if (div.time < T) {
        pv += div.amount * Math.exp(-r * div.time);
      }
    }
    adjS0 = S0 - pv;
  } else if (type === 'currency') {
    // Use rf if available, otherwise fall back to continuous yield q.
    var carry = (typeof params.rf !== 'undefined' && params.rf !== null) ? params.rf : q;
    adjS0 = S0 * Math.exp(-carry * T);
  } else if ((type === 'equity' || type === 'index') && q !== 0) {
    // Continuous dividend yield adjustment.
    adjS0 = S0 * Math.exp(-q * T);
  } else {
    // No adjustment needed.
    adjS0 = S0;
  }

  // A zero or negative effective spot means the call is worthless / no‑arbitrage violation.
  if (adjS0 < 0) {
    return { S_adj: NaN, r_adj: r };
  }

  return { S_adj: adjS0, r_adj: r };
}

// Node export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeAdjustedInputs: computeAdjustedInputs };
}

// Attach to global scope so that the solver (and other scripts) can find it
if (typeof window !== 'undefined') {
  window.computeAdjustedInputs = computeAdjustedInputs;
}
if (typeof global !== 'undefined') {
  global.computeAdjustedInputs = computeAdjustedInputs;
}
