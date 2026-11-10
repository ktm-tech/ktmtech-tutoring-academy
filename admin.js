import { app, auth, db, storage } from './firebase.js';
import { showAlert } from './utils.js'; // FIXED: Shared utils import
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword // FIXED: Added missing import
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

const adminLogin = document.getElementById('adminLogin');

const adminSection = document.getElementById('adminSection');
const authSection = document.getElementById('authSection');
const logoutBtn = document.getElementById('logoutBtn');
const adminInfo = document.getElementById('adminInfo');

const lessonForm = document.getElementById('lessonForm');
const paperForm = document.getElementById('paperForm');
const uploadForm = document.getElementById('uploadForm');
const announceForm = document.getElementById('announceForm');

// FIXED: showAlert imported from utils.js - local duplicate removed


if (adminLogin) {
  // Uses the admin login fields from admin.html (no prompts).
  adminLogin.addEventListener('click', async () => {
    const email = document.getElementById('adminEmail')?.value?.trim() || '';
    const password = document.getElementById('adminPassword')?.value || '';

    if (!email || !password) {
      showAlert('Admin email and password are required.', 'error');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Listener will handle redirect/gating.
    } catch (err) {
      showAlert(err?.message || 'Admin login failed.', 'error');
    }
  });
}

logoutBtn?.addEventListener('click', () => {
  signOut(auth);
});

if (lessonForm) lessonForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    title: document.getElementById('lessonTitle').value,
    grade: parseInt(document.getElementById('lessonGrade').value),
    term: parseInt(document.getElementById('lessonTerm').value),
    week: parseInt(document.getElementById('lessonWeek').value),
    topic: document.getElementById('lessonTopic').value,
    description: document.getElementById('lessonDesc').value,
    fileURL: document.getElementById('lessonURL').value,
    isFree: document.getElementById('lessonAccess').value === 'free',
    plan: document.getElementById('lessonAccess').value === 'free' ? null : document.getElementById('lessonAccess').value,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'lessons'), data);
    showAlert('Lesson uploaded!');
    lessonForm.reset();
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

if (paperForm) paperForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    title: document.getElementById('paperTitle').value,
    grade: parseInt(document.getElementById('paperGrade').value),
    topic: document.getElementById('paperTopic').value,
    fileURL: document.getElementById('paperURL').value,
    isFree: document.getElementById('paperAccess').value === 'free',
    plan: document.getElementById('paperAccess').value === 'free' ? null : document.getElementById('paperAccess').value,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'past_papers'), data);
    showAlert('Paper uploaded!');
    paperForm.reset();
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

if (announceForm) announceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('announceTitle')?.value?.trim() || '';
  const grade = document.getElementById('announceGrade')?.value || 'all';
  const message = document.getElementById('announceMsg')?.value?.trim() || '';
  if (!title || !message || !['all', '10', '11', '12'].includes(grade)) {
    showAlert('Add a title, message and valid audience before sending.', 'error');
    return;
  }
  const data = {
    title,
    message,
    grade,
    meetingLink: document.getElementById('announceLink').value.trim(),
    isImportant: document.getElementById('announceImportant').checked,
    date: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'announcements'), data);
    showAlert('Announcement sent to the selected audience!', 'success');
    announceForm.reset();
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

if (uploadForm) uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const file = document.getElementById('fileInput').files[0];
  const title = document.getElementById('fileTitle').value;
  const fileName = `uploads/${Date.now()}_${file.name}`;
  
  // Client-side guard only; Firestore rules are the real gate.
  if (!auth.currentUser) {
    showAlert('Login required', 'error');
    return;
  }

  const storageRef = ref(storage, fileName);
  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on('state_changed', 
    (snapshot) => {
      // Avoid noisy upload progress logging in production.
      // const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      // console.log('Upload is ' + progress + '% done');
    },
    (error) => {
      showAlert('Upload failed: ' + error.message, 'error');
    },
    async () => {
      const url = await getDownloadURL(storageRef);
      
      // Save metadata to Firestore /uploads/{filename}
      await setDoc(doc(db, 'uploads', file.name), {
        title,
        fileName: file.name,
        downloadURL: url,
        uploadedBy: auth.currentUser.email,
        uploadedAt: serverTimestamp(),
        size: file.size
      });
      
      showAlert('File uploaded successfully!');
      uploadForm.reset();
    }
  );
});

// ---- Admin access guard (custom claims) ----
// Enforces UI gating AND prevents admin-only handlers from running for non-admins.

function setAdminUI(isAdmin) {
  if (authSection) authSection.classList.toggle('hidden', !!isAdmin);
  if (adminSection) adminSection.classList.toggle('hidden', !isAdmin);
  if (adminInfo) {
    adminInfo.textContent = isAdmin
      ? `Signed in as admin: ${auth.currentUser?.email || auth.currentUser?.uid || ''}`
      : '';
  }
}

// Default: hide admin UI until claim verification completes.
setAdminUI(false);

let isAdminUser = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    isAdminUser = false;
    setAdminUI(false);
    window.location.href = 'index.html';
    return;
  }

  try {
    // IMPORTANT: Custom claims live in the ID token.
    // Force-refresh token so newly set claims propagate.
    const tokenResult = await user.getIdTokenResult(true);

    if (tokenResult?.claims?.admin) {
      isAdminUser = true;
      setAdminUI(true);
    } else {
      isAdminUser = false;
      // Redirect non-admins away from the admin page.
      await signOut(auth);
      setAdminUI(false);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error('Error checking admin claim:', err);
    isAdminUser = false;
    await signOut(auth);
    setAdminUI(false);
    window.location.href = 'index.html';
  }
});


// Hard block: stop admin-only submits until claim check has passed.
// (Firestore rules remain the real security gate.)
[lessonForm, paperForm, announceForm, uploadForm]
  .filter(Boolean)
  .filter(Boolean)
  .forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!isAdminUser) {
        e.preventDefault();
        e.stopPropagation();
        showAlert('Admin access required.', 'error');
      }
    });
  });






