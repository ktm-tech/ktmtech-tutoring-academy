import { auth } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

/*
  Home page entry point.
  Keep it minimal and safe because this runs on index.html only.
*/

document.addEventListener('DOMContentLoaded', () => {
  // console.log('[MathWithMDU] Home loaded'); // avoid noisy production logging

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const dashboardLink = document.getElementById('dashboardLink');

  // Optional: elements may not exist on some pages.
  const safeSetHidden = (el, hidden) => {
    if (!el) return;
    el.classList.toggle('hidden', hidden);
  };

  onAuthStateChanged(auth, (user) => {
    if (!loginBtn || !registerBtn) {
      // If navbar markup is different, just skip.
    }

    const loggedIn = !!user;

    safeSetHidden(loginBtn, loggedIn);
    safeSetHidden(registerBtn, loggedIn);
    safeSetHidden(logoutBtn, !loggedIn);
    if (dashboardLink) dashboardLink.classList.toggle('hidden', !loggedIn);

    // If logout exists, wire it once.
    logoutBtn?.addEventListener('click', () => {
      signOut(auth).then(() => {
        window.location.href = 'index.html';
      }).catch((err) => console.error('[MathWithMDU] logout error', err));
    }, { once: true });
  });
});

