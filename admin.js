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
  serverTimestamp,
  writeBatch,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';
import { examApi } from './exam-api.js';

const adminLogin = document.getElementById('adminLogin');
const adminLoginForm = document.getElementById('adminLoginForm');
const loginError = document.getElementById('loginError');

const adminSection = document.getElementById('adminSection');
const authSection = document.getElementById('adminAuthSection');
const logoutBtn = document.getElementById('logoutBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminInfo = document.getElementById('adminInfo');

const lessonForm = document.getElementById('lessonForm');
const paperForm = document.getElementById('paperForm');
const uploadForm = document.getElementById('uploadForm');
const announceForm = document.getElementById('announceForm');
const examForm = document.getElementById('examForm');
const examQuestions = document.getElementById('examQuestions');
const reviewExamSelect = document.getElementById('reviewExamSelect');
const examReviews = document.getElementById('examReviews');

// FIXED: showAlert imported from utils.js - local duplicate removed


function showLoginError(message) {
  if (!loginError) {
    showAlert(message, 'error');
    return;
  }
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

adminLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loginError) {
    loginError.textContent = '';
    loginError.classList.add('hidden');
  }

  const email = document.getElementById('adminEmail')?.value?.trim() || '';
  const password = document.getElementById('adminPassword')?.value || '';
  if (!email || !password) {
    showLoginError('Enter your administrator email and password.');
    return;
  }

  if (adminLogin) adminLogin.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showLoginError(err?.message || 'Admin login failed. Please try again.');
  } finally {
    if (adminLogin) adminLogin.disabled = false;
  }
});

async function handleAdminLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Admin logout failed:', error);
    showAlert('Could not sign out. Please try again.', 'error');
  }
}

logoutBtn?.addEventListener('click', handleAdminLogout);
adminLogoutBtn?.addEventListener('click', handleAdminLogout);

function addQuestionField(container, labelText, control) {
  const group = document.createElement('div');
  group.className = 'form-group';
  const label = document.createElement('label');
  label.htmlFor = control.id;
  label.textContent = labelText;
  group.append(label, control);
  container.appendChild(group);
  return group;
}

function createQuestionEditor() {
  if (!examQuestions) return;
  if (examQuestions.children.length >= 50) {
    showAlert('An examination can contain up to 50 questions.', 'error');
    return;
  }

  const questionId = `q_${crypto.randomUUID().replace(/-/g, '')}`;
  const editor = document.createElement('article');
  editor.className = 'feature-card exam-question-editor';
  editor.dataset.questionId = questionId;
  const heading = document.createElement('h4');
  heading.textContent = `Question ${examQuestions.children.length + 1}`;
  editor.appendChild(heading);

  const prompt = document.createElement('textarea');
  prompt.id = `${questionId}_prompt`;
  prompt.rows = 3;
  prompt.maxLength = 4000;
  prompt.required = true;
  addQuestionField(editor, 'Question', prompt);

  const topic = document.createElement('input');
  topic.id = `${questionId}_topic`;
  topic.type = 'text';
  topic.maxLength = 100;
  topic.required = true;
  addQuestionField(editor, 'Topic (used for progress feedback)', topic);

  const marks = document.createElement('input');
  marks.id = `${questionId}_marks`;
  marks.type = 'number';
  marks.min = '0.5';
  marks.max = '100';
  marks.step = '0.5';
  marks.value = '1';
  marks.required = true;
  addQuestionField(editor, 'Marks', marks);

  const type = document.createElement('select');
  type.id = `${questionId}_type`;
  [
    ['choice', 'Multiple choice'],
    ['numeric', 'Numeric answer'],
    ['written', 'Written response (teacher marked)']
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    type.appendChild(option);
  });
  addQuestionField(editor, 'Question type', type);

  const choiceFields = document.createElement('div');
  const optionInputs = [];
  ['A', 'B', 'C', 'D'].forEach((letter) => {
    const input = document.createElement('input');
    input.id = `${questionId}_option_${letter}`;
    input.type = 'text';
    input.maxLength = 300;
    input.required = true;
    optionInputs.push(input);
    addQuestionField(choiceFields, `Option ${letter}`, input);
  });
  const correctChoice = document.createElement('select');
  correctChoice.id = `${questionId}_correct_choice`;
  ['A', 'B', 'C', 'D'].forEach((letter) => {
    const option = document.createElement('option');
    option.value = letter;
    option.textContent = letter;
    correctChoice.appendChild(option);
  });
  addQuestionField(choiceFields, 'Correct option', correctChoice);
  editor.appendChild(choiceFields);

  const numericFields = document.createElement('div');
  const acceptedAnswers = document.createElement('textarea');
  acceptedAnswers.id = `${questionId}_accepted_answers`;
  acceptedAnswers.rows = 3;
  acceptedAnswers.placeholder = 'Enter one accepted numeric answer per line';
  acceptedAnswers.required = true;
  addQuestionField(numericFields, 'Accepted answer(s)', acceptedAnswers);
  const tolerance = document.createElement('input');
  tolerance.id = `${questionId}_tolerance`;
  tolerance.type = 'number';
  tolerance.min = '0';
  tolerance.step = 'any';
  tolerance.value = '0';
  tolerance.required = true;
  addQuestionField(numericFields, 'Allowed tolerance', tolerance);
  editor.appendChild(numericFields);

  const writtenFields = document.createElement('div');
  const rubric = document.createElement('textarea');
  rubric.id = `${questionId}_rubric`;
  rubric.rows = 3;
  rubric.maxLength = 2000;
  rubric.required = true;
  addQuestionField(writtenFields, 'Marking rubric for the teacher', rubric);
  editor.appendChild(writtenFields);

  const updateTypeFields = () => {
    choiceFields.hidden = type.value !== 'choice';
    numericFields.hidden = type.value !== 'numeric';
    writtenFields.hidden = type.value !== 'written';
    [...optionInputs, correctChoice].forEach((field) => { field.required = type.value === 'choice'; });
    [acceptedAnswers, tolerance].forEach((field) => { field.required = type.value === 'numeric'; });
    rubric.required = type.value === 'written';
  };
  type.addEventListener('change', updateTypeFields);
  updateTypeFields();

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-secondary';
  remove.textContent = 'Remove question';
  remove.addEventListener('click', () => {
    editor.remove();
    [...examQuestions.children].forEach((item, index) => {
      const itemHeading = item.querySelector('h4');
      if (itemHeading) itemHeading.textContent = `Question ${index + 1}`;
    });
  });
  editor.appendChild(remove);
  examQuestions.appendChild(editor);
}

