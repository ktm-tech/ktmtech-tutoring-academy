const test = require('node:test');
const assert = require('node:assert/strict');
const { markAttempt, parseNumericAnswer } = require('./examScoring');

const exam = {
  questions: [
    { id: 'q1', type: 'choice', topic: 'Percentages', marks: 2 },
    { id: 'q2', type: 'numeric', topic: 'Ratio', marks: 3 },
    { id: 'q3', type: 'written', topic: 'Budgeting', marks: 5 }
  ]
};
const answerKey = {
  questions: [
    { id: 'q1', answer: 'b' },
    { id: 'q2', acceptedAnswers: [12.5], tolerance: 0.01 },
    { id: 'q3', rubric: 'Explain the working.' }
  ]
};

test('marks choice and numeric answers while leaving written work for review', () => {
  const result = markAttempt(exam, answerKey, {
    q1: 'b',
    q2: '12,5',
    q3: 'I compared the two totals.'
  });

  assert.equal(result.earnedMarks, 5);
  assert.equal(result.maxMarks, 10);
  assert.equal(result.percent, 50);
  assert.equal(result.objectiveMaxMarks, 5);
  assert.equal(result.objectivePercent, 100);
  assert.equal(result.pendingReviewCount, 1);
  assert.equal(result.results[2].status, 'needs_review');
});

test('does not award marks for wrong or blank answers', () => {
  const result = markAttempt(exam, answerKey, { q1: 'a', q2: '', q3: '' });
  assert.equal(result.earnedMarks, 0);
  assert.equal(result.pendingReviewCount, 0);
});

test('rejects unknown questions and oversized/non-text answers', () => {
  assert.throws(() => markAttempt(exam, answerKey, { unknown: 'answer' }), /unknown question/);
  assert.throws(() => markAttempt(exam, answerKey, { q1: 2 }), /must be text/);
  assert.throws(() => markAttempt(exam, answerKey, { q1: 'x'.repeat(5001) }), /5000 characters/);
});

test('parses decimal commas but rejects invalid numeric responses', () => {
  assert.equal(parseNumericAnswer(' 12,5 '), 12.5);
  assert.equal(parseNumericAnswer('not a number'), null);
});
