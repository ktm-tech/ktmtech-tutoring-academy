import { app, auth, db } from './firebase.js';
import { 
  onAuthStateChanged, 
  signOut,
  getIdTokenResult
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
import { examApi } from './exam-api.js';


// Elements
const logoutBtn = document.getElementById('logoutBtn');
if (!logoutBtn) {
  console.warn('[MathWithMDU] dashboard logoutBtn missing - check dashboard.html');
}

const userInfo = document.getElementById('userInfo');
const planBadge = document.getElementById('planBadge');
const lessonsList = document.getElementById('lessonsList');
const papersList = document.getElementById('papersList');
const announcementsList = document.getElementById('announcementsList');
const lessonSearch = document.getElementById('lessonSearch');
const lessonTermFilter = document.getElementById('lessonTermFilter');
const paperSearch = document.getElementById('paperSearch');
const loading = document.getElementById('loading');
const alertContainer = document.getElementById('alertContainer');
const examList = document.getElementById('examList');
const examRunner = document.getElementById('examRunner');
const examAnswerForm = document.getElementById('examAnswerForm');
const examQuestionList = document.getElementById('examQuestionList');
const examResult = document.getElementById('examResult');

let currentUser = null;
let userPlan = 'bronze';
let currentGrade = '';
let contentPlan = 'trial';
let activeExam = null;
let activeAttemptId = '';
let examTimerInterval = null;
const PLAN_LABELS = { trial: 'Bronze', bronze: 'Bronze', gold: 'Gold', premium: 'Premium', platinum: 'Premium', platinum_star: 'Premium' };

// FIXED: Utils imported above - local functions removed

function filterResources(list, searchInput, summary, noResults, termFilter = null) {
  if (!list || !searchInput || !summary || !noResults) return 0;

  const search = searchInput.value.trim().toLocaleLowerCase();
  const selectedTerm = termFilter?.value || 'all';
  const resources = [...list.querySelectorAll('.lesson-resource')];
  let visibleCount = 0;

  resources.forEach((resource) => {
    const matchesSearch = resource.dataset.search.includes(search);
    const matchesTerm = selectedTerm === 'all' || resource.dataset.term === selectedTerm;
    const isVisible = matchesSearch && matchesTerm;
    resource.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  summary.textContent = `Showing ${visibleCount} of ${resources.length}`;
  noResults.classList.toggle('hidden', resources.length === 0 || visibleCount > 0);
  return resources.length;
}

function updateResourceCounts(lessons, papers, announcements) {
  const counts = [
    ['lessonCountStat', lessons],
    ['paperCountStat', papers],
    ['announcementCountStat', announcements]
  ];

  counts.forEach(([id, count]) => {
    const element = document.getElementById(id);
    if (element && count !== null) element.textContent = String(count);
  });
}

lessonSearch?.addEventListener('input', () => {
  filterResources(
    lessonsList,
    lessonSearch,
    document.getElementById('lessonResultsSummary'),
    document.getElementById('lessonsNoResults'),
    lessonTermFilter
  );
});
lessonTermFilter?.addEventListener('change', () => {
  filterResources(
    lessonsList,
    lessonSearch,
    document.getElementById('lessonResultsSummary'),
    document.getElementById('lessonsNoResults'),
    lessonTermFilter
  );
});
paperSearch?.addEventListener('input', () => {
  filterResources(
    papersList,
    paperSearch,
    document.getElementById('paperResultsSummary'),
    document.getElementById('papersNoResults')
  );
});

logoutBtn?.addEventListener('click', () => signOut(auth));


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
      empty.textContent = 'No published lessons are available for your grade and plan yet. Check back soon.';
      lessonsList.appendChild(empty);
      filterResources(lessonsList, lessonSearch, document.getElementById('lessonResultsSummary'), document.getElementById('lessonsNoResults'), lessonTermFilter);
      return 0;
    }

    const frag = document.createDocumentFragment();

    visibleDocs.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'lesson-item lesson-resource';
      item.dataset.term = String(data.term || '');
      item.dataset.search = [data.title, data.topic, data.description, data.grade, data.term, data.week]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

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
    filterResources(lessonsList, lessonSearch, document.getElementById('lessonResultsSummary'), document.getElementById('lessonsNoResults'), lessonTermFilter);
    return visibleDocs.length;
  } catch (error) {
    lessonsList.replaceChildren();
    const err = document.createElement('p');
    err.className = 'lesson-item restricted';
    err.textContent = 'Error loading lessons. Try refreshing.';
    lessonsList.appendChild(err);
    console.error('Lessons error:', error);
    return null;
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
      filterResources(papersList, paperSearch, document.getElementById('paperResultsSummary'), document.getElementById('papersNoResults'));
      return 0;
    }

    const frag = document.createDocumentFragment();

    visibleDocs.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'lesson-item lesson-resource';
      item.dataset.search = [data.title, data.topic, data.grade]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

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
    filterResources(papersList, paperSearch, document.getElementById('paperResultsSummary'), document.getElementById('papersNoResults'));
    return visibleDocs.length;
  } catch (error) {
    papersList.replaceChildren();
    const err = document.createElement('p');
    err.className = 'lesson-item restricted';
    err.textContent = 'Error loading papers. Try refreshing.';
    papersList.appendChild(err);
    console.error('Papers error:', error);
    return null;
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
      return 0;
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
    return snapshot.size;
  } catch (error) {
    announcementsList.replaceChildren();
    const err = document.createElement('p');
    err.textContent = 'Error loading announcements.';
    announcementsList.appendChild(err);
    console.error('Announcements error:', error);
    return null;
  }
}

