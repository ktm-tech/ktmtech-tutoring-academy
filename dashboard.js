import { app, auth, db } from './firebase.js';
import { 
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { showAlert, showLoading, hideLoading } from './utils.js'; // FIXED: Shared utils - removes local duplication


// Elements
const userInfo = document.getElementById('userInfo');
const planBadge = document.getElementById('planBadge');
const lessonsList = document.getElementById('lessonsList');
const papersList = document.getElementById('papersList');
const announcementsList = document.getElementById('announcementsList');
const loading = document.getElementById('loading');
const alertContainer = document.getElementById('alertContainer');

let currentUser = null;
let userPlan = 'bronze';
let currentGrade = '';
let contentPlan = 'trial';
const PLAN_LABELS = { trial: 'Bronze', bronze: 'Bronze', gold: 'Gold', premium: 'Premium', platinum: 'Premium', platinum_star: 'Premium' };
const ADMIN_ROLE_LABEL = 'ADMIN';

// FIXED: Utils imported above - local functions removed


// Load content
async function loadLessons() {
  try {
    const lessonCollection = collection(db, 'lessons');
    const freeSnapshot = await getDocs(query(lessonCollection, where('isFree', '==', true)));
    let docs = [...freeSnapshot.docs];
    if (userPlan !== 'bronze') {
      const plansToLoad = contentPlan === 'platinum_star' || contentPlan === 'platinum' ? ['gold', contentPlan] : [contentPlan];
      const planSnapshots = await Promise.all(plansToLoad.map(plan => getDocs(query(lessonCollection, where('plan', '==', plan)))));
      const seen = new Set(docs.map(item => item.id));
      planSnapshots.forEach(snapshot => snapshot.docs.forEach(item => { if (!seen.has(item.id)) { docs.push(item); seen.add(item.id); } }));
    }
    docs = docs.filter(item => String(item.data().grade) === currentGrade);
    docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
    // Bronze includes one lesson; paid tiers can browse the published resources for their grade.
    const visibleDocs = userPlan === 'bronze' ? docs.slice(0, 1) : docs;

    // Clear safely (no HTML parsing)
    lessonsList.replaceChildren();

    if (visibleDocs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'lesson-item';
      empty.textContent = 'No lessons available yet. Check back soon or upgrade your plan!';
      lessonsList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    visibleDocs.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'lesson-item';

      const titleEl = document.createElement('h4');
      titleEl.textContent = data.title || '';

      const metaEl = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `Grade ${data.grade} Term ${data.term} Week ${data.week}:`;
      metaEl.append(strong);
      metaEl.append(document.createTextNode(' ' + (data.topic || '')));

      const descEl = document.createElement('p');
      descEl.textContent = data.description || '';

      const a = document.createElement('a');
      a.className = 'download-btn';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.href = data.fileURL || '#';

      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-file-arrow-down mdu-icon';
      icon.setAttribute('aria-hidden', 'true');

      const text = document.createTextNode('Download Lesson');

      a.append(icon, text);

      item.append(titleEl, metaEl, descEl, a);
      frag.appendChild(item);
    });

    lessonsList.appendChild(frag);
  } catch (error) {
    lessonsList.replaceChildren();
    const err = document.createElement('p');
    err.className = 'lesson-item restricted';
    err.textContent = 'Error loading lessons. Try refreshing.';
    lessonsList.appendChild(err);
    console.error('Lessons error:', error);
  }
}

