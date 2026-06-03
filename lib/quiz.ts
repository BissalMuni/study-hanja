import type { LevelData, CharNode, WordNode } from "./types";

// 기출 유형을 본뜬 연습문제 (객관식). 그래프 데이터로 무한 생성한다.
export type QuizType =
  | "訓音"
  | "部首"
  | "讀音"
  | "漢字쓰기"
  | "略字"
  | "類義字"
  | "反義字"
  | "同音異義";

export const QUIZ_LABELS: Record<QuizType, string> = {
  訓音: "훈·음 맞히기",
  部首: "부수 맞히기",
  讀音: "독음 맞히기",
  漢字쓰기: "한자어 쓰기(독음→한자)",
  略字: "약자 맞히기",
  類義字: "유의자 맞히기",
  反義字: "반의자 맞히기",
  同音異義: "동음이의어",
};

export interface QuizQ {
  type: QuizType;
  label: string;
  instruction: string;
  stem: string; // 문제로 제시되는 한자/한자어
  stemSub?: string; // 보조 설명
  answer: string;
  choices: string[];
  explain: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function sampleDistinct<T>(arr: T[], n: number, exclude: Set<T>): T[] {
  const out: T[] = [];
  const seen = new Set(exclude);
  let guard = 0;
  while (out.length < n && guard++ < n * 40 && arr.length > seen.size) {
    const x = pick(arr);
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const huneum = (c: CharNode) =>
  c.readings.map((r) => `${r.hun} ${r.sori}`).join(", ");

// 어떤 유형이 이 급수 데이터로 생성 가능한지
export function availableTypes(data: LevelData): QuizType[] {
  const chars = Object.values(data.chars);
  const words = Object.values(data.words);
  const types: QuizType[] = [];
  if (chars.length) types.push("訓音", "部首");
  if (words.some((w) => w.reading)) types.push("讀音", "漢字쓰기");
  if (chars.some((c) => c.variants.length)) types.push("略字");
  if (chars.some((c) => c.synonyms.length)) types.push("類義字");
  if (chars.some((c) => c.antonyms.length)) types.push("反義字");
  if (words.some((w) => w.homonymOf.length)) types.push("同音異義");
  return types;
}

export function generate(data: LevelData, type: QuizType): QuizQ | null {
  const charIds = Object.keys(data.chars);
  const wordIds = Object.keys(data.words);
  const wordsWithReading = wordIds.filter((w) => data.words[w].reading);

  switch (type) {
    case "訓音": {
      const c = data.chars[pick(charIds)];
      const answer = huneum(c);
      // 같은 부수/같은 소리 글자를 헷갈리는 보기로
      const confusables = [
        ...(c.radical ? data.index.byRadical[String(c.radical.num)] || [] : []),
        ...(data.index.bySori[c.sori] || []),
      ].filter((x) => x !== c.char);
      const pool = confusables.length >= 3 ? confusables : charIds;
      const distractors = sampleDistinct(pool, 3, new Set([c.char])).map(
        (id) => huneum(data.chars[id])
      );
      return mc("訓音", "다음 漢字의 訓(뜻)과 音(소리)으로 알맞은 것은?", c.char, undefined, answer, distractors,
        `${c.char} = ${answer}`);
    }
    case "部首": {
      const withRad = charIds.filter((id) => data.chars[id].radical);
      const c = data.chars[pick(withRad)];
      const answer = c.radical!.char;
      const distractors = sampleDistinct(
        withRad.map((id) => data.chars[id].radical!.char),
        3,
        new Set([answer])
      );
      return mc("部首", "다음 漢字의 部首(부수)는?", c.char, `${c.hun} ${c.sori}`, answer, distractors,
        `${c.char}의 부수는 ${answer} (${c.radical!.name}).`);
    }
    case "讀音": {
      const w = data.words[pick(wordsWithReading)];
      const answer = w.reading!;
      const distractors = sampleDistinct(
        wordsWithReading.map((id) => data.words[id].reading!),
        3,
        new Set([answer])
      );
      return mc("讀音", "다음 漢字語의 讀音(독음)은?", w.word, undefined, answer, distractors,
        `${w.word} = ${answer}`);
    }
    case "漢字쓰기": {
      const w = data.words[pick(wordsWithReading)];
      const answer = w.word;
      const distractors = sampleDistinct(wordIds, 3, new Set([answer]));
      return mc("漢字쓰기", "다음 讀音(독음)에 해당하는 漢字語는?", `[${w.reading}]`,
        w.meaning || undefined, answer, distractors, `${w.reading} → ${w.word}`);
    }
    case "略字": {
      const withVar = charIds.filter((id) => data.chars[id].variants.length);
      const c = data.chars[pick(withVar)];
      const answer = pick(c.variants);
      const distractors = sampleDistinct(
        withVar.flatMap((id) => data.chars[id].variants),
        3,
        new Set([answer, c.char])
      );
      return mc("略字", "다음 漢字(正字)의 略字(약자)는?", c.char, `${c.hun} ${c.sori}`, answer, distractors,
        `${c.char}의 약자는 ${answer}.`);
    }
    case "類義字": {
      const withSyn = charIds.filter((id) => data.chars[id].synonyms.length);
      const c = data.chars[pick(withSyn)];
      const answer = pick(c.synonyms);
      const distractors = sampleDistinct(charIds, 3, new Set([answer, c.char]));
      return mc("類義字", "다음 漢字와 뜻이 비슷한(類義) 漢字는?", c.char, `${c.hun} ${c.sori}`, answer, distractors,
        `${c.char} ↔ ${answer} (유의자).`);
    }
    case "反義字": {
      const withAnt = charIds.filter((id) => data.chars[id].antonyms.length);
      const c = data.chars[pick(withAnt)];
      const answer = pick(c.antonyms);
      const distractors = sampleDistinct(charIds, 3, new Set([answer, c.char]));
      return mc("反義字", "다음 漢字와 뜻이 반대(反義)인 漢字는?", c.char, `${c.hun} ${c.sori}`, answer, distractors,
        `${c.char} ↔ ${answer} (반의자).`);
    }
    case "同音異義": {
      const withHom = wordIds.filter((id) => data.words[id].homonymOf.length);
      if (!withHom.length) return null;
      const w = data.words[pick(withHom)];
      const answer = pick(w.homonymOf);
      const distractors = sampleDistinct(wordIds, 3, new Set([answer, w.word]));
      return mc("同音異義", "다음 漢字語와 소리는 같고 뜻이 다른(同音異義) 漢字語는?",
        w.word, w.reading ? `[${w.reading}]` : undefined, answer, distractors,
        `${w.word} 와 ${answer} 는 동음이의어.`);
    }
  }
}

function mc(
  type: QuizType,
  instruction: string,
  stem: string,
  stemSub: string | undefined,
  answer: string,
  distractors: string[],
  explain: string
): QuizQ | null {
  const choices = [answer, ...distractors];
  if (choices.length < 2) return null;
  return {
    type,
    label: QUIZ_LABELS[type],
    instruction,
    stem,
    stemSub,
    answer,
    choices: shuffle(choices),
    explain,
  };
}

// 선택한 유형들에서 무작위로 한 문제 (데이터 부족 유형은 자동 회피)
export function generateRandom(data: LevelData, types: QuizType[]): QuizQ | null {
  const usable = types.length ? types : availableTypes(data);
  for (let i = 0; i < 8; i++) {
    const q = generate(data, pick(usable));
    if (q) return q;
  }
  return null;
}