function addExamField(container, labelText, control) {
  const field = document.createElement('div');
  field.className = 'form-group';
  const label = document.createElement('label');
  label.htmlFor = control.id;
  label.textContent = labelText;
  field.append(label, control);
  container.appendChild(field);
}

function stopExamTimer() {
  if (examTimerInterval) {
    clearInterval(examTimerInterval);
    examTimerInterval = null;
  }
}

function renderExamRunner(exam, attempt) {
  activeExam = exam;
  activeAttemptId = attempt.attemptId;
  examList?.classList.add('hidden');
  examRunner?.classList.remove('hidden');
  examResult?.replaceChildren();
  document.getElementById('activeExamTitle').textContent = exam.title;
  document.getElementById('activeExamInstructions').textContent = exam.description || '';
  examQuestionList.replaceChildren();

  exam.questions.forEach((question, index) => {
    const card = document.createElement('article');
    card.className = 'lesson-item';
    const prompt = document.createElement('h4');
    prompt.textContent = `${index + 1}. ${question.prompt} (${question.marks} marks)`;
    const topic = document.createElement('p');
    topic.className = 'muted';
    topic.textContent = question.topic || '';
    card.append(prompt, topic);

    if (question.type === 'choice') {
      (question.choices || []).forEach((choice) => {
        const label = document.createElement('label');
        label.className = 'form-group';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = question.id;
        input.value = choice.id;
        label.append(input, document.createTextNode(` ${choice.id}. ${choice.text}`));
        card.appendChild(label);
      });
    } else {
      const input = question.type === 'written'
        ? document.createElement('textarea')
        : document.createElement('input');
      input.id = `answer_${question.id}`;
      input.name = question.id;
      input.maxLength = 5000;
      if (question.type === 'written') {
        input.rows = 5;
        input.placeholder = 'Write your working and answer';
      } else {
        input.type = 'text';
        input.inputMode = 'decimal';
        input.placeholder = 'Enter a number';
      }
      addExamField(card, question.type === 'written' ? 'Your response' : 'Your answer', input);
    }

    examQuestionList.appendChild(card);
  });

  const timer = document.getElementById('examTimer');
  const durationMinutes = Number(attempt.durationMinutes) || 0;
  if (!durationMinutes) {
    timer.textContent = 'Untimed';
    return;
  }

  const endTime = Date.parse(attempt.startedAt) + durationMinutes * 60000;
  let autoSubmitStarted = false;
  const updateTimer = () => {
    const secondsLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    timer.textContent = `Time remaining: ${minutes}:${seconds}`;
    if (secondsLeft === 0 && !autoSubmitStarted) {
      autoSubmitStarted = true;
      examAnswerForm.requestSubmit();
    }
  };
  updateTimer();
  examTimerInterval = setInterval(updateTimer, 1000);
}