document.getElementById('addExamQuestion')?.addEventListener('click', createQuestionEditor);
createQuestionEditor();

function readExamQuestions() {
  const publicQuestions = [];
  const answerQuestions = [];

  [...(examQuestions?.children || [])].forEach((editor) => {
    const questionId = editor.dataset.questionId;
    const type = editor.querySelector(`#${questionId}_type`).value;
    const question = {
      id: questionId,
      prompt: editor.querySelector(`#${questionId}_prompt`).value.trim(),
      topic: editor.querySelector(`#${questionId}_topic`).value.trim(),
      type,
      marks: Number(editor.querySelector(`#${questionId}_marks`).value)
    };
    const answerKey = { id: questionId };

    if (type === 'choice') {
      question.choices = ['A', 'B', 'C', 'D'].map((letter, index) => ({
        id: letter,
        text: editor.querySelector(`#${questionId}_option_${letter}`).value.trim(),
        index
      })).map(({ id, text }) => ({ id, text }));
      answerKey.answer = editor.querySelector(`#${questionId}_correct_choice`).value;
    } else if (type === 'numeric') {
      const entries = editor.querySelector(`#${questionId}_accepted_answers`).value
        .split(/\r?\n/)
        .map((value) => value.trim().replace(',', '.'))
        .filter(Boolean);
      if (!entries.length || entries.some((value) => !Number.isFinite(Number(value)))) {
        throw new Error('Enter at least one valid numeric answer for every numeric question.');
      }
      answerKey.acceptedAnswers = entries.map(Number);
      answerKey.tolerance = Number(editor.querySelector(`#${questionId}_tolerance`).value);
    } else {
      answerKey.rubric = editor.querySelector(`#${questionId}_rubric`).value.trim();
    }

    publicQuestions.push(question);
    answerQuestions.push(answerKey);
  });

  return { publicQuestions, answerQuestions };
}

