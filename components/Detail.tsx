"use client";

import type { LevelData } from "@/lib/types";

export default function Detail({
  data,
  selected,
  kind,
  onSelect,
}: {
  data: LevelData;
  selected: string;
  kind: "char" | "word";
  onSelect: (id: string, kind: "char" | "word") => void;
}) {
  if (kind === "word") {
    const w = data.words[selected];
    if (!w) return null;
    return (
      <div className="detail">
        <div className="bigword">{w.word}</div>
        {w.reading && <div className="reading">[{w.reading}]</div>}
        {w.meaning && <p className="meaning">{w.meaning}</p>}

        <Section title="구성 한자">
          <div className="chips">
            {w.chars.map((ch) => {
              const cn = data.chars[ch];
              return (
                <button key={ch} className="chip char" onClick={() => cn && onSelect(ch, "char")}>
                  {ch}
                  {cn && <span className="chipsub">{cn.hun} {cn.sori}</span>}
                </button>
              );
            })}
          </div>
        </Section>

        {w.antonymOf.length > 0 && (
          <Section title="반대어">
            <Chips items={w.antonymOf} onClick={(x) => onSelect(x, "word")} />
          </Section>
        )}
        {w.homonymOf.length > 0 && (
          <Section title="동음이의어">
            <Chips items={w.homonymOf} onClick={(x) => onSelect(x, "word")} />
          </Section>
        )}
        <ExamList exams={w.exams} />
      </div>
    );
  }

  const c = data.chars[selected];
  if (!c) return null;
  const homophones = (data.index.bySori[c.sori] || []).filter((x) => x !== c.char);
  const sameRad = c.radical
    ? (data.index.byRadical[String(c.radical.num)] || []).filter((x) => x !== c.char)
    : [];

  // 단어들의 기출까지 모아 보여준다
  const wordExams = c.words
    .flatMap((w) => (data.words[w]?.exams || []).map((e) => ({ ...e, word: w })))
    .slice(0, 30);

  return (
    <div className="detail">
      <div className="bigchar">{c.char}</div>
      <div className="huneum">
        {c.readings.map((r, i) => (
          <span key={i} className="reading">
            {r.hun} <b>{r.sori}</b>
            {r.note ? ` ${r.note}` : ""}
            {i < c.readings.length - 1 ? " · " : ""}
          </span>
        ))}
      </div>
      <div className="meta">
        {c.radical && (
          <span>
            부수 <b>{c.radical.char}</b> ({c.radical.name})
          </span>
        )}
        {c.strokes != null && <span>총 {c.strokes}획</span>}
      </div>

      {c.synonyms.length > 0 && (
        <Section title="유의자"><Chips items={c.synonyms} onClick={(x) => onSelect(x, "char")} char /></Section>
      )}
      {c.antonyms.length > 0 && (
        <Section title="반의자"><Chips items={c.antonyms} onClick={(x) => onSelect(x, "char")} char /></Section>
      )}
      {c.variants.length > 0 && (
        <Section title="이체자 / 약자"><Chips items={c.variants} onClick={(x) => onSelect(x, "char")} char /></Section>
      )}

      <Section title={`이 글자가 들어간 한자어 (${c.words.length})`}>
        {c.words.length === 0 ? (
          <p className="muted">기출에서 발견된 단어 없음</p>
        ) : (
          <div className="chips">
            {c.words.map((w) => (
              <button key={w} className="chip word" onClick={() => onSelect(w, "word")}>
                {w}
                {data.words[w]?.reading && <span className="chipsub">{data.words[w]!.reading}</span>}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title={`동음 한자 — 소리 [${c.sori}] (${homophones.length})`}>
        <Chips items={homophones} onClick={(x) => onSelect(x, "char")} char limit={40} />
      </Section>

      {c.radical && (
        <Section title={`동부수 — ${c.radical.char} ${c.radical.name} (${sameRad.length})`}>
          <Chips items={sameRad} onClick={(x) => onSelect(x, "char")} char limit={40} />
        </Section>
      )}

      <ExamList exams={[...c.exams, ...wordExams]} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Chips({
  items,
  onClick,
  char,
  limit,
}: {
  items: string[];
  onClick: (x: string) => void;
  char?: boolean;
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="chips">
      {shown.map((x) => (
        <button key={x} className={`chip ${char ? "char" : "word"}`} onClick={() => onClick(x)}>
          {x}
        </button>
      ))}
      {limit && items.length > limit && <span className="muted">+{items.length - limit}</span>}
    </div>
  );
}

function ExamList({ exams }: { exams: any[] }) {
  if (!exams || exams.length === 0) return null;
  return (
    <div className="section">
      <h3>기출 ({exams.length})</h3>
      <ul className="exams">
        {exams.map((e, i) => (
          <li key={i}>
            <span className="tag">{e.level} {e.round}회</span>
            <span className="qtype">{e.label}</span>
            {e.word && <b> {e.word}</b>}
            {e.answer && <span className="ans"> → {e.answer}</span>}
            <span className="qnum">#{e.num}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