async function loadExams() {
  if (!examList || !currentUser) return null;
  try {
    const examsRef = collection(db, 'exams');
    const freeSnapshot = await getDocs(query(
      examsRef,
      where('grade', '==', currentGrade),
      where('published', '==', true),
      where('isFree', '==', true)
    ));
    let examDocs = [...freeSnapshot.docs];
    if (userPlan !== 'bronze') {
      const plansToLoad = ['platinum', 'platinum_star', 'premium'].includes(contentPlan)
        ? ['gold', contentPlan]
        : [contentPlan];
      const planSnapshots = await Promise.all(plansToLoad.map((plan) => getDocs(query(
        examsRef,
        where('grade', '==', currentGrade),
        where('published', '==', true),
        where('plan', '==', plan)
      ))));
      const seen = new Set(examDocs.map((item) => item.id));
      planSnapshots.forEach((snapshot) => snapshot.docs.forEach((item) => {
        if (!seen.has(item.id)) {
          examDocs.push(item);
          seen.add(item.id);
        }
      }));
    }

    examDocs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
    const availableExams = userPlan === 'bronze' ? examDocs.slice(0, 1) : examDocs;
    examList.replaceChildren();
    if (!availableExams.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No mock examinations are published for your grade and plan yet.';
      examList.appendChild(empty);
      return 0;
    }

    availableExams.forEach((examDoc) => {
      const exam = { id: examDoc.id, ...examDoc.data() };
      const card = document.createElement('article');
      card.className = 'feature-card';
      const title = document.createElement('h3');
      title.textContent = exam.title || 'Mock examination';
      const description = document.createElement('p');
      description.textContent = exam.description || '';
      const details = document.createElement('p');
      details.className = 'muted';
      details.textContent = `${exam.questions?.length || 0} questions · ${exam.durationMinutes ? `${exam.durationMinutes} minutes` : 'untimed'}`;
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'btn btn-primary';
      start.textContent = 'Start examination';
      start.addEventListener('click', async () => {
        start.disabled = true;
        try {
          const attempt = await examApi(`/${encodeURIComponent(exam.id)}/start`, { method: 'POST' });
          renderExamRunner(exam, attempt);
        } catch (error) {
          showAlert(error.message, 'error');
          start.disabled = false;
        }
      });
      card.append(title, description, details, start);
      examList.appendChild(card);
    });
    return availableExams.length;
  } catch (error) {
    examList.replaceChildren();
    const message = document.createElement('p');
    message.className = 'lesson-item restricted';
    message.textContent = 'Mock examinations could not be loaded. Please try again later.';
    examList.appendChild(message);
    console.error('Examinations error:', error);
    return null;
  }
}

