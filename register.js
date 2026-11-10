import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, getIdTokenResult, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { showAlert, showLoading, hideLoading } from './utils.js';

const getEl = (id) => document.getElementById(id);

const registerForm = getEl('registerForm');
const nameEl = getEl('regName');
const emailEl = getEl('regEmail');
const passwordEl = getEl('regPassword');
const confirmPasswordEl = getEl('regConfirmPassword');
const gradeEl = getEl('regGrade');
const privacyConsentEl = getEl('privacyConsent');
const submitBtn = getEl('registerSubmit');

let registrationInProgress = false;
let pendingProfile = null;
let pendingUid = null;

function setProcessing(isProcessing) {
  if (submitBtn) submitBtn.disabled = isProcessing;
  if (nameEl) nameEl.disabled = isProcessing;
  if (emailEl) emailEl.disabled = isProcessing;
  if (passwordEl) passwordEl.disabled = isProcessing;
  if (confirmPasswordEl) confirmPasswordEl.disabled = isProcessing;
  if (gradeEl) gradeEl.disabled = isProcessing;
  if (privacyConsentEl) privacyConsentEl.disabled = isProcessing;

  if (isProcessing) showLoading('loading');
  else hideLoading('loading');
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function handleRegister(e) {
  e.preventDefault();

  const name = nameEl?.value?.trim() || '';
  const email = emailEl?.value?.trim().toLowerCase() || '';
  const password = passwordEl?.value || '';
  const confirmPassword = confirmPasswordEl?.value || '';
  const grade = gradeEl?.value || '';
  const privacyConsentAccepted = privacyConsentEl?.checked ?? false;

  // Validation
  if (!name) {
    showAlert('Full name is required.', 'error');
    return;
  }

  if (!email || !validateEmail(email)) {
    showAlert('Enter a valid email address.', 'error');
    return;
  }

  if (!grade) {
    showAlert('Please select your grade.', 'error');
    return;
  }

  if (!password) {
    showAlert('Password is required.', 'error');
    return;
  }

  // Password minimum length validation (>= 6)
  const MIN_LEN = 6;
  if (password.length < MIN_LEN) {
    showAlert(`Password must be at least ${MIN_LEN} characters.`, 'error');
    return;
  }

  if (password.length > 72) {
    showAlert('Password is too long. Please use a shorter password.', 'error');
    return;
  }

  // Password confirmation validation
  if (!confirmPassword) {
    showAlert('Please confirm your password.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showAlert('Passwords do not match.', 'error');
    return;
  }

  // POPIA consent validation (keeps existing flow)
  if (!privacyConsentAccepted) {
    showAlert('Please confirm POPIA consent.', 'error');
    return;
  }

  try {
    setProcessing(true);
    registrationInProgress = true;
    if (pendingProfile && auth.currentUser?.uid !== pendingUid) {
      showAlert('Sign in to the account that was just created to finish setting up its profile.', 'error');
      return;
    }

    const profile = pendingProfile || {
      name,
      email,
      grade,
      plan: 'trial',
      isPaid: false,
      trialUsed: false,
      privacyConsentAccepted,
      privacyConsentAcceptedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    if (!pendingProfile) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      pendingUid = userCredential.user.uid;
      pendingProfile = profile;
    }

    await setDoc(doc(db, 'users', pendingUid), pendingProfile);
    pendingProfile = null;
    pendingUid = null;

    showAlert('Bronze account created!', 'success');

    window.location.href = 'dashboard.html';
  } catch (err) {
    const profilePending = Boolean(pendingProfile && auth.currentUser?.uid === pendingUid);
    const msg = profilePending
      ? 'Your account was created, but its profile could not be saved. Please submit again to retry profile setup.'
      : (err?.message || 'Registration failed. Please try again.');
    showAlert(msg, 'error');
  } finally {
    registrationInProgress = Boolean(pendingProfile);
    setProcessing(false);
  }
}

function init() {
  if (!registerForm) {
    console.error('[MathWithMDU] registerForm missing');
    return;
  }

  registerForm.addEventListener('submit', handleRegister);

  onAuthStateChanged(auth, async (user) => {
    if (user && !registrationInProgress) {
      try {
        const tokenResult = await getIdTokenResult(user, true);
        if (auth.currentUser?.uid !== user.uid) return;
        window.location.href = tokenResult.claims.admin === true ? 'admin.html' : 'dashboard.html';
      } catch (error) {
        if (auth.currentUser?.uid !== user.uid) return;
        console.error('[MathWithMDU] Could not verify signed-in user role:', error);
        showAlert('Unable to verify your account. Check your connection and try again.', 'error');
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
