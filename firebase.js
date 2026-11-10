import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
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
        apiKey: "AIzaSyCenETtFv_PIVthHOIX2AxoL9wkwp92kXw",
        authDomain: "ktm-tutoring-academy.firebaseapp.com",
        projectId: "ktm-tutoring-academy",
        storageBucket: "ktm-tutoring-academy.firebasestorage.app",
        messagingSenderId: "447439930483",
        appId: "1:447439930483:web:8f6c89c7ede1b8cfd15606",
        measurementId: "G-Z3V3BLRMP1"
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
