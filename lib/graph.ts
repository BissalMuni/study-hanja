import type { LevelData, GraphData, GNode, GLink, RelType } from "./types";

export interface EgoOptions {
  showHomophones: boolean;
  showSameRadical: boolean;
  cap: number; // 동음/동부수 표시 최대 개수
}

// 선택한 글자를 중심으로 한 자아 네트워크(ego-network)를 만든다.
export function buildEgo(
  data: LevelData,
  centerChar: string,
  opts: EgoOptions
): GraphData {
  const c = data.chars[centerChar];
  const nodes = new Map<string, GNode>();
  const links: GLink[] = [];

  const addChar = (ch: string, rel: RelType) => {
    const cn = data.chars[ch];
    if (!cn) return false;
    if (!nodes.has(ch)) {
      nodes.set(ch, { id: ch, label: ch, kind: "char", rel, sub: cn.sori });
    }
    return true;
  };
  const addWord = (w: string, rel: RelType) => {
    const wn = data.words[w];
    if (!nodes.has(w)) {
      nodes.set(w, { id: w, label: w, kind: "word", rel, sub: wn?.reading ?? "" });
    }
  };
  const link = (a: string, b: string, rel: RelType) => {
    links.push({ source: a, target: b, rel });
  };

  if (!c) return { nodes: [], links: [] };
  nodes.set(centerChar, { id: centerChar, label: centerChar, kind: "char", rel: "center", sub: c.sori });

  // 관계 글자
  for (const s of c.synonyms) if (addChar(s, "synonym")) link(centerChar, s, "synonym");
  for (const a of c.antonyms) if (addChar(a, "antonym")) link(centerChar, a, "antonym");
  for (const v of c.variants) if (addChar(v, "variant")) link(centerChar, v, "variant");

  // 단어
  for (const w of c.words) {
    addWord(w, "word");
    link(centerChar, w, "word");
  }

  // 동음(같은 음)
  if (opts.showHomophones) {
    const sibs = (data.index.bySori[c.sori] || []).filter((x) => x !== centerChar);
    for (const s of sibs.slice(0, opts.cap)) if (addChar(s, "homophone")) link(centerChar, s, "homophone");
  }

  // 동부수(같은 부수)
  if (opts.showSameRadical && c.radical) {
    const sibs = (data.index.byRadical[String(c.radical.num)] || []).filter((x) => x !== centerChar);
    for (const s of sibs.slice(0, opts.cap)) if (addChar(s, "sameRadical")) link(centerChar, s, "sameRadical");
  }

  return { nodes: [...nodes.values()], links };
}

// 단어 중심 자아 네트워크 (구성 글자 + 반대어/동음이의)
export function buildWordEgo(data: LevelData, centerWord: string): GraphData {
  const w = data.words[centerWord];
  const nodes = new Map<string, GNode>();
  const links: GLink[] = [];
  if (!w) return { nodes: [], links: [] };
  nodes.set(centerWord, { id: centerWord, label: centerWord, kind: "word", rel: "center", sub: w.reading ?? "" });

  for (const ch of w.chars) {
    const cn = data.chars[ch];
    if (cn) {
      nodes.set(ch, { id: ch, label: ch, kind: "char", rel: "word", sub: cn.sori });
      links.push({ source: centerWord, target: ch, rel: "word" });
    }
  }
  for (const a of w.antonymOf) {
    if (!nodes.has(a)) nodes.set(a, { id: a, label: a, kind: "word", rel: "wordAntonym", sub: data.words[a]?.reading ?? "" });
    links.push({ source: centerWord, target: a, rel: "wordAntonym" });
  }
  for (const h of w.homonymOf) {
    if (!nodes.has(h)) nodes.set(h, { id: h, label: h, kind: "word", rel: "wordHomonym", sub: data.words[h]?.reading ?? "" });
    links.push({ source: centerWord, target: h, rel: "wordHomonym" });
  }
  return { nodes: [...nodes.values()], links };
}

export const REL_COLORS: Record<RelType, string> = {
  center: "#111827",
  word: "#2563eb",
  synonym: "#059669",
  antonym: "#dc2626",
  variant: "#7c3aed",
  homophone: "#d97706",
  sameRadical: "#0891b2",
  wordAntonym: "#dc2626",
  wordHomonym: "#d97706",
};

export const REL_LABELS: Record<RelType, string> = {
  center: "중심",
  word: "단어",
  synonym: "유의자",
  antonym: "반의자",
  variant: "이체/약자",
  homophone: "동음(같은 소리)",
  sameRadical: "동부수",
  wordAntonym: "반대어",
  wordHomonym: "동음이의어",
};
