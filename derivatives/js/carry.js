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
  var S_adj;

  if (type === 'futures') {
    // Futures price already reflects cost‑of‑carry; use as‑is.
    S_adj = S0;
  } else if (dividends.length > 0) {
    // Subtract present value of discrete cash flows before expiry.
    var pv = 0;
    for (var i = 0; i < dividends.length; i++) {
      if (dividends[i].time < T) {
        pv += dividends[i].amount * Math.exp(-r * dividends[i].time);
      }
    }
    S_adj = S0 - pv;
  } else if (type === 'currency' && rf !== 0) {
    // Continuous foreign rate adjustment.
    S_adj = S0 * Math.exp(-rf * T);
  } else if ((type === 'equity' || type === 'index') && q !== 0) {
    // Continuous dividend yield adjustment.
    S_adj = S0 * Math.exp(-q * T);
  } else {
    // No adjustment needed.
    S_adj = S0;
  }

  return { S_adj: S_adj, r_adj: r };
}

// Node export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeAdjustedInputs: computeAdjustedInputs };
}
