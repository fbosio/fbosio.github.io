/**
 * UI logic for the Black-Scholes calculator.
 * This module reads inputs, validates them, calls the pure math functions
 * from blackscholes.js and solver.js, and writes results into the DOM.
 * The math engine never touches the DOM.
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ----- Input field references -----
  var inputs = {
    S0: document.getElementById('input-spot'),
    K: document.getElementById('input-strike'),
    r: document.getElementById('input-rate'),
    sigma: document.getElementById('input-volatility'),
    T: document.getElementById('input-time'),
    marketprice: document.getElementById('input-marketprice')
  };

  // ----- New carry‑related elements -----
  var typeSelect = document.getElementById('input-type');
  var rfInput = document.getElementById('input-rf');
  var qInput = document.getElementById('input-q');
  var rfGroup = document.getElementById('rf-group');
  var qGroup = document.getElementById('q-group');
  var spotLabel = document.querySelector('label[for="input-spot"]');

  // ----- Dividends -----
  var dividendsGroup = document.getElementById('dividends-group');
  var dividendsTable = document.getElementById('dividends-table');
  if (dividendsTable) {
    // ----- phantom‑row auto‑expand (delegated input event) -----
    dividendsTable.addEventListener('input', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;
      var row = target.closest('tr');
      // Promote phantom row if needed
      if (row && row.classList.contains('phantom-row')) {
        row.classList.remove('phantom-row');
        var btn = row.querySelector('.remove-row-btn');
        if (btn) btn.style.display = '';
        var tbody = dividendsTable.querySelector('tbody');
        if (tbody) {
          var newPhantom = createDividendRow(true);
          if (newPhantom) tbody.appendChild(newPhantom);
        }
      }
      // Recalculate whenever a dividend input changes
      computeSolve();
    });

    // ----- remove‑row button (delegated click) -----
    dividendsTable.addEventListener('click', function (e) {
      var btn = e.target.closest('.remove-row-btn');
      if (!btn) return;
      var row = btn.closest('tr');
      if (!row) return;
      var tbody = dividendsTable.querySelector('tbody');
      row.remove();
      // After removal, ensure at least one phantom row exists so the user can still add new rows.
      if (tbody && !tbody.querySelector('.phantom-row')) {
        var phantom = createDividendRow(true);
        if (phantom) tbody.appendChild(phantom);
      }
      computeSolve();
    });
  }

  // ----- Error message elements -----
  var errors = {
    S0: document.getElementById('error-spot'),
    K: document.getElementById('error-strike'),
    r: document.getElementById('error-rate'),
    sigma: document.getElementById('error-volatility'),
    T: document.getElementById('error-time'),
    marketprice: document.getElementById('error-marketprice'),
    // Carry fields
    rf: document.getElementById('error-rf'),
    q: document.getElementById('error-q')
  };

  // ----- Group wrappers -----
  var sigmaGroup = document.getElementById('sigma-group');
  var marketpriceGroup = document.getElementById('marketprice-group');

  // ----- Build the solve‑view UI (the only view) -----

  // ---- Output card ----
  var solveOutputCard = document.createElement('div');
  solveOutputCard.id = 'card-solve-output';
  solveOutputCard.className = 'card card-output';   // reuses the responsive grid rules
  solveOutputCard.innerHTML = '<h2 id="solve-title"></h2>' +
    '<div class="price-display"><span id="solve-result" class="price-value">\u2014</span></div>';

  // insert at the very top of the main container
  var mainContainer = document.querySelector('.calculator-container');
  if (mainContainer) {
    mainContainer.insertBefore(solveOutputCard, mainContainer.firstChild);
  } else {
    document.body.appendChild(solveOutputCard);
  }

  // ---- Radio group (unknown selector) ----
  var solveSelector = document.createElement('div');
  solveSelector.id = 'solve-selector';
  solveSelector.style.display = 'flex';
  solveSelector.style.flexDirection = 'column';
  solveSelector.style.gap = '0.35em';
  solveSelector.style.marginTop = '1em';

  // order: S0, K, r, T, sigma, callPrice – Volatility after Time to maturity
  var targets = [
    { value: 'S0',    label: 'Spot (S\u2080)' },
    { value: 'K',     label: 'Strike (K)' },
    { value: 'r',     label: 'Risk\u2011free rate (r)' },
    { value: 'T',     label: 'Time to maturity (T)' },
    { value: 'sigma', label: 'Volatility (\u03C3)' },
    { value: 'callPrice', label: 'Call Price (C)' }
  ];

  var solveTarget = 'callPrice';   // default unknown
  var lastCallPrice = null;        // most recent call price computed
  var lastSigma = null;           // most recent volatility computed

  var supportedTargets = ['callPrice', 'sigma', 'T', 'r', 'K', 'S0'];

  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var lbl = document.createElement('label');
    lbl.className = 'radio-label';
    var rad = document.createElement('input');
    rad.type = 'radio';
    rad.name = 'solveUnknown';
    rad.value = t.value;
    rad.id = 'solve-' + t.value;
    rad.disabled = (supportedTargets.indexOf(t.value) === -1);
    if (t.value === solveTarget) rad.checked = true;
    lbl.appendChild(rad);
    lbl.appendChild(document.createTextNode(' ' + t.label));
    solveSelector.appendChild(lbl);
  }

  // put the selector inside the output card, below the result number
  solveOutputCard.appendChild(solveSelector);

  // ----- Radio‑change handler (also triggers solve) -----
  var solveRadios = solveSelector.querySelectorAll('input[type="radio"]');
  for (var j = 0; j < solveRadios.length; j++) {
    solveRadios[j].addEventListener('change', function (e) {
      solveTarget = e.target.value;
      // When switching to a variable that is not callPrice, pre‑fill
      // the market‑price input with the last known callPrice.
      if (solveTarget !== 'callPrice' && lastCallPrice !== null && !isNaN(lastCallPrice)) {
        inputs.marketprice.value = lastCallPrice.toFixed(6);
      }
      // When switching to callPrice, pre‑fill the volatility input with the
      // most recently computed implied volatility (if any).
      if (solveTarget === 'callPrice' && lastSigma !== null && !isNaN(lastSigma)) {
        inputs.sigma.value = lastSigma.toFixed(6);
      }
      updateSolveUIVisibility();
      computeSolve();
    });
  }

  // ----- Helper functions -----

  function clearErrors() {
    for (var key in errors) {
      if (errors.hasOwnProperty(key) && errors[key]) {
        errors[key].textContent = '';
      }
    }
  }

  function showError(key, msg) {
    if (errors.hasOwnProperty(key) && errors[key]) {
      errors[key].textContent = msg;
    }
  }

  /** Toggle input state so the field being solved is greyed out. */
  function updateSolveUIVisibility() {
    // enable all inputs first
    for (var k in inputs) {
      if (inputs[k]) {
        inputs[k].disabled = false;
        if (inputs[k].parentNode) inputs[k].parentNode.style.opacity = '1';
      }
    }

    // market‑price group is always visible – never hidden
    marketpriceGroup.style.display = '';
    sigmaGroup.style.display = '';

    // disable the input that corresponds to the unknown
    var unknownInput;
    if (solveTarget === 'callPrice') {
      unknownInput = inputs.marketprice;
    } else {
      unknownInput = inputs[solveTarget];
    }
    if (unknownInput) {
      unknownInput.disabled = true;
      if (unknownInput.parentNode) unknownInput.parentNode.style.opacity = '0.5';
    }
  }

  // ---- New function: collect discrete dividends ----
  function collectDividends() {
    var rows = dividendsTable.querySelectorAll('tbody tr');
    var dividends = [];
    for (var i = 0; i < rows.length; i++) {
      var timeInput = rows[i].querySelector('.div-time');
      var amountInput = rows[i].querySelector('.div-amount');
      if (!timeInput || !amountInput) continue;
      var time = parseFloat(timeInput.value);
      var amount = parseFloat(amountInput.value);
      if (isNaN(time) || isNaN(amount)) continue;
      if (time <= 0 || amount <= 0) continue;
      dividends.push({ time: time, amount: amount });
    }
    return dividends;
  }

  /** Build a single dividend row. If phantom is true, the row gets
   *  the 'phantom-row' class and its remove button is hidden via inline style. */
  function createDividendRow(phantom) {
    var tr = document.createElement('tr');
    if (phantom) tr.classList.add('phantom-row');

    // time cell
    var tdTime = document.createElement('td');
    var inpTime = document.createElement('input');
    inpTime.type = 'number';
    inpTime.step = '0.01';
    inpTime.min = '0';
    inpTime.className = 'div-time';
    inpTime.placeholder = phantom ? 'Start typing…' : 'e.g. 0.5';
    tdTime.appendChild(inpTime);

    // amount cell
    var tdAmt = document.createElement('td');
    var inpAmt = document.createElement('input');
    inpAmt.type = 'number';
    inpAmt.step = '0.01';
    inpAmt.min = '0';
    inpAmt.className = 'div-amount';
    inpAmt.placeholder = phantom ? 'Start typing…' : 'e.g. 2';
    tdAmt.appendChild(inpAmt);

    // remove button cell
    var tdBtn = document.createElement('td');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remove-row-btn';
    btn.textContent = '✕';
    btn.title = 'Remove row';
    if (phantom) btn.style.display = 'none';   // hidden for phantom rows
    tdBtn.appendChild(btn);

    tr.appendChild(tdTime);
    tr.appendChild(tdAmt);
    tr.appendChild(tdBtn);
    return tr;
  }

  /** Reset the dividends table to one empty real row + one phantom row. */
  function setupDividendsTable() {
    var tbody = dividendsTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // one empty real row
    tbody.appendChild(createDividendRow(false));
    // one phantom row at the bottom
    tbody.appendChild(createDividendRow(true));
  }

  /** Show/hide the carry fields according to the underlying type. */
  function updateUnderlyingUI() {
    var type = typeSelect.value;
    rfGroup.style.display = (type === 'currency') ? '' : 'none';
    qGroup.style.display  = (type === 'index')    ? '' : 'none';

    // Rename spot label for futures
    spotLabel.innerHTML = (type === 'futures')
      ? 'Futures price (<i>F</i><sub>0</sub>)'
      : 'Spot price (<i>S</i><sub>0</sub>)';

    // dividends group visibility & reset
    if (type === 'equity') {
      dividendsGroup.style.display = '';
      setupDividendsTable();
    } else {
      dividendsGroup.style.display = 'none';
      // clear any stale rows when not equity
      var tbody = dividendsTable.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }

    // update displayed formulas
    updateFormulaDisplay(type);
  }

  /** Core solve logic – invoked on input changes and radio changes. */
  function computeSolve() {
    clearErrors();

    // ----- set the card title to the current variable name -----
    var nameMap = {
      S0: 'Spot (S\u2080)',
      K: 'Strike (K)',
      r: 'Risk\u2011free rate (r)',
      sigma: 'Volatility (\u03C3)',
      T: 'Time to maturity (T)',
      callPrice: 'Call Price (C)'
    };
    var solvedName = nameMap[solveTarget] || solveTarget;
    var titleEl = document.getElementById('solve-title');
    if (titleEl) titleEl.textContent = solvedName;

    // raw values
    var S0 = parseFloat(inputs.S0.value);
    var K = parseFloat(inputs.K.value);
    var r = parseFloat(inputs.r.value);
    var sigma = parseFloat(inputs.sigma.value);
    var T = parseFloat(inputs.T.value);
    var price = parseFloat(inputs.marketprice.value);

    // ----- Collect carry parameters -----
    var underlyingType = typeSelect.value;

    var carryQ = null;
    var carryRf = null;
    if (underlyingType === 'index') {
      carryQ = parseFloat(qInput.value);
    } else if (underlyingType === 'currency') {
      carryRf = parseFloat(rfInput.value);
    }

    var carryParams = {
      type: underlyingType,
      dividends: collectDividends()
    };
    if (carryQ !== null && !isNaN(carryQ)) carryParams.q = carryQ;
    if (carryRf !== null && !isNaN(carryRf)) carryParams.rf = carryRf;

    // ----- manual pre‑validation -----
    var invalid = false;

    if (solveTarget !== 'S0' && (isNaN(S0) || S0 <= 0)) {
      showError('S0', 'Spot must be > 0.');
      invalid = true;
    }
    if (solveTarget !== 'K' && (isNaN(K) || K <= 0)) {
      showError('K', 'Strike must be > 0.');
      invalid = true;
    }
    if (solveTarget !== 'r' && isNaN(r)) {
      showError('r', 'Rate must be a number.');
      invalid = true;
    }
    if (solveTarget !== 'sigma' && (isNaN(sigma) || sigma <= 0)) {
      showError('sigma', 'Volatility must be > 0.');
      invalid = true;
    }
    if (solveTarget !== 'T' && (isNaN(T) || T <= 0)) {
      showError('T', 'Time must be > 0.');
      invalid = true;
    }
    if (solveTarget !== 'callPrice') {
      if (isNaN(price) || !isFinite(price) || price < 0) {
        showError('marketprice', 'Market call price must be \u2265 0.');
        invalid = true;
      }
    }

    // ----- Validate carry fields -----
    if (underlyingType === 'currency' && (isNaN(carryRf) || carryRf < 0)) {
      showError('rf', 'Foreign rate must be \u2265 0.');
      invalid = true;
    }
    if (underlyingType === 'index' && (isNaN(carryQ) || carryQ < 0)) {
      showError('q', 'Dividend yield must be \u2265 0.');
      invalid = true;
    }

    var msgEl = document.getElementById('solve-result');
    if (invalid) {
      msgEl.textContent = '\u2014';
      return;
    }

    var result;
    var callObj = null;      // will hold the full price object from black‑scholes

    try {
      if (solveTarget === 'callPrice') {
        if (typeof blackScholesCallPrice !== 'function') {
          result = { converged: false, reason: 'Pricing function unavailable.' };
        } else {
          var adjusted = computeAdjustedInputs({
            type: underlyingType,
            S0: S0, T: T, r: r,
            q: carryQ,
            rf: carryRf,
            dividends: collectDividends()
          });
          callObj = blackScholesCallPrice(adjusted.S_adj, K, adjusted.r_adj, sigma, T);
          if (!callObj || isNaN(callObj.c)) {
            result = { converged: false, reason: 'Invalid inputs for option pricing.' };
          } else {
            result = { converged: true, value: callObj.c, c: callObj.c };
          }
        }
      } else if (solveTarget === 'sigma') {
        if (typeof solveForVariable !== 'function') {
          result = { converged: false, reason: 'Solver function unavailable.' };
        } else {
          var st = solveForVariable({
            variable: 'sigma',
            S0: S0, K: K, r: r, sigma: undefined, T: T,
            marketPrice: price,
            tolerance: 1e-7,
            maxIter: 1000,
            carry: carryParams
          });
          if (!st || !st.converged) {
            result = { converged: false, reason: st && st.reason ? st.reason : 'Solving for sigma did not converge.' };
          } else {
            // Use adjusted inputs to compute the call price for display
            var adjusted = computeAdjustedInputs({
              type: underlyingType, S0: S0, T: T, r: r,
              q: carryQ, rf: carryRf,
              dividends: collectDividends()
            });
            callObj = blackScholesCallPrice(adjusted.S_adj, K, adjusted.r_adj, st.value, T);
            result = { converged: true, value: st.value, c: callObj ? callObj.c : NaN };
            if (isNaN(result.c)) {
              result.converged = false;
              result.reason = 'Could not compute call price with solved sigma.';
            }
          }
        }
      } else if (solveTarget === 'T') {
        if (typeof solveForVariable !== 'function') {
          result = { converged: false, reason: 'Solver function unavailable.' };
        } else {
          var st = solveForVariable({
            variable: 'T',
            S0: S0, K: K, r: r, sigma: sigma,
            marketPrice: price,
            tolerance: 1e-7,
            maxIter: 1000,
            carry: carryParams
          });
          if (!st || !st.converged) {
            result = { converged: false, reason: st && st.reason ? st.reason : 'Solving for T did not converge.' };
          } else {
            var adjusted = computeAdjustedInputs({
              type: underlyingType, S0: S0, T: st.value, r: r,
              q: carryQ, rf: carryRf,
              dividends: collectDividends()
            });
            callObj = blackScholesCallPrice(adjusted.S_adj, K, adjusted.r_adj, sigma, st.value);
            result = { converged: true, value: st.value, c: callObj ? callObj.c : NaN };
            if (isNaN(result.c)) {
              result.converged = false;
              result.reason = 'Could not compute call price with solved T.';
            }
          }
        }
      } else if (solveTarget === 'S0') {
        if (typeof solveForVariable !== 'function') {
          result = { converged: false, reason: 'Solver function unavailable.' };
        } else {
          var st = solveForVariable({
            variable: 'S0',
            K: K, r: r, sigma: sigma, T: T,
            marketPrice: price,
            tolerance: 1e-7,
            maxIter: 1000,
            carry: carryParams
          });
          if (!st || !st.converged) {
            result = { converged: false, reason: st && st.reason ? st.reason : 'Solving for S0 did not converge.' };
          } else {
            var adjusted = computeAdjustedInputs({
              type: underlyingType, S0: st.value, T: T, r: r,
              q: carryQ, rf: carryRf,
              dividends: collectDividends()
            });
            callObj = blackScholesCallPrice(adjusted.S_adj, K, adjusted.r_adj, sigma, T);
            result = { converged: true, value: st.value, c: callObj ? callObj.c : NaN };
            if (isNaN(result.c)) {
              result.converged = false;
              result.reason = 'Could not compute call price with solved S0.';
            }
          }
        }
      } else if (solveTarget === 'K') {
        if (typeof solveForVariable !== 'function') {
          result = { converged: false, reason: 'Solver function unavailable.' };
        } else {
          var st = solveForVariable({
            variable: 'K',
            S0: S0, r: r, sigma: sigma, T: T,
            marketPrice: price,
            tolerance: 1e-7,
            maxIter: 1000,
            carry: carryParams
          });
          if (!st || !st.converged) {
            result = { converged: false, reason: st && st.reason ? st.reason : 'Solving for K did not converge.' };
          } else {
            var adjusted = computeAdjustedInputs({
              type: underlyingType, S0: S0, T: T, r: r,
              q: carryQ, rf: carryRf,
              dividends: collectDividends()
            });
            callObj = blackScholesCallPrice(adjusted.S_adj, st.value, adjusted.r_adj, sigma, T);
            result = { converged: true, value: st.value, c: callObj ? callObj.c : NaN };
            if (isNaN(result.c)) {
              result.converged = false;
              result.reason = 'Could not compute call price with solved K.';
            }
          }
        }
      } else if (solveTarget === 'r') {
        if (typeof solveForVariable !== 'function') {
          result = { converged: false, reason: 'Solver function unavailable.' };
        } else {
          var st = solveForVariable({
            variable: 'r',
            S0: S0, K: K, sigma: sigma, T: T,
            marketPrice: price,
            tolerance: 1e-7,
            maxIter: 1000,
            carry: carryParams
          });
          if (!st || !st.converged) {
            result = { converged: false, reason: st && st.reason ? st.reason : 'Solving for r did not converge.' };
          } else {
            var adjusted = computeAdjustedInputs({
              type: underlyingType, S0: S0, T: T, r: st.value,
              q: carryQ, rf: carryRf,
              dividends: collectDividends()
            });
            callObj = blackScholesCallPrice(adjusted.S_adj, K, adjusted.r_adj, sigma, T);
            result = { converged: true, value: st.value, c: callObj ? callObj.c : NaN };
            if (isNaN(result.c)) {
              result.converged = false;
              result.reason = 'Could not compute call price with solved r.';
            }
          }
        }
      } else {
        result = { converged: false, reason: 'Solving for ' + solveTarget + ' is not implemented.' };
      }
    } catch (e) {
      result = { converged: false, reason: e.message };
    }

    // ----- show only em‑dash for errors (error details are only for debugging) -----
    if (!result.converged) {
      msgEl.textContent = '\u2014';
      return;
    }

    // store the latest call price
    if (typeof result.c === 'number' && !isNaN(result.c)) {
      lastCallPrice = result.c;
    }
    // store the latest sigma (if we solved for it)
    if (solveTarget === 'sigma' && typeof result.value === 'number' && !isNaN(result.value)) {
      lastSigma = result.value;
    }

    // ---- immediately fill the corresponding input so switching works perfectly ----
    if (solveTarget === 'callPrice' && typeof result.value === 'number' && !isNaN(result.value)) {
      inputs.marketprice.value = result.value.toFixed(6);
    }
    if (solveTarget === 'sigma' && typeof result.value === 'number' && !isNaN(result.value)) {
      inputs.sigma.value = result.value.toFixed(6);
    }
    if (solveTarget === 'T' && typeof result.value === 'number' && !isNaN(result.value)) {
      inputs.T.value = result.value.toFixed(6);
    }
    if (solveTarget === 'S0' && typeof result.value === 'number' && !isNaN(result.value)) {
      inputs.S0.value = result.value.toFixed(6);
    }
    if (solveTarget === 'K' && typeof result.value === 'number' && !isNaN(result.value)) {
      inputs.K.value = result.value.toFixed(6);
    }
    if (solveTarget === 'r' && typeof result.value === 'number' && !isNaN(result.value)) {
      inputs.r.value = result.value.toFixed(6);
    }

    // display the solved value (the card title already shows the variable name)
    msgEl.textContent = result.value.toFixed(6);

    // ----- update intermediate values in the mathematical details card -----
    var d1El = document.getElementById('output-d1');
    var d2El = document.getElementById('output-d2');
    var nd1El = document.getElementById('output-nd1');
    var nd2El = document.getElementById('output-nd2');

    function setDash(el) { if (el) el.textContent = '\u2014'; }
    function safeNum(v, el) {
      if (el) el.textContent = (typeof v === 'number' && !isNaN(v)) ? v.toFixed(6) : '\u2014';
    }

    if (callObj && typeof callObj.d1 !== 'undefined') {
      safeNum(callObj.d1, d1El);
      safeNum(callObj.d2, d2El);
      safeNum(callObj.Nd1, nd1El);
      safeNum(callObj.Nd2, nd2El);
    } else {
      setDash(d1El);
      setDash(d2El);
      setDash(nd1El);
      setDash(nd2El);
    }

    // ----- compute and display present value of known dividends I -----
    var iEl = document.getElementById('output-i');
    if (iEl) {
      var I_val = null;
      if (underlyingType === 'equity') {
        var divs = collectDividends();
        var rUsed = parseFloat(inputs.r.value);
        var TUsed = parseFloat(inputs.T.value);
        if (!isNaN(rUsed) && !isNaN(TUsed) && TUsed > 0 && rUsed >= 0) {
          var I = 0;
          for (var di = 0; di < divs.length; di++) {
            var t_i = divs[di].time;
            var a_i = divs[di].amount;
            if (t_i > 0 && a_i > 0) {
              I += a_i * Math.exp(-rUsed * t_i);
            }
          }
          if (I > 0 && isFinite(I)) {
            I_val = I;
          }
        }
      }
      iEl.textContent = (I_val !== null && isFinite(I_val)) ? I_val.toFixed(6) : '\u2014';
    }

    // keep formula display in sync with dividends / underlying type
    updateFormulaDisplay(typeSelect.value);
  }

  // ----- Attach input listeners (live recalculation) -----
  for (var key in inputs) {
    if (inputs.hasOwnProperty(key) && inputs[key]) {
      inputs[key].addEventListener('input', function () {
        computeSolve();
      });
    }
  }

  // rf and q listeners
  if (rfInput) rfInput.addEventListener('input', computeSolve);
  if (qInput)  qInput.addEventListener('input', computeSolve);

  // ----- Attach underlying‑type change handler -----
  typeSelect.addEventListener('change', function () {
    updateUnderlyingUI();
    computeSolve();
  });

  // ----- Update displayed formulas according to underlying type -----
  function updateFormulaDisplay(type) {
    var d1Span = document.getElementById('d1-formula');
    var d2Span = document.getElementById('d2-formula');
    var callSpan = document.getElementById('call-formula');
    if (!d1Span || !d2Span || !callSpan) return;

    var d2Text = '<i>d</i><sub>2</sub> = <i>d</i><sub>1</sub> - <i>&sigma;</i>&radic;<i>T</i>';
    var d1Text, callText;

    // ----- Build formulas -----
    if (type === 'equity') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln((<i>S</i><sub>0</sub> - <i>I</i>)/<i>K</i>) + (<i>r</i> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      callText = '<i>c</i> = (<i>S</i><sub>0</sub> - <i>I</i>) N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
    } else if (type === 'currency') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>S</i><sub>0</sub>/<i>K</i>) + (<i>r</i> - <i>r</i><sub><i>f</i></sub> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      callText = '<i>c</i> = <i>S</i><sub>0</sub> <i>e</i><sup>-<i>r</i><sub><i>f</i></sub><i>T</i></sup> N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
    } else if (type === 'index') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>S</i><sub>0</sub>/<i>K</i>) + (<i>r</i> - <i>q</i> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      callText = '<i>c</i> = <i>S</i><sub>0</sub> <i>e</i><sup>-<i>q</i><i>T</i></sup> N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
    } else if (type === 'futures') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>F</i><sub>0</sub>/<i>K</i>) + (<i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      callText = '<i>c</i> = <i>e</i><sup>-<i>r</i><i>T</i></sup> [ <i>F</i><sub>0</sub> N(<i>d</i><sub>1</sub>) - <i>K</i> N(<i>d</i><sub>2</sub>) ]';
    } else {
      // fallback to equity
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>S</i><sub>0</sub>/<i>K</i>) + (<i>r</i> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      callText = '<i>c</i> = <i>S</i><sub>0</sub> N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
    }

    d1Span.innerHTML = d1Text;
    d2Span.innerHTML = d2Text;
    callSpan.innerHTML = callText;
  }

  // ----- Set sensible default values (demo) -----
  inputs.S0.value = '100';
  inputs.K.value = '100';
  inputs.r.value = '0.05';
  inputs.sigma.value = '0.2';
  inputs.T.value = '1';

  // Compute a default market price consistent with the default volatility.
  if (typeof blackScholesCallPrice === 'function') {
    var defaultCall = blackScholesCallPrice(100, 100, 0.05, 0.2, 1);
    if (defaultCall && !isNaN(defaultCall.c)) {
      inputs.marketprice.value = defaultCall.c.toFixed(6);
      lastCallPrice = defaultCall.c;
    } else {
      inputs.marketprice.value = '10.450583'; // fallback
      lastCallPrice = 10.450583;
    }
  }

  // ----- Initial activation -----
  updateUnderlyingUI();
  collectDividends(); // ensures the default empty array is ready
  updateSolveUIVisibility();
  computeSolve();
});
