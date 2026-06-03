"use client";

import { useEffect, useMemo, useState } from "react";
import type { LevelData } from "@/lib/types";
import { buildEgo, buildWordEgo, REL_LABELS, REL_COLORS } from "@/lib/graph";
import Graph from "@/components/Graph";
import Detail from "@/components/Detail";
import Quiz from "@/components/Quiz";

type Level = "2" | "3" | "4";
type Mode = "map" | "quiz";

export default function Page() {
  const [level, setLevel] = useState<Level>("4");
  const [mode, setMode] = useState<Mode>("map");
  const [data, setData] = useState<LevelData | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [kind, setKind] = useState<"char" | "word">("char");
  const [query, setQuery] = useState("");
  const [showHomo, setShowHomo] = useState(true);
  const [showRad, setShowRad] = useState(false);

  useEffect(() => {
    setData(null);
    fetch(`/data/${level}.json`)
      .then((r) => r.json())
      .then((d: LevelData) => {
        setData(d);
        const first = Object.keys(d.chars)[0];
        setSelected(first);
        setKind("char");
      });
  }, [level]);

  const results = useMemo(() => {
    if (!data || !query.trim()) return [];
    const q = query.trim();
    return Object.values(data.chars)
      .filter((c) => c.char === q || c.sori === q || c.hun.includes(q) || c.readings.some((r) => r.sori === q))
      .slice(0, 60);
  }, [data, query]);

  const graph = useMemo(() => {
    if (!data || !selected) return { nodes: [], links: [] };
    return kind === "char"
      ? buildEgo(data, selected, { showHomophones: showHomo, showSameRadical: showRad, cap: 12 })
      : buildWordEgo(data, selected);
  }, [data, selected, kind, showHomo, showRad]);

  const onSelect = (id: string, k: "char" | "word") => {
    setSelected(id);
    setKind(k);
  };

  return (
    <div className="layout">
      <aside className="panel">
        <header className="brand">
          <h1>한자 지도</h1>
          <div className="levels">
            {(["4", "3", "2"] as Level[]).map((lv) => (
              <button key={lv} className={level === lv ? "lv active" : "lv"} onClick={() => setLevel(lv)}>
                {lv}급
              </button>
            ))}
          </div>
        </header>

        <div className="modes">
          <button className={mode === "map" ? "mode active" : "mode"} onClick={() => setMode("map")}>
            🗺 지도
          </button>
          <button className={mode === "quiz" ? "mode active" : "mode"} onClick={() => setMode("quiz")}>
            ✏ 문제풀이
          </button>
        </div>

        <div className="search">
          <input
            placeholder="한자 · 음(가) · 훈(값) 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div className="results">
              {results.map((c) => (
                <button key={c.char} className="result" onClick={() => { onSelect(c.char, "char"); setQuery(""); }}>
                  <span className="rchar">{c.char}</span>
                  <span className="rhun">{c.hun} {c.sori}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {data && selected ? (
          <Detail data={data} selected={selected} kind={kind} onSelect={onSelect} />
        ) : (
          <p className="muted">데이터 불러오는 중…</p>
        )}
      </aside>

      <main className="canvas">
        {mode === "quiz" && data ? (
          <Quiz data={data} level={level} />
        ) : (
        <>
        <div className="toolbar">
          <label className={showHomo ? "toggle on" : "toggle"}>
            <input type="checkbox" checked={showHomo} onChange={(e) => setShowHomo(e.target.checked)} />
            동음
          </label>
          <label className={showRad ? "toggle on" : "toggle"}>
            <input type="checkbox" checked={showRad} onChange={(e) => setShowRad(e.target.checked)} />
            동부수
          </label>
          <div className="legend">
            {(["word", "synonym", "antonym", "variant", "homophone", "sameRadical"] as const).map((r) => (
              <span key={r} className="leg">
                <i style={{ background: REL_COLORS[r] }} /> {REL_LABELS[r]}
              </span>
            ))}
          </div>
          {data && <span className="count">{data.count}자</span>}
        </div>
        <div className="graphwrap">
          <Graph data={graph} onSelect={onSelect} />
        </div>
        </>
        )}
      </main>
    </div>
  );
}
