const KEY = "sachkunde-progress-v1";

const empty = () => ({
  seen: {},
  correct: {},
  wrong: {},
  streak: 0,
  bestStreak: 0,
  quizzes: 0,
  lastQuizAt: null,
});

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function recordAnswer(progress, questionId, isCorrect) {
  const next = {
    ...progress,
    seen: { ...progress.seen },
    correct: { ...progress.correct },
    wrong: { ...progress.wrong },
  };
  next.seen[questionId] = (next.seen[questionId] || 0) + 1;
  if (isCorrect) {
    next.correct[questionId] = (next.correct[questionId] || 0) + 1;
    next.streak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
  } else {
    next.wrong[questionId] = (next.wrong[questionId] || 0) + 1;
    next.streak = 0;
  }
  return next;
}

export function recordQuiz(progress) {
  return {
    ...progress,
    quizzes: progress.quizzes + 1,
    lastQuizAt: new Date().toISOString(),
  };
}

export function accuracyFor(progress, questionId) {
  const seen = progress.seen[questionId] || 0;
  if (!seen) return null;
  return (progress.correct[questionId] || 0) / seen;
}

export function weakQuestionIds(progress, questions, limit = 20) {
  const ranked = questions
    .map((q) => {
      const seen = progress.seen[q.id] || 0;
      const wrong = progress.wrong[q.id] || 0;
      const acc = seen ? (progress.correct[q.id] || 0) / seen : 0;
      const score = seen === 0 ? 0.4 : (1 - acc) * 2 + wrong * 0.2;
      return { id: q.id, score, seen };
    })
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => r.id);
}
