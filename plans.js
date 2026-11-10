import { auth } from './firebase.js';
import { showAlert } from './utils.js';

import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const payBtns = document.querySelectorAll('.payBtn');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const dashboardLink = document.getElementById('dashboardLink');
const trialBtn = document.getElementById('trialBtn');

// Paystack public key must not be hardcoded.
// Expect it from page/env injection: window.__ENV__.PAYSTACK_KEY
const PAYSTACK_KEY = (typeof window !== 'undefined' &&
  window.__ENV__ && window.__ENV__.PAYSTACK_KEY)
  ? window.__ENV__.PAYSTACK_KEY
  : '';

const PAYSTACK_KEY_MISSING = !PAYSTACK_KEY;

if (PAYSTACK_KEY_MISSING) {
  console.warn('[KTM Academy] PAYSTACK_KEY missing. Payments will be disabled.');
  // Hard-disable payment buttons until a valid key is present.
  payBtns.forEach(btn => { btn.disabled = true; });
}

let currentUser = null;

/*
|--------------------------------------------------------------------------
| PAYSTACK PLAN CODES
|--------------------------------------------------------------------------
*/

const PLAN_CODES = {
  gold: 'PLN_ew6b9ttywkz2n6c',
  premium: 'PLN_24up6xyun66xpd2'
};

/*
|--------------------------------------------------------------------------
| AUTH STATE
|--------------------------------------------------------------------------
*/

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    loginBtn.classList.add('hidden');
    registerBtn.classList.add('hidden');

    logoutBtn.classList.remove('hidden');
    dashboardLink.classList.remove('hidden');

    trialBtn.textContent = 'Trial Active';
    trialBtn.disabled = true;

    payBtns.forEach(btn => {
      btn.disabled = PAYSTACK_KEY_MISSING;
    });

  } else {
    loginBtn.classList.remove('hidden');
    registerBtn.classList.remove('hidden');

    logoutBtn.classList.add('hidden');
    dashboardLink.classList.add('hidden');

    trialBtn.textContent = 'Start Trial (Register)';
    trialBtn.disabled = false;
    // Trial starts via registration when logged out.
    trialBtn.addEventListener('click', () => {
      window.location.href = 'register.html';
    }, { once: true });

    payBtns.forEach(btn => {
      btn.disabled = true;
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

logoutBtn?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showAlert('Logged out successfully.', 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);

  } catch (error) {
    console.error(error);
    showAlert('Failed to logout. Please try again.', 'error');
  }
});

/*
|--------------------------------------------------------------------------
| PAYSTACK PAYMENT
|--------------------------------------------------------------------------
*/

const inFlight = new Map();

payBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    // Prevent double click / duplicate iframes.
    if (inFlight.get(btn)) return;

    // If config isn't present, fail safely (don't attempt Paystack.setup with empty key).
    if (PAYSTACK_KEY_MISSING) {
      showAlert('Payments are temporarily unavailable (missing Paystack configuration).', 'error');
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK LOGIN
    |--------------------------------------------------------------------------
    */
    if (!currentUser) {
      showAlert('Please login before purchasing a plan.', 'error');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      return;
    }

    // Lock UI immediately.
    inFlight.set(btn, true);
    btn.disabled = true;

    const done = () => {
      inFlight.set(btn, false);
      // Keep disabled for the remainder of the flow; re-enable after failures.
      btn.disabled = false;
    };

    /*
    |--------------------------------------------------------------------------
    | GET PLAN DATA
    |--------------------------------------------------------------------------
    */
    const target = e.currentTarget;
    const plan = target?.dataset?.plan;
    const amountRaw = target?.dataset?.amount;
    const amount = Number.parseInt(amountRaw, 10);

    /*
    |--------------------------------------------------------------------------
    | GET PAYSTACK PLAN CODE
    |--------------------------------------------------------------------------
    */
    const planCode = plan ? PLAN_CODES[plan] : null;

    if (!planCode) {
      showAlert('Invalid subscription plan selected.', 'error');
      done();
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert('Invalid payment amount. Please refresh and try again.', 'error');
      done();
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK PAYSTACK
    |--------------------------------------------------------------------------
    */
    if (!window.PaystackPop || typeof window.PaystackPop.setup !== 'function') {
      showAlert('Paystack failed to load. Refresh and try again.', 'error');
      done();
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | START PAYMENT
    |--------------------------------------------------------------------------
    */
    let handler;
    try {
      handler = window.PaystackPop.setup({
        key: PAYSTACK_KEY,
        email: currentUser.email,
        amount: amount,
        currency: 'ZAR',

        // Link Paystack subscription plan here.
        plan: planCode,
        ref: 'mathwithmdu_' + Date.now(),

        metadata: {
          custom_fields: [
            {
              display_name: 'Plan',
              variable_name: 'plan',
              value: plan
            }
          ]
        },

        callback: function (response) {
          const ref = response?.reference;
          // Avoid noisy production logging of full Paystack response.
          // console.log('Payment successful:', response);

          showAlert(
            `Payment successful! Reference: ${ref || 'N/A'}. Activating your subscription...`,
            'success'
          );

          // Avoid re-enabling in success; redirect soon.
          inFlight.delete(btn);
          btn.disabled = false;

          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 2500);
        },

        onClose: function () {
          showAlert('Payment cancelled or not completed.', 'error');
          done();
        }
      });
    } catch (err) {
      console.error('Paystack setup error:', err);
      showAlert('Could not initialize payment. Please try again.', 'error');
      done();
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | OPEN PAYSTACK
    |--------------------------------------------------------------------------
    */
    try {
      handler.openIframe();
    } catch (err) {
      console.error('Paystack openIframe error:', err);
      showAlert('Could not open Paystack payment window. Please try again.', 'error');
      done();
    }
  });
});
