import { useMemo, useState } from "react";
import catalog from "./data/questions.json";
import {
  accuracyFor,
  loadProgress,
  recordAnswer,
  recordQuiz,
  saveProgress,
  weakQuestionIds,
} from "./lib/storage";
import { buildQuiz, isCorrect, newSeed, scoreQuiz } from "./lib/quiz";

const COUNTS = [10, 20, 30, 40];

export default function App() {
  const [view, setView] = useState("home");
  const [progress, setProgress] = useState(loadProgress);
  const [setup, setSetup] = useState({
    count: 20,
    categoryIds: [],
    mode: "practice",
    weak: false,
  });
  const [quiz, setQuiz] = useState(null);

  const mastered = catalog.questions.filter((q) => {
    const acc = accuracyFor(progress, q.id);
    return acc !== null && acc >= 0.8 && (progress.seen[q.id] || 0) >= 2;
  }).length;
  const seenCount = Object.keys(progress.seen).length;

  function persist(next) {
    setProgress(next);
    saveProgress(next);
  }

  function startQuiz(overrides = {}) {
    const cfg = { ...setup, ...overrides };
    const seed = newSeed();
    const pool = cfg.categoryIds.length
      ? catalog.questions.filter((q) => cfg.categoryIds.includes(q.categoryId))
      : catalog.questions;
    const ids = cfg.weak ? weakQuestionIds(progress, pool, cfg.count) : null;
    const items = buildQuiz({
      questions: catalog.questions,
      count: cfg.count,
      categoryIds: ids ? null : cfg.categoryIds.length ? cfg.categoryIds : null,
      ids,
      seed,
    });
    setQuiz({
      items,
      index: 0,
      selected: [],
      revealed: false,
      answers: [],
      mode: cfg.mode,
      seed,
    });
    setView("quiz");
  }

  function startCategory(categoryId, mode = "practice") {
    const questions = catalog.questions.filter((q) => q.categoryId === categoryId);
    setSetup((s) => ({ ...s, categoryIds: [categoryId], count: questions.length, mode, weak: false }));
    const seed = newSeed();
    setQuiz({
      items: buildQuiz({ questions: catalog.questions, count: questions.length, categoryIds: [categoryId], seed }),
      index: 0,
      selected: [],
      revealed: false,
      answers: [],
      mode,
      seed,
    });
    setView("quiz");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")}>
          <small>Katalog ab 01.01.2025</small>
          <strong>Sachkunde Trainer</strong>
        </button>
        <nav className="nav">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>
            Start
          </button>
          <button className={view === "compose" ? "active" : ""} onClick={() => setView("compose")}>
            Quiz erzeugen
          </button>
          <button className={view === "learn" ? "active" : ""} onClick={() => setView("learn")}>
            Lernen
          </button>
        </nav>
      </header>

      {view === "home" && (
        <Home
          progress={progress}
          seenCount={seenCount}
          mastered={mastered}
          onCompose={() => setView("compose")}
          onPractice={() => startQuiz({ mode: "practice", count: 20, categoryIds: [], weak: false })}
          onExam={() => startQuiz({ mode: "exam", count: 30, categoryIds: [], weak: false })}
          onWeak={() => startQuiz({ mode: "practice", count: 15, weak: true, categoryIds: [] })}
          onLearn={() => setView("learn")}
          onCategory={(id) => startCategory(id)}
          progressData={progress}
        />
      )}
      {view === "compose" && (
        <Composer
          setup={setup}
          setSetup={setSetup}
          onStart={() => startQuiz()}
        />
      )}
      {view === "learn" && <Learn progress={progress} />}
      {view === "quiz" && quiz && (
        <QuizView
          quiz={quiz}
          setQuiz={setQuiz}
          progress={progress}
          persist={persist}
          onExit={() => setView("home")}
          onDone={(resultQuiz) => {
            persist(recordQuiz(loadProgress()));
            setQuiz(resultQuiz);
            setView("results");
          }}
        />
      )}
      {view === "results" && quiz && (
        <Results
          quiz={quiz}
          onHome={() => setView("home")}
          onRetryWrong={() => {
            const wrong = quiz.answers.filter((a) => !a.ok).map((a) => a.question.id);
            if (!wrong.length) return;
            const seed = newSeed();
            setQuiz({
              items: buildQuiz({ questions: catalog.questions, ids: wrong, count: wrong.length, seed }),
              index: 0,
              selected: [],
              revealed: false,
              answers: [],
              mode: "practice",
              seed,
            });
            setView("quiz");
          }}
          onNew={() => startQuiz()}
        />
      )}
    </div>
  );
}

