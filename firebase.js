import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  getIdTokenResult 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

/* =========================
   FIREBASE CONFIG (SAFE)
   ========================= */
const firebaseConfig =
  (typeof window !== 'undefined' &&
    window.__ENV__ &&
    window.__ENV__.firebaseConfig)
    ? window.__ENV__.firebaseConfig
    : {
        apiKey: "AIzaSyDJyh2rEHrp461pdUCVapZ81-YWyv9di38",
        authDomain: "mathwithmdu.firebaseapp.com",
        projectId: "mathwithmdu",
        storageBucket: "mathwithmdu.firebasestorage.app",
        messagingSenderId: "23891407297",
        appId: "1:23891407297:web:c19e0b87025c3f51c0bf40",
        measurementId: "G-0414TYTBRK"
      };

/* =========================
   INIT FIREBASE APP
   ========================= */
export const app = initializeApp(firebaseConfig);

/* =========================
   SERVICES
   ========================= */
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* =========================
   ADMIN LOGIN HANDLER
   ========================= */
const loginForm = document.getElementById("adminLoginForm");
const errorBox = document.getElementById("loginError");

// Guard: only attach this handler when the admin login button is meant to submit the form.
// On admin.html the login button is type="button" and admin.js handles login via click.
// Prevents double-handling / unexpected redirect/signOut.
const adminLoginBtn = document.getElementById("adminLogin");
const isSubmitButton =
  !!adminLoginBtn && (adminLoginBtn.getAttribute("type") || "").toLowerCase() === "submit";

if (loginForm && isSubmitButton) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check for admin claim
      const tokenResult = await getIdTokenResult(user);
      if (tokenResult.claims.admin) {
        // console.log("✅ Admin logged in:", user.email); // avoid noisy production logging
        window.location.href = "admin.html"; // redirect
      } else {
        errorBox.innerText = "❌ Access denied. Not an admin.";
        await auth.signOut();
      }
    } catch (err) {
      errorBox.innerText = "Login failed: " + err.message;
    }
  });
}
