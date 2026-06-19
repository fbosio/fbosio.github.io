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

  // ----- Carry‑related elements -----
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
    dividendsTable.addEventListener('input', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;
      var row = target.closest('tr');
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
      computeSolve();
    });

    dividendsTable.addEventListener('click', function (e) {
      var btn = e.target.closest('.remove-row-btn');
      if (!btn) return;
      var row = btn.closest('tr');
      if (!row) return;
      var tbody = dividendsTable.querySelector('tbody');
      row.remove();
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
    rf: document.getElementById('error-rf'),
    q: document.getElementById('error-q')
  };

  // ----- Group wrappers -----
  var sigmaGroup = document.getElementById('sigma-group');
  var marketpriceGroup = document.getElementById('marketprice-group');

  // ----- Build the solve‑view UI -----

  // Output card
  var solveOutputCard = document.createElement('div');
  solveOutputCard.id = 'card-solve-output';
  solveOutputCard.className = 'card card-output';
  solveOutputCard.innerHTML = '<h2 id="solve-title"></h2>' +
    '<div class="price-display"><span id="solve-result" class="price-value">\u2014</span></div>';

  var mainContainer = document.querySelector('.calculator-container');
  if (mainContainer) {
    mainContainer.insertBefore(solveOutputCard, mainContainer.firstChild);
  } else {
    document.body.appendChild(solveOutputCard);
  }

  // ---- Option type (call / put) radio group ----
  var optionTypeWrap = document.createElement('div');
  optionTypeWrap.className = 'radio-group';
  optionTypeWrap.style.marginBottom = '0.75em';

  var callLabel = document.createElement('label');
  callLabel.className = 'radio-label';
  var callRadio = document.createElement('input');
  callRadio.type = 'radio';
  callRadio.name = 'optionType';
  callRadio.value = 'call';
  callRadio.id = 'opt-call';
  callRadio.checked = true;
  callLabel.appendChild(callRadio);
  callLabel.appendChild(document.createTextNode(' Call'));
  optionTypeWrap.appendChild(callLabel);

  var putLabel = document.createElement('label');
  putLabel.className = 'radio-label';
  var putRadio = document.createElement('input');
  putRadio.type = 'radio';
  putRadio.name = 'optionType';
  putRadio.value = 'put';
  putRadio.id = 'opt-put';
  putLabel.appendChild(putRadio);
  putLabel.appendChild(document.createTextNode(' Put'));
  optionTypeWrap.appendChild(putLabel);

  solveOutputCard.appendChild(optionTypeWrap);

  // ---- Unknown selector ----
  var solveSelector = document.createElement('div');
  solveSelector.id = 'solve-selector';
  solveSelector.style.display = 'flex';
  solveSelector.style.flexDirection = 'column';
  solveSelector.style.gap = '0.35em';

  // Targets: replace 'callPrice' with 'price'
  var targets = [
    { value: 'S0',    label: 'Spot (S\u2080)' },
    { value: 'K',     label: 'Strike (K)' },
    { value: 'r',     label: 'Risk\u2011free rate (r)' },
    { value: 'T',     label: 'Time to maturity (T)' },
    { value: 'sigma', label: 'Volatility (\u03C3)' },
    { value: 'price', label: 'Option Price' }
  ];

  var solveTarget = 'price';   // default unknown
  var supportedTargets = ['price', 'sigma', 'T', 'r', 'K', 'S0'];

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

  solveOutputCard.appendChild(solveSelector);

  // ----- State variables -----
  var optionType = 'call';        // call or put
  var lastCallPrice = null;
  var lastPutPrice = null;
  var lastCallSigma = null;       // implied volatility for call
  var lastPutSigma = null;        // implied volatility for put

  // ----- Radio‑change handler for unknown variable -----
  var solveRadios = solveSelector.querySelectorAll('input[type="radio"]');
  for (var j = 0; j < solveRadios.length; j++) {
    solveRadios[j].addEventListener('change', function (e) {
      solveTarget = e.target.value;

      // When switching to a non‑price target, pre‑fill the market price
      // with the price of the currently selected option type.
      if (solveTarget !== 'price') {
        var priceToUse = (optionType === 'call') ? lastCallPrice : lastPutPrice;
        if (priceToUse !== null && !isNaN(priceToUse)) {
          inputs.marketprice.value = priceToUse.toFixed(6);
        }
      }
      // When switching to price, pre‑fill sigma with the last IV computed
      // for the current option type.
      if (solveTarget === 'price') {
        var sigmaToUse = (optionType === 'call') ? lastCallSigma : lastPutSigma;
        if (sigmaToUse !== null && !isNaN(sigmaToUse)) {
          inputs.sigma.value = sigmaToUse.toFixed(6);
        }
      }

      updateSolveUIVisibility();
      computeSolve();
    });
  }

  // ----- Option type change handler -----
  callRadio.addEventListener('change', function () {
    if (callRadio.checked) {
      optionType = 'call';
      updateMarketPriceLabel();
      // pre‑fill market price / sigma accordingly
      if (solveTarget !== 'price' && lastCallPrice !== null && !isNaN(lastCallPrice)) {
        inputs.marketprice.value = lastCallPrice.toFixed(6);
      } else if (solveTarget === 'price' && lastCallSigma !== null && !isNaN(lastCallSigma)) {
        inputs.sigma.value = lastCallSigma.toFixed(6);
      }
      computeSolve();
    }
  });
  putRadio.addEventListener('change', function () {
    if (putRadio.checked) {
      optionType = 'put';
      updateMarketPriceLabel();
      if (solveTarget !== 'price' && lastPutPrice !== null && !isNaN(lastPutPrice)) {
        inputs.marketprice.value = lastPutPrice.toFixed(6);
      } else if (solveTarget === 'price' && lastPutSigma !== null && !isNaN(lastPutSigma)) {
        inputs.sigma.value = lastPutSigma.toFixed(6);
      }
      computeSolve();
    }
  });

  // ----- Helper functions -----

  function updateMarketPriceLabel() {
    var lbl = document.getElementById('marketprice-label');
    if (lbl) {
      lbl.innerHTML = optionType === 'call'
        ? 'Market call price (<i>C</i>)'
        : 'Market put price (<i>P</i>)';
    }
  }

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

  function updateSolveUIVisibility() {
    for (var k in inputs) {
      if (inputs[k]) {
        inputs[k].disabled = false;
        if (inputs[k].parentNode) inputs[k].parentNode.style.opacity = '1';
      }
    }

    marketpriceGroup.style.display = '';
    sigmaGroup.style.display = '';

    // disable the input that corresponds to the unknown
    var unknownInput = (solveTarget === 'price') ? inputs.marketprice : inputs[solveTarget];
    if (unknownInput) {
      unknownInput.disabled = true;
      if (unknownInput.parentNode) unknownInput.parentNode.style.opacity = '0.5';
    }
  }

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

  function createDividendRow(phantom) {
    var tr = document.createElement('tr');
    if (phantom) tr.classList.add('phantom-row');

    var tdTime = document.createElement('td');
    var inpTime = document.createElement('input');
    inpTime.type = 'number';
    inpTime.step = '0.01';
    inpTime.min = '0';
    inpTime.className = 'div-time';
    inpTime.placeholder = phantom ? 'Start typing…' : 'e.g. 0.5';
    tdTime.appendChild(inpTime);

    var tdAmt = document.createElement('td');
    var inpAmt = document.createElement('input');
    inpAmt.type = 'number';
    inpAmt.step = '0.01';
    inpAmt.min = '0';
    inpAmt.className = 'div-amount';
    inpAmt.placeholder = phantom ? 'Start typing…' : 'e.g. 2';
    tdAmt.appendChild(inpAmt);

    var tdBtn = document.createElement('td');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remove-row-btn';
    btn.textContent = '✕';
    btn.title = 'Remove row';
    if (phantom) btn.style.display = 'none';
    tdBtn.appendChild(btn);

    tr.appendChild(tdTime);
    tr.appendChild(tdAmt);
    tr.appendChild(tdBtn);
    return tr;
  }

  function setupDividendsTable() {
    var tbody = dividendsTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    tbody.appendChild(createDividendRow(false));
    tbody.appendChild(createDividendRow(true));
  }

  function updateUnderlyingUI() {
    var type = typeSelect.value;
    rfGroup.style.display = (type === 'currency') ? '' : 'none';
    qGroup.style.display  = (type === 'index')    ? '' : 'none';

    spotLabel.innerHTML = (type === 'futures')
      ? 'Futures price (<i>F</i><sub>0</sub>)'
      : 'Spot price (<i>S</i><sub>0</sub>)';

    if (type === 'equity') {
      dividendsGroup.style.display = '';
      setupDividendsTable();
    } else {
      dividendsGroup.style.display = 'none';
      var tbody = dividendsTable.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }

    updateFormulaDisplay(type, optionType);
  }

  // ----- Core solve logic -----
  function computeSolve() {
    clearErrors();

    // card title
    var nameMap = {
      S0: 'Spot (S\u2080)',
      K: 'Strike (K)',
      r: 'Risk\u2011free rate (r)',
      sigma: 'Volatility (\u03C3)',
      T: 'Time to maturity (T)',
      price: (optionType === 'call' ? 'Call Price (C)' : 'Put Price (P)')
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

    // manual pre‑validation
    var invalid = false;

    if (solveTarget !== 'S0' && (isNaN(S0) || S0 <= 0)) { showError('S0', 'Spot must be > 0.'); invalid = true; }
    if (solveTarget !== 'K'  && (isNaN(K)  || K  <= 0))  { showError('K', 'Strike must be > 0.'); invalid = true; }
    if (solveTarget !== 'r'  && isNaN(r))                 { showError('r', 'Rate must be a number.'); invalid = true; }
    if (solveTarget !== 'sigma' && (isNaN(sigma) || sigma <= 0)) { showError('sigma', 'Volatility must be > 0.'); invalid = true; }
    if (solveTarget !== 'T'  && (isNaN(T)  || T  <= 0))  { showError('T', 'Time must be > 0.'); invalid = true; }

    if (solveTarget !== 'price') {
      if (isNaN(price) || !isFinite(price) || price < 0) {
        var priceLabel = (optionType === 'call') ? 'Call' : 'Put';
        showError('marketprice', 'Market ' + priceLabel + ' price must be ≥ 0.');
        invalid = true;
      }
    }

    if (underlyingType === 'currency' && (isNaN(carryRf) || carryRf < 0)) { showError('rf', 'Foreign rate must be ≥ 0.'); invalid = true; }
    if (underlyingType === 'index'    && (isNaN(carryQ) || carryQ < 0))   { showError('q', 'Dividend yield must be ≥ 0.'); invalid = true; }

    var msgEl = document.getElementById('solve-result');
    if (invalid) {
      msgEl.textContent = '\u2014';
      return;
    }

    var result;
    var priceObjCall = null;   // will hold pricing object for current type
    var priceObjPut  = null;

    try {
      if (solveTarget === 'price') {
        // compute option price directly
        var adjusted = computeAdjustedInputs({
          type: underlyingType,
          S0: S0, T: T, r: r,
          q: carryQ,
          rf: carryRf,
          dividends: collectDividends()
        });

        if (optionType === 'put') {
          priceObjPut = blackScholesPutPrice(adjusted.S_adj, K, adjusted.r_adj, sigma, T);
          if (priceObjPut && !isNaN(priceObjPut.p)) {
            result = { converged: true, value: priceObjPut.p, c: priceObjPut.p };
          } else {
            result = { converged: false, reason: 'Could not compute put price.' };
          }
        } else {
          priceObjCall = blackScholesCallPrice(adjusted.S_adj, K, adjusted.r_adj, sigma, T);
          if (priceObjCall && !isNaN(priceObjCall.c)) {
            result = { converged: true, value: priceObjCall.c, c: priceObjCall.c };
          } else {
            result = { converged: false, reason: 'Could not compute call price.' };
          }
        }
      } else {
        // solving for a variable using solver
        if (typeof solveForVariable !== 'function') {
          result = { converged: false, reason: 'Solver function unavailable.' };
        } else {
          var st = solveForVariable({
            variable: solveTarget,
            optionType: optionType,
            S0: S0,
            K: K,
            r: r,
            sigma: sigma,
            T: T,
            marketPrice: price,
            tolerance: 1e-7,
            maxIter: 1000,
            carry: carryParams
          });
          if (!st || !st.converged) {
            result = { converged: false, reason: st && st.reason ? st.reason : 'Solving did not converge.' };
          } else {
            // use solved variable to compute both call and put prices
            var solvedValue = st.value;
            var adjS0 = S0, adjK = K, adjR = r, adjSigma = sigma, adjT = T;
            if (solveTarget === 'S0')     adjS0   = solvedValue;
            else if (solveTarget === 'K') adjK    = solvedValue;
            else if (solveTarget === 'r') adjR    = solvedValue;
            else if (solveTarget === 'sigma') adjSigma = solvedValue;
            else if (solveTarget === 'T') adjT    = solvedValue;

            var adjusted = computeAdjustedInputs({
              type: underlyingType,
              S0: adjS0, T: adjT, r: adjR,
              q: carryQ, rf: carryRf,
              dividends: collectDividends()
            });

            priceObjCall = blackScholesCallPrice(adjusted.S_adj, adjK, adjusted.r_adj, adjSigma, adjT);
            priceObjPut  = blackScholesPutPrice(adjusted.S_adj, adjK, adjusted.r_adj, adjSigma, adjT);

            var targetVal = solvedValue;
            var targetPrice = (optionType === 'put') ? (priceObjPut ? priceObjPut.p : NaN)
                                                     : (priceObjCall ? priceObjCall.c : NaN);
            result = { converged: true, value: targetVal, c: targetPrice };
            // store sigma for possible switching
            if (solveTarget === 'sigma' && !isNaN(targetVal)) {
              if (optionType === 'call') lastCallSigma = targetVal; else lastPutSigma = targetVal;
            }
          }
        }
      }
    } catch (e) {
      result = { converged: false, reason: e.message };
    }

    var activePriceObj = null;
    if (optionType === 'put' && priceObjPut && !isNaN(priceObjPut.p)) {
      activePriceObj = priceObjPut;
    } else if (optionType === 'call' && priceObjCall && !isNaN(priceObjCall.c)) {
      activePriceObj = priceObjCall;
    }

    // update stored prices
    if (priceObjCall && !isNaN(priceObjCall.c)) lastCallPrice = priceObjCall.c;
    if (priceObjPut  && !isNaN(priceObjPut.p))   lastPutPrice  = priceObjPut.p;

    if (!result.converged) {
      msgEl.textContent = '\u2014';
      // still update intermediate values to dash
      setIntermediateValues(null);
      return;
    }

    // fill inputs with solved value
    if (solveTarget === 'price' && typeof result.value === 'number' && !isNaN(result.value)) {
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

    msgEl.textContent = result.value.toFixed(6);

    // update intermediate values and formula label
    setIntermediateValues(activePriceObj);
    updateFormulaDisplay(typeSelect.value, optionType);

    // compute I (PV of dividends)
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
          if (I > 0 && isFinite(I)) I_val = I;
        }
      }
      iEl.textContent = (I_val !== null && isFinite(I_val)) ? I_val.toFixed(6) : '\u2014';
    }
  }

  function setIntermediateValues(priceObj) {
    var d1El  = document.getElementById('output-d1');
    var d2El  = document.getElementById('output-d2');
    var nd1El = document.getElementById('output-nd1');
    var nd2El = document.getElementById('output-nd2');
    function setDash(el) { if (el) el.textContent = '\u2014'; }
    function safeNum(v, el) {
      if (el) el.textContent = (typeof v === 'number' && !isNaN(v)) ? v.toFixed(6) : '\u2014';
    }
    if (priceObj && typeof priceObj.d1 !== 'undefined') {
      safeNum(priceObj.d1, d1El);
      safeNum(priceObj.d2, d2El);
      safeNum(priceObj.Nd1, nd1El);
      safeNum(priceObj.Nd2, nd2El);
    } else {
      setDash(d1El);
      setDash(d2El);
      setDash(nd1El);
      setDash(nd2El);
    }
  }

  // ----- Attach input listeners -----
  for (var key in inputs) {
    if (inputs.hasOwnProperty(key) && inputs[key]) {
      inputs[key].addEventListener('input', function () {
        computeSolve();
      });
    }
  }
  if (rfInput) rfInput.addEventListener('input', computeSolve);
  if (qInput)  qInput.addEventListener('input', computeSolve);

  typeSelect.addEventListener('change', function () {
    updateUnderlyingUI();
    computeSolve();
  });

  // ----- Formula display -----
  function updateFormulaDisplay(type, optType) {
    var d1Span = document.getElementById('d1-formula');
    var d2Span = document.getElementById('d2-formula');
    var callSpan  = document.getElementById('call-formula');
    var priceLabel = document.getElementById('price-formula-label');
    if (!d1Span || !d2Span || !callSpan) return;

    var d2Text = '<i>d</i><sub>2</sub> = <i>d</i><sub>1</sub> - <i>&sigma;</i>&radic;<i>T</i>';
    var d1Text, formulaText;

    if (type === 'equity') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln((<i>S</i><sub>0</sub> - <i>I</i>)/<i>K</i>) + (<i>r</i> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      if (optType === 'put') {
        formulaText = '<i>p</i> = <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(-<i>d</i><sub>2</sub>) - (<i>S</i><sub>0</sub> - <i>I</i>) N(-<i>d</i><sub>1</sub>)';
      } else {
        formulaText = '<i>c</i> = (<i>S</i><sub>0</sub> - <i>I</i>) N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
      }
    } else if (type === 'currency') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>S</i><sub>0</sub>/<i>K</i>) + (<i>r</i> - <i>r</i><sub><i>f</i></sub> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      if (optType === 'put') {
        formulaText = '<i>p</i> = <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(-<i>d</i><sub>2</sub>) - <i>S</i><sub>0</sub> <i>e</i><sup>-<i>r</i><sub><i>f</i></sub><i>T</i></sup> N(-<i>d</i><sub>1</sub>)';
      } else {
        formulaText = '<i>c</i> = <i>S</i><sub>0</sub> <i>e</i><sup>-<i>r</i><sub><i>f</i></sub><i>T</i></sup> N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
      }
    } else if (type === 'index') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>S</i><sub>0</sub>/<i>K</i>) + (<i>r</i> - <i>q</i> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      if (optType === 'put') {
        formulaText = '<i>p</i> = <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(-<i>d</i><sub>2</sub>) - <i>S</i><sub>0</sub> <i>e</i><sup>-<i>q</i><i>T</i></sup> N(-<i>d</i><sub>1</sub>)';
      } else {
        formulaText = '<i>c</i> = <i>S</i><sub>0</sub> <i>e</i><sup>-<i>q</i><i>T</i></sup> N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
      }
    } else if (type === 'futures') {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>F</i><sub>0</sub>/<i>K</i>) + (<i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      if (optType === 'put') {
        formulaText = '<i>p</i> = <i>e</i><sup>-<i>r</i><i>T</i></sup> [ <i>K</i> N(-<i>d</i><sub>2</sub>) - <i>F</i><sub>0</sub> N(-<i>d</i><sub>1</sub>) ]';
      } else {
        formulaText = '<i>c</i> = <i>e</i><sup>-<i>r</i><i>T</i></sup> [ <i>F</i><sub>0</sub> N(<i>d</i><sub>1</sub>) - <i>K</i> N(<i>d</i><sub>2</sub>) ]';
      }
    } else {
      d1Text = '<i>d</i><sub>1</sub> = [ ln(<i>S</i><sub>0</sub>/<i>K</i>) + (<i>r</i> + <i>&sigma;</i><sup>2</sup>/2)<i>T</i> ] / [ <i>&sigma;</i>&radic;<i>T</i> ]';
      if (optType === 'put') {
        formulaText = '<i>p</i> = <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(-<i>d</i><sub>2</sub>) - <i>S</i><sub>0</sub> N(-<i>d</i><sub>1</sub>)';
      } else {
        formulaText = '<i>c</i> = <i>S</i><sub>0</sub> N(<i>d</i><sub>1</sub>) - <i>K</i> <i>e</i><sup>-<i>r</i><i>T</i></sup> N(<i>d</i><sub>2</sub>)';
      }
    }

    d1Span.innerHTML = d1Text;
    d2Span.innerHTML = d2Text;
    callSpan.innerHTML = formulaText;

    if (priceLabel) {
      priceLabel.innerHTML = optType === 'put'
        ? 'Put value (<i>p</i>) formula:'
        : 'Call value (<i>c</i>) formula:';
    }
  }

  // ----- Set sensible default values -----
  inputs.S0.value = '100';
  inputs.K.value = '100';
  inputs.r.value = '0.05';
  inputs.sigma.value = '0.2';
  inputs.T.value = '1';

  if (typeof blackScholesCallPrice === 'function') {
    var defaultCall = blackScholesCallPrice(100, 100, 0.05, 0.2, 1);
    if (defaultCall && !isNaN(defaultCall.c)) {
      inputs.marketprice.value = defaultCall.c.toFixed(6);
      lastCallPrice = defaultCall.c;
    } else {
      inputs.marketprice.value = '10.450583';
      lastCallPrice = 10.450583;
    }
  }
  if (typeof blackScholesPutPrice === 'function') {
    var defaultPut = blackScholesPutPrice(100, 100, 0.05, 0.2, 1);
    if (defaultPut && !isNaN(defaultPut.p)) {
      lastPutPrice = defaultPut.p;
    } else {
      lastPutPrice = 5.573526; // fallback
    }
  }

  // ----- Initial activation -----
  updateMarketPriceLabel();
  updateUnderlyingUI();
  collectDividends();
  updateSolveUIVisibility();
  computeSolve();
});
