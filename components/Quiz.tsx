"use client";

import { useEffect, useMemo, useState } from "react";
import type { LevelData } from "@/lib/types";
import {
  availableTypes,
  generateRandom,
  QUIZ_LABELS,
  type QuizQ,
  type QuizType,
} from "@/lib/quiz";

export default function Quiz({ data, level }: { data: LevelData; level: string }) {
  const allTypes = useMemo(() => availableTypes(data), [data]);
  const [types, setTypes] = useState<QuizType[]>(allTypes);
  const [q, setQ] = useState<QuizQ | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const next = () => {
    setChosen(null);
    setQ(generateRandom(data, types));
  };

  // 급수/유형이 바뀌면 새 문제 + 점수 초기화
  useEffect(() => {
    setTypes(allTypes);
  }, [allTypes]);
  useEffect(() => {
    setScore({ correct: 0, total: 0 });
    setChosen(null);
    setQ(generateRandom(data, types.length ? types : allTypes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, types]);

  const answered = chosen !== null;
  const onChoose = (c: string) => {
    if (answered || !q) return;
    setChosen(c);
    setScore((s) => ({ correct: s.correct + (c === q.answer ? 1 : 0), total: s.total + 1 }));
  };

  const toggleType = (t: QuizType) => {
    setTypes((prev) => {
      const has = prev.includes(t);
      const nextT = has ? prev.filter((x) => x !== t) : [...prev, t];
      return nextT.length ? nextT : prev; // 최소 1개 유지
    });
  };

  const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="quiz">
      <div className="quiztypes">
        {allTypes.map((t) => (
          <button
            key={t}
            className={types.includes(t) ? "qt on" : "qt"}
            onClick={() => toggleType(t)}
          >
            {QUIZ_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="scorebar">
        <span>
          맞힘 <b>{score.correct}</b> / {score.total}
        </span>
        <span className="pct">{pct}%</span>
      </div>

      {q ? (
        <div className="card">
          <div className="qhead">
            <span className="qbadge">{q.label}</span>
            <span className="qinstr">{q.instruction}</span>
          </div>
          <div className="qstem">{q.stem}</div>
          {q.stemSub && <div className="qstemsub">{q.stemSub}</div>}

          <div className="choices">
            {q.choices.map((c, i) => {
              const isAnswer = c === q.answer;
              const isChosen = c === chosen;
              let cls = "choice";
              if (answered && isAnswer) cls += " correct";
              else if (answered && isChosen) cls += " wrong";
              return (
                <button key={i} className={cls} onClick={() => onChoose(c)} disabled={answered}>
                  <span className="cnum">{i + 1}</span>
                  <span className="ctext">{c}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div className={chosen === q.answer ? "verdict ok" : "verdict no"}>
              {chosen === q.answer ? "정답!" : "오답"} · {q.explain}
            </div>
          )}

          <button className="nextbtn" onClick={next}>
            {answered ? "다음 문제 →" : "건너뛰기"}
          </button>
        </div>
      ) : (
        <p className="muted">문제를 생성할 수 없습니다. 유형을 선택하세요.</p>
      )}

      <p className="quizhint">
        {level}급 데이터로 만든 연습문제입니다. 기출 유형을 본떠 무한 생성되며,
        보기는 같은 부수·같은 소리 글자에서 골라 헷갈리게 구성합니다.
      </p>
    </div>
  );
}
