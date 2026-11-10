// logout.js
import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } 
  from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const logoutBtn = document.getElementById('logoutBtn');
const dashboardLink = document.getElementById('dashboardLink');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'index.html'; // redirect after logout
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });
}

// Show/hide buttons depending on auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    logoutBtn.classList.remove('hidden');
    dashboardLink.classList.remove('hidden');
    loginBtn.classList.add('hidden');
    registerBtn.classList.add('hidden');
  } else {
    logoutBtn.classList.add('hidden');
    dashboardLink.classList.add('hidden');
    loginBtn.classList.remove('hidden');
    registerBtn.classList.remove('hidden');
  }
});
