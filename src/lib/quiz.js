function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function buildQuiz({
  questions,
  count = 20,
  categoryIds = null,
  ids = null,
  seed,
}) {
  const rng = mulberry32(seed);
  let pool = questions;
  if (ids?.length) {
    const set = new Set(ids);
    pool = questions.filter((q) => set.has(q.id));
  } else if (categoryIds?.length) {
    const set = new Set(categoryIds);
    pool = questions.filter((q) => set.has(q.categoryId));
  }
  const picked = shuffle(pool, rng).slice(0, Math.min(count, pool.length));
  return picked.map((q) => ({
    ...q,
    options: shuffle(q.options, rng),
  }));
}

export function isCorrect(question, selected) {
  const want = new Set(question.correct);
  const got = new Set(selected);
  if (want.size !== got.size) return false;
  for (const x of want) if (!got.has(x)) return false;
  return true;
}

export function scoreQuiz(items) {
  const graded = items.map((item) => {
    const ok = isCorrect(item.question, item.selected);
    return { ...item, ok };
  });
  const correctCount = graded.filter((g) => g.ok).length;
  const percent = graded.length
    ? Math.round((correctCount / graded.length) * 100)
    : 0;
  return { graded, correctCount, percent, passed: percent >= 80 };
}
