// 그래프 데이터 타입 (data/graph/<level>.json 구조)

export interface Reading {
  hun: string;
  sori: string;
  note?: string;
}

export interface Radical {
  num: number;
  char: string;
  name: string;
}

export interface ExamRef {
  round: number;
  level: string;
  levelCode: string;
  num: number;
  type: string;
  label: string;
  answer?: string | null;
}

export interface CharNode {
  char: string;
  hun: string;
  sori: string;
  readings: Reading[];
  radical: Radical | null;
  strokes: number | null;
  synonyms: string[];
  antonyms: string[];
  variants: string[];
  words: string[];
  exams: ExamRef[];
}

export interface WordNode {
  word: string;
  chars: string[];
  reading: string | null;
  meaning: string | null;
  exams: ExamRef[];
  antonymOf: string[];
  homonymOf: string[];
}

export interface LevelData {
  level: string;
  count: number;
  chars: Record<string, CharNode>;
  words: Record<string, WordNode>;
  index: {
    bySori: Record<string, string[]>;
    byRadical: Record<string, string[]>;
  };
  radicals: Record<string, Radical & { chars: string[] }>;
}

// force-graph 노드/링크
export type RelType =
  | "center"
  | "word"
  | "synonym"
  | "antonym"
  | "variant"
  | "homophone"
  | "sameRadical"
  | "wordAntonym"
  | "wordHomonym";

export interface GNode {
  id: string;
  label: string;
  kind: "char" | "word";
  rel: RelType;
  sub?: string; // 음 또는 독음
}

export interface GLink {
  source: string;
  target: string;
  rel: RelType;
}

export interface GraphData {
  nodes: GNode[];
  links: GLink[];
}