async function loadExamReviewOptions() {
  if (!reviewExamSelect) return;
  try {
    const snapshot = await getDocs(collection(db, 'exams'));
    const exams = snapshot.docs
      .map((examDoc) => ({ id: examDoc.id, ...examDoc.data() }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
    reviewExamSelect.replaceChildren(new Option('Select an examination', ''));
    exams.forEach((exam) => {
      reviewExamSelect.add(new Option(`${exam.title}${exam.published ? '' : ' (draft)'}`, exam.id));
    });
  } catch (error) {
    console.error('Exam review options load failed:', error);
    showAlert('Could not load examinations for response review.', 'error');
  }
}

document.getElementById('loadExamReviews')?.addEventListener('click', async () => {
  const examId = reviewExamSelect?.value;
  if (!examId || !examReviews) {
    showAlert('Select an examination first.', 'error');
    return;
  }

  examReviews.replaceChildren();
  try {
    const { attempts } = await examApi(`/admin/${encodeURIComponent(examId)}/reviews`);
    if (!attempts.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'There are no written responses waiting for review.';
      examReviews.appendChild(empty);
      return;
    }

    attempts.forEach((attempt) => {
      const card = document.createElement('article');
      card.className = 'feature-card';
      const title = document.createElement('h4');
      title.textContent = `Student ${attempt.userId} — attempt ${attempt.attemptId}`;
      card.appendChild(title);
      const marks = {};

      attempt.answers.forEach((answer) => {
        const response = document.createElement('div');
        response.className = 'lesson-item';
        const prompt = document.createElement('h5');
        prompt.textContent = `${answer.topic}: ${answer.prompt}`;
        const text = document.createElement('p');
        text.textContent = answer.answer;
        const rubric = document.createElement('p');
        rubric.className = 'muted';
        rubric.textContent = `Rubric: ${answer.rubric} (maximum ${answer.maxMarks})`;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = String(answer.maxMarks);
        input.step = '0.5';
        input.value = '0';
        input.required = true;
        marks[answer.questionId] = input;
        response.append(prompt, text, rubric);
        addQuestionField(response, `Awarded marks (out of ${answer.maxMarks})`, input);
        card.appendChild(response);
      });

      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'btn btn-primary';
      submit.textContent = 'Save marks';
      submit.addEventListener('click', async () => {
        const invalidInput = Object.values(marks).find((input) =>
          !input.value.trim() || !input.checkValidity()
        );
        if (invalidInput) {
          invalidInput.reportValidity();
          return;
        }
        const submittedMarks = Object.fromEntries(
          Object.entries(marks).map(([questionId, input]) => [questionId, Number(input.value)])
        );
        submit.disabled = true;
        try {
          await examApi(
            `/admin/${encodeURIComponent(examId)}/reviews/${encodeURIComponent(attempt.userId)}/${encodeURIComponent(attempt.attemptId)}`,
            { method: 'POST', body: JSON.stringify({ marks: submittedMarks }) }
          );
          card.remove();
          showAlert('Written responses marked and student progress updated.', 'success');
        } catch (error) {
          showAlert(error.message, 'error');
          submit.disabled = false;
        }
      });
      card.appendChild(submit);
      examReviews.appendChild(card);
    });
  } catch (error) {
    console.error('Exam review load failed:', error);
    showAlert(error.message, 'error');
  }
});

examForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdminUser) {
    showAlert('Admin access required.', 'error');
    return;
  }

  try {
    const { publicQuestions, answerQuestions } = readExamQuestions();
    if (!publicQuestions.length) throw new Error('Add at least one question before saving.');
    const access = document.getElementById('examAccess').value;
    const examRef = doc(collection(db, 'exams'));
    const batch = writeBatch(db);
    batch.set(examRef, {
      title: document.getElementById('examTitle').value.trim(),
      description: document.getElementById('examDescription').value.trim(),
      grade: document.getElementById('examGrade').value,
      durationMinutes: Number(document.getElementById('examDuration').value),
      isFree: access === 'free',
      plan: access === 'free' ? null : access,
      published: document.getElementById('examPublished').value === 'true',
      questions: publicQuestions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(doc(db, 'examAnswerKeys', examRef.id), {
      questions: answerQuestions,
      updatedAt: serverTimestamp()
    });
    await batch.commit();

    showAlert('Examination saved. Student results will be marked on the server.', 'success');
    examForm.reset();
    examQuestions.replaceChildren();
    createQuestionEditor();
    await loadExamReviewOptions();
  } catch (error) {
    console.error('Exam save failed:', error);
    showAlert(error.message || 'Could not save this examination.', 'error');
  }
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
  if (adminLogoutBtn) adminLogoutBtn.classList.toggle('hidden', !isAdmin);
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
    return;
  }

  try {
    // IMPORTANT: Custom claims live in the ID token.
    // Force-refresh token so newly set claims propagate.
    const tokenResult = await user.getIdTokenResult(true);
    if (auth.currentUser?.uid !== user.uid) return;

    if (tokenResult?.claims?.admin === true) {
      isAdminUser = true;
      setAdminUI(true);
      await loadExamReviewOptions();
      if (loginError) {
        loginError.textContent = '';
        loginError.classList.add('hidden');
      }
    } else {
      isAdminUser = false;
      await signOut(auth);
      setAdminUI(false);
      showLoginError(
        'This account does not have the Firebase Auth admin custom claim. ' +
        'A users/{uid}.admin Firestore field alone does not grant admin access. ' +
        'Have an administrator set the custom claim, then sign out and sign in again.'
      );
    }
  } catch (err) {
    if (auth.currentUser?.uid !== user.uid) return;
    console.error('Error checking admin claim:', err);
    isAdminUser = false;
    setAdminUI(false);
    showLoginError('We could not verify administrator access. Check your connection and try again.');
  }
});


// Hard block: stop admin-only submits until claim check has passed.
// (Firestore rules remain the real security gate.)
[lessonForm, paperForm, announceForm, uploadForm, examForm]
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
