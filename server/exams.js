const crypto = require('crypto');
const express = require('express');
const { markAttempt } = require('./examScoring');

const PLAN_ALIASES = Object.freeze({
  gold: ['gold'],
  platinum: ['gold', 'platinum'],
  platinum_star: ['gold', 'platinum_star'],
  premium: ['gold', 'premium']
});

function timestampDate(value) {
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function isValidPublishedExam(exam) {
  if (
    typeof exam.title !== 'string'
    || !exam.title.trim()
    || !Array.isArray(exam.questions)
    || exam.questions.length < 1
    || exam.questions.length > 50
    || !Number.isInteger(Number(exam.durationMinutes))
    || Number(exam.durationMinutes) < 0
    || Number(exam.durationMinutes) > 240
  ) return false;

  const questionIds = new Set();
  return exam.questions.every((question) => {
    if (
      !question
      || typeof question.id !== 'string'
      || !question.id
      || questionIds.has(question.id)
      || typeof question.prompt !== 'string'
      || !question.prompt.trim()
      || typeof question.topic !== 'string'
      || !['choice', 'numeric', 'written'].includes(question.type)
      || !Number.isFinite(Number(question.marks))
      || Number(question.marks) <= 0
      || Number(question.marks) > 100
    ) return false;
    questionIds.add(question.id);
    if (question.type !== 'choice') return true;
    return Array.isArray(question.choices)
      && question.choices.length >= 2
      && question.choices.every((choice) =>
        typeof choice?.id === 'string'
        && typeof choice.text === 'string'
        && choice.text.trim()
      );
  });
}

function createExamRouter(admin) {
  const router = express.Router();
  const db = admin.firestore();

  router.use(async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'Sign in to continue.' });

    try {
      req.user = await admin.auth().verifyIdToken(match[1]);
      return next();
    } catch (error) {
      console.warn('[Exams] Invalid Firebase ID token:', error.code || error.message);
      return res.status(401).json({ error: 'Your session could not be verified. Sign in again.' });
    }
  });

  async function getAccessibleExam(uid, examId) {
    const [examSnapshot, profileSnapshot] = await Promise.all([
      db.collection('exams').doc(examId).get(),
      db.collection('users').doc(uid).get()
    ]);
    if (!examSnapshot.exists || !profileSnapshot.exists) return null;

    const exam = examSnapshot.data();
    const profile = profileSnapshot.data();
    if (!isValidPublishedExam(exam)) {
      console.error('[Exams] Published examination has invalid content:', examId);
      return null;
    }
    const grade = String(profile.grade || '');
    const plan = String(profile.plan || 'trial').toLowerCase();
    const paidUntil = timestampDate(profile.paidAccessUntil);
    const hasPaidAccess = profile.isPaid === true
      && paidUntil instanceof Date
      && paidUntil.getTime() > Date.now();
    const paidPlans = PLAN_ALIASES[plan] || [];
    const canAccessPlan = hasPaidAccess && (
      paidPlans.includes(String(exam.plan || '')) ||
      (['platinum', 'platinum_star', 'premium'].includes(plan) && exam.plan === 'gold')
    );

    if (
      exam.published !== true
      || String(exam.grade) !== grade
      || !(exam.isFree === true || canAccessPlan)
    ) return null;

    return { exam, profile };
  }

  router.post('/:examId/start', async (req, res) => {
    const { examId } = req.params;
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(examId)) {
      return res.status(400).json({ error: 'Invalid examination.' });
    }

    try {
      const accessible = await getAccessibleExam(req.user.uid, examId);
      if (!accessible) return res.status(404).json({ error: 'This examination is not available to your account.' });

      const now = new Date();
      const attemptId = crypto.randomUUID();
      await db.collection('users').doc(req.user.uid).collection('examAttempts').doc(attemptId).create({
        examId,
        examTitle: accessible.exam.title || 'Mock examination',
        userId: req.user.uid,
        status: 'in_progress',
        startedAt: admin.firestore.Timestamp.fromDate(now),
        durationMinutes: Number(accessible.exam.durationMinutes) || 0
      });

      return res.status(201).json({
        attemptId,
        startedAt: now.toISOString(),
        durationMinutes: Number(accessible.exam.durationMinutes) || 0
      });
    } catch (error) {
      console.error('[Exams] Could not start examination:', error);
      return res.status(500).json({ error: 'Could not start this examination. Please try again.' });
    }
  });

  router.post('/:examId/submit', async (req, res) => {
    const { examId } = req.params;
    const { attemptId, answers } = req.body || {};
    if (
      !/^[A-Za-z0-9_-]{1,120}$/.test(examId)
      || typeof attemptId !== 'string'
      || !/^[A-Za-z0-9_-]{1,120}$/.test(attemptId)
    ) return res.status(400).json({ error: 'Invalid examination submission.' });

    try {
      const accessible = await getAccessibleExam(req.user.uid, examId);
      if (!accessible) return res.status(404).json({ error: 'This examination is not available to your account.' });

      const keySnapshot = await db.collection('examAnswerKeys').doc(examId).get();
      if (!keySnapshot.exists) {
        console.error('[Exams] Answer key missing for published exam:', examId);
        return res.status(500).json({ error: 'This examination is not ready to be marked.' });
      }

      const score = markAttempt(accessible.exam, keySnapshot.data(), answers);
      const attemptRef = db.collection('users').doc(req.user.uid)
        .collection('examAttempts').doc(attemptId);
      let expired = false;
      let alreadySubmitted = false;
      await db.runTransaction(async (transaction) => {
        const attemptSnapshot = await transaction.get(attemptRef);
        if (!attemptSnapshot.exists || attemptSnapshot.data().examId !== examId) {
          throw Object.assign(new Error('Examination attempt not found.'), { status: 404 });
        }
        const attempt = attemptSnapshot.data();
        if (attempt.status !== 'in_progress') {
          alreadySubmitted = true;
          return;
        }

        const durationMinutes = Number(attempt.durationMinutes) || 0;
        const startedAt = timestampDate(attempt.startedAt);
        if (durationMinutes && startedAt && Date.now() > startedAt.getTime() + durationMinutes * 60000 + 120000) {
          expired = true;
          transaction.update(attemptRef, {
            status: 'expired',
            submittedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return;
        }

        transaction.update(attemptRef, {
          status: score.pendingReviewCount ? 'needs_review' : 'submitted',
          answers,
          questionResults: score.results,
          earnedMarks: score.earnedMarks,
          maxMarks: score.maxMarks,
          percent: score.percent,
          pendingReviewCount: score.pendingReviewCount,
          submittedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      if (expired) return res.status(409).json({ error: 'The time limit has passed. This attempt was closed.' });
      if (alreadySubmitted) return res.status(409).json({ error: 'This examination attempt has already been submitted.' });
      return res.json({
        earnedMarks: score.earnedMarks,
        maxMarks: score.maxMarks,
        percent: score.percent,
        objectiveMaxMarks: score.objectiveMaxMarks,
        objectivePercent: score.objectivePercent,
        pendingReviewCount: score.pendingReviewCount
      });
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      if (error.status === 404) return res.status(404).json({ error: error.message });
      console.error('[Exams] Could not submit examination:', error);
      return res.status(500).json({ error: 'Could not submit this examination. Please try again.' });
    }
  });

  router.get('/admin/:examId/reviews', async (req, res) => {
    if (req.user.admin !== true) return res.status(403).json({ error: 'Administrator access required.' });
    const { examId } = req.params;
    try {
      const [examSnapshot, keySnapshot, pending] = await Promise.all([
        db.collection('exams').doc(examId).get(),
        db.collection('examAnswerKeys').doc(examId).get(),
        db.collectionGroup('examAttempts')
          .where('examId', '==', examId)
          .where('status', '==', 'needs_review')
          .get()
      ]);
      if (!examSnapshot.exists || !keySnapshot.exists) return res.status(404).json({ error: 'Examination or marking guide not found.' });
      const questions = new Map((examSnapshot.data().questions || []).map((question) => [question.id, question]));
      const rubrics = new Map((keySnapshot.data().questions || []).map((question) => [question.id, question.rubric || '']));
      const attempts = pending.docs.map((snapshot) => {
        const data = snapshot.data();
        return {
          attemptId: snapshot.id,
          userId: data.userId,
          startedAt: timestampDate(data.startedAt)?.toISOString() || null,
          earnedMarks: data.earnedMarks,
          maxMarks: data.maxMarks,
          answers: (data.questionResults || [])
            .filter((result) => result.status === 'needs_review')
            .map((result) => ({
              questionId: result.questionId,
              topic: result.topic,
              prompt: questions.get(result.questionId)?.prompt || '',
              rubric: rubrics.get(result.questionId) || '',
              answer: result.answer,
              maxMarks: result.maxMarks
            }))
        };
      });
      return res.json({ attempts });
    } catch (error) {
      console.error('[Exams] Could not load written responses for review:', error);
      return res.status(500).json({ error: 'Could not load written responses.' });
    }
  });

  router.post('/admin/:examId/reviews/:uid/:attemptId', async (req, res) => {
    if (req.user.admin !== true) return res.status(403).json({ error: 'Administrator access required.' });
    const { examId, uid, attemptId } = req.params;
    const marks = req.body?.marks;
    if (!marks || typeof marks !== 'object' || Array.isArray(marks)) {
      return res.status(400).json({ error: 'Marks must be provided for each written response.' });
    }

    try {
      const [examSnapshot, keySnapshot] = await Promise.all([
        db.collection('exams').doc(examId).get(),
        db.collection('examAnswerKeys').doc(examId).get()
      ]);
      if (!examSnapshot.exists || !keySnapshot.exists) {
        return res.status(404).json({ error: 'Examination or marking guide not found.' });
      }

      const questions = new Map((examSnapshot.data().questions || []).map((question) => [question.id, question]));
      const attemptRef = db.collection('users').doc(uid).collection('examAttempts').doc(attemptId);
      let finalScore;
      await db.runTransaction(async (transaction) => {
        const attemptSnapshot = await transaction.get(attemptRef);
        if (!attemptSnapshot.exists || attemptSnapshot.data().examId !== examId) {
          throw Object.assign(new Error('Examination attempt not found.'), { status: 404 });
        }
        const attempt = attemptSnapshot.data();
        if (attempt.status !== 'needs_review') {
          throw Object.assign(new Error('This attempt is not awaiting review.'), { status: 409 });
        }

        const pendingQuestionIds = attempt.questionResults
          .filter((result) => result.status === 'needs_review')
          .map((result) => result.questionId);
        if (
          Object.keys(marks).length !== pendingQuestionIds.length
          || Object.keys(marks).some((questionId) => !pendingQuestionIds.includes(questionId))
        ) {
          throw new TypeError('Provide a mark for every written response and no other questions.');
        }

        const results = attempt.questionResults.map((result) => {
          if (result.status !== 'needs_review') return result;
          const question = questions.get(result.questionId);
          const awarded = marks[result.questionId];
          if (!question || typeof awarded !== 'number' || !Number.isFinite(awarded) || awarded < 0 || awarded > result.maxMarks) {
            throw new TypeError('Each written response needs a mark between zero and its maximum.');
          }
          return { ...result, earnedMarks: awarded, status: 'reviewed' };
        });
        const earnedMarks = results.reduce((total, result) => total + result.earnedMarks, 0);
        const maxMarks = results.reduce((total, result) => total + result.maxMarks, 0);
        finalScore = {
          earnedMarks,
          maxMarks,
          percent: maxMarks ? Math.round((earnedMarks / maxMarks) * 100) : 0
        };
        transaction.update(attemptRef, {
          status: 'reviewed',
          questionResults: results,
          earnedMarks,
          maxMarks,
          percent: finalScore.percent,
          pendingReviewCount: 0,
          reviewedBy: req.user.uid,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      return res.json(finalScore);
    } catch (error) {
      if (error instanceof TypeError || error.status === 404 || error.status === 409) {
        return res.status(error.status || 400).json({ error: error.message });
      }
      console.error('[Exams] Could not save written-response marks:', error);
      return res.status(500).json({ error: 'Could not save these marks.' });
    }
  });

  return router;
}

module.exports = { createExamRouter };
