function parseNumericAnswer(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized || normalized.length > 100) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function markAttempt(exam, answerKey, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new TypeError('Answers must be an object.');
  }

  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  const questionIds = new Set(questions.map((question) => question.id));
  if (Object.keys(answers).some((questionId) => !questionIds.has(questionId))) {
    throw new TypeError('Answers contain an unknown question.');
  }

  const keys = new Map((answerKey.questions || []).map((question) => [question.id, question]));
  const results = questions.map((question) => {
    const rawAnswer = answers[question.id];
    if (rawAnswer !== undefined && (typeof rawAnswer !== 'string' || rawAnswer.length > 5000)) {
      throw new TypeError('Each answer must be text no longer than 5000 characters.');
    }

    const answer = typeof rawAnswer === 'string' ? rawAnswer.trim() : '';
    const maxMarks = Number(question.marks);
    const key = keys.get(question.id);
    if (!key || !Number.isFinite(maxMarks) || maxMarks < 0) {
      throw new TypeError('The examination answer key is incomplete.');
    }

    if (question.type === 'written') {
      return {
        questionId: question.id,
        topic: question.topic || '',
        answer,
        earnedMarks: 0,
        maxMarks,
        status: answer ? 'needs_review' : 'marked'
      };
    }

    let isCorrect = false;
    if (question.type === 'choice') {
      isCorrect = answer !== '' && answer === String(key.answer);
    } else if (question.type === 'numeric') {
      const submittedNumber = parseNumericAnswer(answer);
      const tolerance = Number(key.tolerance || 0);
      const acceptedAnswers = Array.isArray(key.acceptedAnswers) ? key.acceptedAnswers : [];
      if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1000000 || !acceptedAnswers.length) {
        throw new TypeError('The examination contains an invalid numeric marking key.');
      }
      isCorrect = submittedNumber !== null && acceptedAnswers.some((expected) => {
        const expectedNumber = parseNumericAnswer(expected);
        return expectedNumber !== null && Math.abs(submittedNumber - expectedNumber) <= tolerance;
      });
    } else {
      throw new TypeError('The examination contains an unsupported question type.');
    }

    return {
      questionId: question.id,
      topic: question.topic || '',
      answer,
      earnedMarks: isCorrect ? maxMarks : 0,
      maxMarks,
      status: 'marked'
    };
  });

  const earnedMarks = results.reduce((total, result) => total + result.earnedMarks, 0);
  const maxMarks = results.reduce((total, result) => total + result.maxMarks, 0);
  const pendingResults = results.filter((result) => result.status === 'needs_review');
  const pendingReviewCount = pendingResults.length;
  const objectiveMaxMarks = results
    .filter((result) => result.status !== 'needs_review')
    .reduce((total, result) => total + result.maxMarks, 0);
  return {
    results,
    earnedMarks,
    maxMarks,
    pendingReviewCount,
    objectiveMaxMarks,
    objectivePercent: objectiveMaxMarks
      ? Math.round((earnedMarks / objectiveMaxMarks) * 100)
      : 0,
    percent: maxMarks ? Math.round((earnedMarks / maxMarks) * 100) : 0
  };
}

module.exports = { markAttempt, parseNumericAnswer };