function Home({
  progress,
  seenCount,
  mastered,
  onCompose,
  onPractice,
  onExam,
  onWeak,
  onLearn,
  onCategory,
  progressData,
}) {
  return (
    <>
      <section className="hero">
        <div className="panel">
          <small className="meta">197 Originalfragen · Mehrfachantworten</small>
          <h1>Neue Quizzes aus dem echten Fragenkatalog.</h1>
          <p className="lede">
            Übe den Hundeführerschein mit dem Sachkundefragen-Katalog ab 2025.
            Jede Runde mischt Fragen und Antworten neu. Richtig ist nur, wenn
            alle zutreffenden Optionen gewählt sind.
          </p>
          <div className="stats">
            <div className="stat">
              <b>{seenCount}</b>
              <span>Fragen gesehen</span>
            </div>
            <div className="stat">
              <b>{mastered}</b>
              <span>sicher beherrscht</span>
            </div>
            <div className="stat">
              <b>{progress.streak}</b>
              <span>Serie richtig</span>
            </div>
          </div>
        </div>
        <div className="modes">
          <button className="mode" onClick={onPractice}>
            <b>Schnelle Runde</b>
            <span>20 zufällige Fragen mit direkter Auswertung</span>
          </button>
          <button className="mode" onClick={onExam}>
            <b>Prüfungssimulation</b>
            <span>30 Fragen, Ergebnis erst am Ende, Bestehen ab 80%</span>
          </button>
          <button className="mode" onClick={onWeak}>
            <b>Schwachstellen</b>
            <span>Fokus auf Fehler und noch unbekannte Fragen</span>
          </button>
          <button className="mode" onClick={onCompose}>
            <b>Eigenes Quiz</b>
            <span>Themen, Länge und Modus selbst wählen</span>
          </button>
          <button className="mode" onClick={onLearn}>
            <b>Katalog durchgehen</b>
            <span>Alle Fragen nach Thema mit Lösung</span>
          </button>
        </div>
      </section>

      <div className="section-title">
        <h2>Nach Thema üben</h2>
      </div>
      <div className="grid">
        {catalog.categories.map((cat) => {
          const qs = catalog.questions.filter((q) => q.categoryId === cat.id);
          const known = qs.filter((q) => (progressData.seen[q.id] || 0) > 0).length;
          const pct = Math.round((known / qs.length) * 100);
          return (
            <button key={cat.id} className="cat" onClick={() => onCategory(cat.id)}>
              <b>{cat.name}</b>
              <em>
                {cat.count} Fragen · {pct}% angerissen
              </em>
              <div className="progress-bar">
                <i style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Composer({ setup, setSetup, onStart }) {
  function toggleCat(id) {
    setSetup((s) => {
      const has = s.categoryIds.includes(id);
      return {
        ...s,
        categoryIds: has ? s.categoryIds.filter((x) => x !== id) : [...s.categoryIds, id],
      };
    });
  }
  const pool = setup.categoryIds.length
    ? catalog.questions.filter((q) => setup.categoryIds.includes(q.categoryId)).length
    : catalog.questions.length;

  return (
    <div className="panel composer">
      <h2>Neues Quiz erzeugen</h2>
      <p className="lede">
        Der Katalog bleibt derselbe. Neu ist die Zusammenstellung: Zufallsauswahl,
        gemischte Antworten, optional nur deine Lücken.
      </p>

      <div>
        <div className="meta">Anzahl</div>
        <div className="row">
          {COUNTS.map((n) => (
            <button
              key={n}
              className={`chip ${setup.count === n ? "on" : ""}`}
              onClick={() => setSetup((s) => ({ ...s, count: n }))}
            >
              {n} Fragen
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="meta">Modus</div>
        <div className="row">
          <button
            className={`chip ${setup.mode === "practice" ? "on" : ""}`}
            onClick={() => setSetup((s) => ({ ...s, mode: "practice" }))}
          >
            Üben mit Feedback
          </button>
          <button
            className={`chip ${setup.mode === "exam" ? "on" : ""}`}
            onClick={() => setSetup((s) => ({ ...s, mode: "exam" }))}
          >
            Prüfung
          </button>
          <button
            className={`chip ${setup.weak ? "on" : ""}`}
            onClick={() => setSetup((s) => ({ ...s, weak: !s.weak }))}
          >
            Schwache Fragen bevorzugen
          </button>
        </div>
      </div>

      <div>
        <div className="meta">Themen · {pool} Fragen im Pool</div>
        <div className="row">
          <button
            className={`chip ${setup.categoryIds.length === 0 ? "on" : ""}`}
            onClick={() => setSetup((s) => ({ ...s, categoryIds: [] }))}
          >
            Alle Themen
          </button>
          {catalog.categories.map((cat) => (
            <button
              key={cat.id}
              className={`chip ${setup.categoryIds.includes(cat.id) ? "on" : ""}`}
              onClick={() => toggleCat(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="actions">
        <span />
        <button className="primary" onClick={onStart} disabled={!pool}>
          Quiz starten
        </button>
      </div>
    </div>
  );
}

function QuizView({ quiz, setQuiz, persist, onExit, onDone }) {
  const q = quiz.items[quiz.index];
  const last = quiz.index === quiz.items.length - 1;

  function toggle(id) {
    if (quiz.revealed) return;
    setQuiz((cur) => {
      const has = cur.selected.includes(id);
      return {
        ...cur,
        selected: has ? cur.selected.filter((x) => x !== id) : [...cur.selected, id],
      };
    });
  }

  function submit() {
    const ok = isCorrect(q, quiz.selected);
    persist(recordAnswer(loadProgress(), q.id, ok));
    if (quiz.mode === "exam") {
      advance({ question: q, selected: quiz.selected, ok });
      return;
    }
    setQuiz((cur) => ({ ...cur, revealed: true }));
  }

  function advance(answer) {
    const answers = [...quiz.answers, answer || { question: q, selected: quiz.selected, ok: isCorrect(q, quiz.selected) }];
    if (last) {
      onDone({ ...quiz, answers, index: quiz.index });
      return;
    }
    setQuiz((cur) => ({
      ...cur,
      answers,
      index: cur.index + 1,
      selected: [],
      revealed: false,
    }));
  }

  const pct = Math.round(((quiz.index + (quiz.revealed ? 1 : 0)) / quiz.items.length) * 100);

  return (
    <>
      <div className="quiz-head">
        <span>
          {quiz.index + 1} / {quiz.items.length} · {quiz.mode === "exam" ? "Prüfung" : "Übung"}
        </span>
        <div className="meter">
          <i style={{ width: `${pct}%` }} />
        </div>
        <button className="ghost" onClick={onExit}>
          Beenden
        </button>
      </div>
      <article className="qcard">
        <div className="meta">
          Frage {q.id} · {q.category}
        </div>
        <h2>{q.question}</h2>
        <div className="hint">
          {q.multiple ? "Mehrere Antworten können richtig sein." : "Eine Antwort ist richtig."}
        </div>
        {q.image && <img className="photo" src={q.image} alt="Ausdrucksverhalten des Hundes" />}
        <div className="options">
          {q.options.map((opt) => {
            const on = quiz.selected.includes(opt.id);
            let cls = "opt" + (on ? " on" : "");
            if (quiz.revealed) {
              const should = q.correct.includes(opt.id);
              if (should) cls = "opt ok";
              else if (on) cls = "opt miss";
            }
            return (
              <button key={opt.id} className={cls} onClick={() => toggle(opt.id)}>
                <span className="mark">{opt.id}</span>
                <span>{opt.text}</span>
              </button>
            );
          })}
        </div>
        {quiz.revealed && (
          <div className={`feedback ${isCorrect(q, quiz.selected) ? "good" : "bad"}`}>
            {isCorrect(q, quiz.selected) ? "Richtig." : "Nicht vollständig richtig."} Lösung:{" "}
            {q.correct.join(", ")}
          </div>
        )}
        <div className="actions">
          <span />
          {!quiz.revealed ? (
            <button className="primary" onClick={submit} disabled={!quiz.selected.length}>
              {quiz.mode === "exam" ? (last ? "Prüfung auswerten" : "Weiter") : "Antwort prüfen"}
            </button>
          ) : (
            <button className="primary" onClick={() => advance()}>
              {last ? "Auswertung" : "Nächste Frage"}
            </button>
          )}
        </div>
      </article>
    </>
  );
}

function Results({ quiz, onHome, onRetryWrong, onNew }) {
  const { graded, correctCount, percent, passed } = scoreQuiz(
    quiz.answers.map((a) => ({ question: a.question, selected: a.selected }))
  );
  return (
    <div className="panel">
      <div className="result-hero">
        <div className="score-ring" style={{ "--p": percent }}>
          <span>{percent}%</span>
        </div>
        <div>
          <div className="meta">{passed ? "Bestanden" : "Noch nicht bestanden"}</div>
          <h2>{correctCount} von {graded.length} richtig</h2>
          <p className="lede">
            In der Prüfungssimulation gilt 80% als Orientierung. Nur vollständig
            korrekte Kombinationen zählen.
          </p>
          <div className="row">
            <button className="primary" onClick={onNew}>
              Neues Quiz
            </button>
            <button className="ghost" onClick={onRetryWrong}>
              Fehler wiederholen
            </button>
            <button className="ghost" onClick={onHome}>
              Zur Übersicht
            </button>
          </div>
        </div>
      </div>
      <div className="review">
        {graded.map((g, i) => (
          <div className="review-item" key={`${g.question.id}-${i}`}>
            <small>
              #{g.question.id} · {g.question.category} · {g.ok ? "richtig" : "falsch"}
            </small>
            <div>{g.question.question}</div>
            <div>
              Deine Wahl: {g.selected.join(", ") || "—"} · Lösung: {g.question.correct.join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Learn({ progress }) {
  const [catId, setCatId] = useState(catalog.categories[0].id);
  const [openId, setOpenId] = useState(null);
  const questions = useMemo(
    () => catalog.questions.filter((q) => q.categoryId === catId),
    [catId]
  );

  return (
    <div className="learn-layout">
      <aside className="side panel">
        {catalog.categories.map((cat) => (
          <button
            key={cat.id}
            className={cat.id === catId ? "on" : ""}
            onClick={() => {
              setCatId(cat.id);
              setOpenId(null);
            }}
          >
            {cat.name}
          </button>
        ))}
      </aside>
      <div>
        {questions.map((q) => {
          const open = openId === q.id;
          const acc = accuracyFor(progress, q.id);
          return (
            <article key={q.id} className="qcard" style={{ marginBottom: 10 }}>
              <div className="meta">
                Frage {q.id}
                {acc !== null ? ` · Trefferquote ${Math.round(acc * 100)}%` : " · noch nicht geübt"}
              </div>
              <h2 style={{ fontSize: 22 }}>{q.question}</h2>
              {q.image && <img className="photo" src={q.image} alt="" />}
              {open ? (
                <>
                  <div className="options" style={{ marginTop: 12 }}>
                    {q.options.map((opt) => (
                      <div key={opt.id} className={q.correct.includes(opt.id) ? "opt ok" : "opt"}>
                        <span className="mark">{opt.id}</span>
                        <span>{opt.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="answer-key">Lösung: {q.correct.join(", ")}</div>
                </>
              ) : (
                <div className="actions">
                  <span />
                  <button className="ghost" onClick={() => setOpenId(q.id)}>
                    Lösung zeigen
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
