import { auth } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { showAlert, showLoading, hideLoading } from './utils.js';

const getEl = (id) => document.getElementById(id);

const loginForm = getEl('loginForm');
const emailEl = getEl('loginEmail');
const passwordEl = getEl('loginPassword');
const submitBtn = getEl('loginSubmit');
const loadingOverlay = getEl('loading');

function setProcessing(isProcessing) {
  if (submitBtn) submitBtn.disabled = isProcessing;
  if (emailEl) emailEl.disabled = isProcessing;
  if (passwordEl) passwordEl.disabled = isProcessing;

  // If your utils showLoading/hideLoading rely on #loading, we still keep consistent behavior.
  if (isProcessing) showLoading('loading');
  else hideLoading('loading');
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = emailEl?.value?.trim() || '';
  const password = passwordEl?.value || '';

  // Client-side validation
  if (!email) {
    showAlert('Email is required.', 'error');
    return;
  }
  if (!validateEmail(email)) {
    showAlert('Enter a valid email address.', 'error');
    return;
  }
  if (!password) {
    showAlert('Password is required.', 'error');
    return;
  }

  try {
    setProcessing(true);

    const credential = await signInWithEmailAndPassword(auth, email, password);

    showAlert('Login successful!', 'success');

    const tokenResult = await getIdTokenResult(credential.user);
    window.location.href = tokenResult.claims.admin === true ? 'admin.html' : 'dashboard.html';
  } catch (err) {
    const msg = err?.message || 'Login failed. Please try again.';
    showAlert(msg, 'error');
  } finally {
    setProcessing(false);
  }
}

function init() {
  if (!loginForm) {
    console.error('[MathWithMDU] loginForm missing');
    return;
  }

  loginForm.addEventListener('submit', handleLogin);

  // If already logged in, redirect away from login page
  if (['login.html', 'register.html'].includes(window.location.pathname.split('/').pop())) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const tokenResult = await getIdTokenResult(user, true);
        if (auth.currentUser?.uid !== user.uid) return;
        window.location.href = tokenResult.claims.admin === true ? 'admin.html' : 'dashboard.html';
      } catch (err) {
        if (auth.currentUser?.uid !== user.uid) return;
        console.error('[MathWithMDU] Could not verify signed-in user role:', err);
        showAlert('Unable to verify your account. Check your connection and try again.', 'error');
      }
    });
  }

  // Clear loading overlay reference (optional)
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