let isSubmittingExam = false;
examAnswerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeExam || !activeAttemptId || isSubmittingExam) return;
  isSubmittingExam = true;
  const submitButton = document.getElementById('submitExam');
  submitButton.disabled = true;

  const answers = Object.fromEntries(new FormData(examAnswerForm).entries());
  try {
    const score = await examApi(`/${encodeURIComponent(activeExam.id)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ attemptId: activeAttemptId, answers })
    });
    stopExamTimer();
    examRunner.classList.add('hidden');
    examList.classList.remove('hidden');
    examResult.replaceChildren();
    const result = document.createElement('p');
    result.className = 'alert info';
    result.textContent = score.pendingReviewCount
      ? `${score.objectiveMaxMarks ? `Objective score: ${score.earnedMarks}/${score.objectiveMaxMarks} (${score.objectivePercent}%). ` : ''}Your written response${score.pendingReviewCount > 1 ? 's are' : ' is'} awaiting teacher review.`
      : `You scored ${score.earnedMarks}/${score.maxMarks} (${score.percent}%).`;
    examResult.appendChild(result);
    activeExam = null;
    activeAttemptId = '';
    await loadExamProgress();
  } catch (error) {
    showAlert(error.message, 'error');
    submitButton.disabled = false;
  } finally {
    isSubmittingExam = false;
  }
});

document.getElementById('cancelExam')?.addEventListener('click', () => {
  stopExamTimer();
  activeExam = null;
  activeAttemptId = '';
  examRunner?.classList.add('hidden');
  examList?.classList.remove('hidden');
});

async function loadExamProgress() {
  if (!currentUser) return;
  try {
    const attemptsSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'examAttempts'));
    const attempts = attemptsSnapshot.docs
      .map((attemptDoc) => ({ id: attemptDoc.id, ...attemptDoc.data() }))
      .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    const completed = attempts.filter((attempt) => ['submitted', 'reviewed'].includes(attempt.status));
    const average = completed.length
      ? Math.round(completed.reduce((total, attempt) => total + Number(attempt.percent || 0), 0) / completed.length)
      : null;
    const topics = new Map();
    completed.forEach((attempt) => (attempt.questionResults || []).forEach((result) => {
      if (!result.topic || result.maxMarks <= 0) return;
      const topic = topics.get(result.topic) || { earned: 0, possible: 0 };
      topic.earned += Number(result.earnedMarks || 0);
      topic.possible += Number(result.maxMarks || 0);
      topics.set(result.topic, topic);
    }));
    const topicScores = [...topics.entries()]
      .map(([topic, score]) => ({ topic, percent: Math.round(score.earned / score.possible * 100) }))
      .sort((a, b) => a.percent - b.percent);

    const averageElement = document.getElementById('assessmentAverage');
    const countElement = document.getElementById('assessmentCount');
    const revisionCount = document.getElementById('revisionTopicCount');
    const recommendation = document.getElementById('progressRecommendation');
    if (averageElement) averageElement.textContent = average === null ? '—' : `${average}%`;
    if (countElement) countElement.textContent = String(completed.length);
    if (revisionCount) revisionCount.textContent = topicScores.length
      ? String(topicScores.filter((item) => item.percent < 70).length)
      : '—';

    if (recommendation) {
      if (!completed.length) {
        recommendation.textContent = attempts.some((attempt) => attempt.status === 'needs_review')
          ? 'Your written answers are awaiting teacher review. Completed results will appear here.'
          : 'Complete a mock examination to get a personalised study recommendation.';
      } else if (topicScores.length && topicScores[0].percent < 70) {
        recommendation.textContent = `Focus next on ${topicScores[0].topic} (${topicScores[0].percent}% so far). Review the related lesson, then try another mock.`;
      } else if (average >= 80) {
        recommendation.textContent = `Great progress: your current assessment average is ${average}%. Keep practising with a new mock examination.`;
      } else {
        recommendation.textContent = 'You are building a useful baseline. Complete another mock to identify the topics that need the most practice.';
      }
    }

    const topicProgress = document.getElementById('topicProgress');
    if (topicProgress) {
      topicProgress.replaceChildren();
      if (topicScores.length) {
        const heading = document.createElement('h3');
        heading.textContent = 'Topic performance';
        topicProgress.appendChild(heading);
        topicScores.forEach(({ topic, percent }) => {
          const label = document.createElement('p');
          label.className = 'muted';
          label.textContent = `${topic}: ${percent}%`;
          const bar = document.createElement('div');
          bar.className = 'progress-track';
          bar.setAttribute('role', 'img');
          bar.setAttribute('aria-label', `${topic}: ${percent}%`);
          const fill = document.createElement('span');
          fill.style.width = `${percent}%`;
          bar.appendChild(fill);
          topicProgress.append(label, bar);
        });
      }
    }

    const history = document.getElementById('assessmentHistory');
    if (!history) return;
    history.replaceChildren();
    const visibleAttempts = attempts.filter((attempt) => ['submitted', 'reviewed', 'needs_review'].includes(attempt.status)).slice(0, 10);
    if (!visibleAttempts.length) return;
    const heading = document.createElement('h3');
    heading.textContent = 'Recent mock results';
    history.appendChild(heading);
    visibleAttempts.forEach((attempt) => {
      const item = document.createElement('p');
      item.className = 'lesson-item';
      item.textContent = attempt.status === 'needs_review'
        ? `${attempt.examTitle || 'Mock examination'} — written answers awaiting review`
        : `${attempt.examTitle || 'Mock examination'} — ${attempt.earnedMarks}/${attempt.maxMarks} (${attempt.percent}%)`;
      history.appendChild(item);
    });
  } catch (error) {
    console.error('Assessment progress error:', error);
    showAlert('Could not load your examination results and recommendations.', 'error');
  }
}

// Auth listener
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  showLoading();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  if (!lessonsList || !papersList || !announcementsList) {
    showAlert('Dashboard failed to load (missing UI elements).', 'error');
    return;
  }

  let tokenResult;
  try {
    tokenResult = await getIdTokenResult(user);
  } catch (error) {
    hideLoading();
    showAlert('Unable to verify your account. Check your connection and try again.', 'error');
    console.error('Account verification error:', error);
    return;
  }

  if (tokenResult.claims.admin === true) {
    window.location.href = 'admin.html';
    return;
  }


  // POPIA: if the stored consent checkbox is missing/unset, we do not block access,
  // but the Privacy Policy and POPIA pages provide accountability and rights.


  // Get user doc
  const userDocRef = doc(db, 'users', user.uid);
  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (error) {
    hideLoading();
    showAlert('Unable to load your account details. Check your connection and try again.', 'error');
    console.error('Account profile error:', error);
    return;
  }
  const userData = userSnap.exists() ? userSnap.data() : {};
  const storedPlan = String(userData.plan || 'trial').toLowerCase();
  currentGrade = String(userData.grade || '');

  if (!['10', '11', '12'].includes(currentGrade)) {
    hideLoading();
    showAlert('Your grade is missing from your account. Contact learning support to update it.', 'error');
    return;
  }

  const paidAccessUntil = userData.paidAccessUntil?.toDate?.();
  const isPaidPlan = ['gold', 'premium', 'platinum', 'platinum_star'].includes(storedPlan);
  const hasPaidAccess = isPaidPlan
    && userData.isPaid === true
    && paidAccessUntil instanceof Date
    && paidAccessUntil.getTime() > Date.now();
  contentPlan = hasPaidAccess ? storedPlan : 'trial';
  userPlan = hasPaidAccess ? storedPlan : 'bronze';
  const planLabel = PLAN_LABELS[userPlan] || 'Bronze';

  userInfo.textContent = `Hi, ${userData.name || user.displayName || user.email || 'student'}`;
  planBadge.textContent = `Current plan: ${planLabel}`;
  document.getElementById('studentGradeStat').textContent = `Grade ${currentGrade}`;
  document.getElementById('learningCentreIntro').textContent =
    `Browse published lessons and practice papers for Grade ${currentGrade}. Your ${planLabel} plan controls which resources are available.`;
  document.getElementById('subjectGradeIntro').textContent =
    `Learning resources for Grade ${currentGrade} are listed below.`;

  const accountSummary = document.getElementById('accountSummary');
  if (accountSummary) {
    if (hasPaidAccess) {
      const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(paidAccessUntil);
      accountSummary.textContent = `${planLabel} access is active through ${dateLabel}.`;
    } else if (['gold', 'premium', 'platinum', 'platinum_star'].includes(storedPlan)) {
      accountSummary.textContent = `Your ${PLAN_LABELS[storedPlan]} access is not currently active. Available content remains on Bronze until paid access is confirmed.`;
    } else {
      accountSummary.textContent = 'You are using Bronze access. View the learning plans to compare the published resources included with each plan.';
    }
  }

  hideLoading();
  const [lessonCount, paperCount, announcementCount] = await Promise.all([
    loadLessons(),
    loadPapers(),
    loadAnnouncements(),
    loadExams(),
    loadExamProgress()
  ]);
  updateResourceCounts(lessonCount, paperCount, announcementCount);
});