async function loadPapers() {
  try {
    const paperCollection = collection(db, 'past_papers');
    const freeSnapshot = await getDocs(query(paperCollection, where('isFree', '==', true)));
    let docs = [...freeSnapshot.docs];
    if (userPlan !== 'bronze') {
      const plansToLoad = contentPlan === 'platinum_star' || contentPlan === 'platinum' ? ['gold', contentPlan] : [contentPlan];
      const planSnapshots = await Promise.all(plansToLoad.map(plan => getDocs(query(paperCollection, where('plan', '==', plan)))));
      const seen = new Set(docs.map(item => item.id));
      planSnapshots.forEach(snapshot => snapshot.docs.forEach(item => { if (!seen.has(item.id)) { docs.push(item); seen.add(item.id); } }));
    }
    docs = docs.filter(item => String(item.data().grade) === currentGrade);
    docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
    const visibleDocs = userPlan === 'bronze' ? docs.slice(0, 1) : docs.slice(0, 100);

    papersList.replaceChildren();

    if (visibleDocs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'lesson-item';
      empty.textContent = 'No past papers available yet. Check back soon!';
      papersList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    visibleDocs.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'lesson-item';

      const titleEl = document.createElement('h4');
      titleEl.textContent = data.title || '';

      const metaEl = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `Grade ${data.grade}:`;
      metaEl.append(strong);
      metaEl.append(document.createTextNode(' ' + (data.topic || '')));

      const a = document.createElement('a');
      a.className = 'download-btn';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.href = data.fileURL || '#';

      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-file-arrow-down mdu-icon';
      icon.setAttribute('aria-hidden', 'true');

      const text = document.createTextNode('Download Paper');

      a.append(icon, text);

      item.append(titleEl, metaEl, a);
      frag.appendChild(item);
    });

    papersList.appendChild(frag);
  } catch (error) {
    papersList.replaceChildren();
    const err = document.createElement('p');
    err.className = 'lesson-item restricted';
    err.textContent = 'Error loading papers. Try refreshing.';
    papersList.appendChild(err);
    console.error('Papers error:', error);
  }
}

async function loadAnnouncements() {
  try {
    const audienceGrades = ['all', String(currentGrade || '')].filter((value, index, values) => value && values.indexOf(value) === index);
    const q = query(collection(db, 'announcements'), where('grade', 'in', audienceGrades));
    const snapshot = await getDocs(q);

    announcementsList.replaceChildren();

    if (snapshot.empty) {
      const empty = document.createElement('p');
      empty.textContent = 'No announcements yet. Check WhatsApp for updates!';
      announcementsList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    snapshot.docs.sort((a, b) => (b.data().date?.seconds || 0) - (a.data().date?.seconds || 0)).forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'lesson-item';
      if (data.isImportant) item.classList.add('announcement-important');

      const h4 = document.createElement('h4');
      h4.textContent = data.title || 'KTM Academy announcement';
      item.appendChild(h4);
      const message = document.createElement('p');
      message.textContent = data.message || '';
      item.appendChild(message);
      const audience = document.createElement('small');
      audience.className = 'muted';
      audience.textContent = data.grade === 'all' ? 'For all students' : `For Grade ${data.grade}`;
      item.appendChild(audience);

      if (data.meetingLink) {
        const a = document.createElement('a');
        a.className = 'download-btn';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = data.meetingLink;
        a.textContent = 'Join Meeting';
        item.appendChild(a);
      }

      frag.appendChild(item);
    });

    announcementsList.appendChild(frag);
  } catch (error) {
    announcementsList.replaceChildren();
    const err = document.createElement('p');
    err.textContent = 'Error loading announcements.';
    announcementsList.appendChild(err);
    console.error('Announcements error:', error);
  }
}

// Auth listener
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  try {
    showLoading();

    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    if (!lessonsList || !papersList || !announcementsList) {
      showAlert('Dashboard failed to load (missing UI elements).', 'error');
      return;
    }
  } catch (_) {
    // ignore
  }


  // POPIA: if the stored consent checkbox is missing/unset, we do not block access,
  // but the Privacy Policy and POPIA pages provide accountability and rights.


  userInfo.textContent = `Hi, ${user.email}`;
  
  // Get user doc
  const userDocRef = doc(db, 'users', user.uid);
  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (error) {
    console.error('[MathWithMDU] Dashboard profile fetch error:', error);
    showAlert('Could not load your account details. Check your internet connection and try again.', 'error');
    hideLoading();
    return;
  }

  const userData = userSnap.exists() ? userSnap.data() : {};
  const storedPlan = String(userData.plan || 'trial').toLowerCase();
  contentPlan = storedPlan;
  userPlan = storedPlan === 'trial' ? 'bronze' : storedPlan;
  currentGrade = String(userData.grade || '');

  planBadge.textContent = `Current Plan: ${PLAN_LABELS[userPlan] || 'Bronze'}`;

  // Admin label (no email-based secrets). Authorization is enforced in Firestore rules.
  // Best practice: expose admin status via custom claim admin=true, but keep UI non-sensitive.
  if (user && user.email) {
    // Leave as-is visually only when admin is detected via custom claim (if present).
    const maybeAdmin = user['admin'] || false;
    if (maybeAdmin) {
      planBadge.textContent += ` ${ADMIN_ROLE_LABEL}`;
      
    }
  }

  hideLoading();
  await Promise.all([
    loadLessons(),
    loadPapers(),
    loadAnnouncements()
  ]);
});

