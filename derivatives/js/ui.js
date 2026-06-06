/**
 * UI logic for the Black-Scholes calculator.
 * This module reads inputs, validates them, calls the pure math functions
 * from blackscholes.js, and writes results into the DOM.
 * The math engine (blackscholes.js) never touches the DOM.
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ----- Input field references -----
  var inputs = {
    S0: document.getElementById('input-spot'),
    K: document.getElementById('input-strike'),
    r: document.getElementById('input-rate'),
    sigma: document.getElementById('input-volatility'),
    T: document.getElementById('input-time')
  };

  // ----- Output element references -----
  var outputs = {
    price: document.getElementById('call-price-output'),
    d1: document.getElementById('output-d1'),
    d2: document.getElementById('output-d2'),
    Nd1: document.getElementById('output-nd1'),
    Nd2: document.getElementById('output-nd2')
  };

  // ----- Error message elements -----
  var errors = {
    S0: document.getElementById('error-spot'),
    K: document.getElementById('error-strike'),
    r: document.getElementById('error-rate'),
    sigma: document.getElementById('error-volatility'),
    T: document.getElementById('error-time')
  };

  // ----- Helper functions -----

  /** Clear all error messages. */
  function clearErrors() {
    for (var key in errors) {
      if (errors.hasOwnProperty(key) && errors[key]) {
        errors[key].textContent = '';
      }
    }
  }

  /** Show an error message for a specific field. */
  function showError(key, msg) {
    if (errors.hasOwnProperty(key) && errors[key]) {
      errors[key].textContent = msg;
    }
  }

  /** Hide computed outputs (when inputs are invalid). */
  function clearOutputs() {
    outputs.price.textContent = '\u2014';
    outputs.d1.textContent = '\u2014';
    outputs.d2.textContent = '\u2014';
    outputs.Nd1.textContent = '\u2014';
    outputs.Nd2.textContent = '\u2014';
  }

  // ----- Main computation function -----
  function compute() {
    clearErrors();

    // Read and parse values
    var S0 = parseFloat(inputs.S0.value);
    var K = parseFloat(inputs.K.value);
    var r = parseFloat(inputs.r.value);
    var sigma = parseFloat(inputs.sigma.value);
    var T = parseFloat(inputs.T.value);

    // Manual validation
    var invalid = false;

    if (isNaN(S0) || S0 <= 0) {
      showError('S0', 'Spot price S₀ must be greater than 0.');
      invalid = true;
    }
    if (isNaN(K) || K <= 0) {
      showError('K', 'Exercise price must be greater than 0.');
      invalid = true;
    }
    if (isNaN(r)) {
      showError('r', 'Rate must be a number.');
      invalid = true;
    }
    if (isNaN(sigma) || sigma <= 0) {
      showError('sigma', 'Volatility σ must be greater than 0.');
      invalid = true;
    }
    if (isNaN(T) || T <= 0) {
      showError('T', 'Time to maturity t must be greater than 0.');
      invalid = true;
    }

    if (invalid) {
      clearOutputs();
      return;
    }

    // Call the pure Black-Scholes function (returns object with property .c)
    var result = blackScholesCallPrice(S0, K, r, sigma, T);

    // Check that the computation succeeded
    if (result === null || result.c === undefined || isNaN(result.c)) {
      clearOutputs();
      return;
    }

    // Update output fields with reasonable precision
    outputs.price.textContent = result.c.toFixed(4);
    outputs.d1.textContent = result.d1.toFixed(4);
    outputs.d2.textContent = result.d2.toFixed(4);
    outputs.Nd1.textContent = result.Nd1.toFixed(4);
    outputs.Nd2.textContent = result.Nd2.toFixed(4);
  }

  // ----- Set sensible default values (demo) -----
  inputs.S0.value = '100';
  inputs.K.value = '100';
  inputs.r.value = '0.05';
  inputs.sigma.value = '0.2';
  inputs.T.value = '1';

  // ----- Bind input events for live recalculation -----
  for (var key in inputs) {
    if (inputs.hasOwnProperty(key) && inputs[key]) {
      inputs[key].addEventListener('input', compute);
    }
  }

  // ----- Compute initial result -----
  compute();
});
