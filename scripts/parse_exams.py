# -*- coding: utf-8 -*-
"""복호화된 기출 텍스트를 구조화한다.
- 문제 블록([問 a-b] 지시문) -> 유형 분류
- 각 문항([n] 내용) -> 한자/한자어 추출
- 정답 영역(답안지) -> {문항번호: 정답}
- 결합해 data/exams/<round>_<levelcode>.json 으로 저장
"""
import io
import sys
import re
import json
import glob
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hwp_decrypt import extract_text

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "exams"
OUT.mkdir(parents=True, exist_ok=True)

CJK = r"[㐀-䶿一-鿿豈-﫿\U00020000-\U0002ffff]"
CJK_RUN = re.compile(CJK + "+")
BLOCK = re.compile(r"\[問\s*(\d+)\s*[-~]\s*(\d+)\]\s*([^\n\[]+)")
ITEM = re.compile(r"\[\s*(\d+)\s*\]\s*([^\n\[]*)")  # 다음 '[' 전까지 (한 줄 다항목 분리)
HEADER_WORDS = {"번호", "정답", "채점란", "답안란", "감독위원", "채점위원",
                "득점", "서명", "답안지"}

LEVEL_CODE = {"1급": "1", "2급": "2", "3급": "3", "3급Ⅱ": "3II", "3급II": "3II",
              "4급": "4", "4급Ⅱ": "4II", "특급": "T"}


def classify(instr: str) -> tuple:
    """지시문 -> (유형코드, 한국어 라벨)"""
    s = instr
    if "讀音" in s:
        return "讀音", "독음 쓰기"
    if "訓" in s and "音" in s:
        return "訓音", "훈·음 쓰기"
    if "部首" in s:
        return "部首", "부수 쓰기"
    if "略字" in s:
        return "略字", "약자 쓰기"
    if "長音" in s:
        return "長音", "장음 고르기"
    if "同音異義" in s:
        return "同音異義", "동음이의어"
    if "四字成語" in s or "成語" in s:
        return "四字成語", "사자성어 완성"
    if "뜻" in s and ("같거나 비슷" in s or "비슷한" in s):
        return "類義字", "유의자"
    if "상대" in s and "漢字語" in s:
        return "反義語", "반대어 쓰기"
    if "상대" in s or "반대" in s:
        return "反義字", "반의자"
    if "뜻을 쓰" in s:
        return "뜻풀이", "한자어 뜻풀이"
    if "正字" in s and "漢字" in s:
        return "漢字쓰기", "한자어 정자 쓰기"
    return "기타", instr.strip()[:20]


def parse_answers(text: str) -> dict:
    """답안지 영역에서 {문항번호: 정답} 추출 (열 우선 흐름 대응)."""
    idx = text.find("답안지")
    region = text[idx:] if idx >= 0 else text
    answers = {}
    pending = None
    for raw in region.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.fullmatch(r"\d{1,3}", line):
            num = int(line)
            if 1 <= num <= 200:
                pending = num
                continue
        if pending is not None:
            if line in HEADER_WORDS or any(h in line for h in HEADER_WORDS):
                continue
            answers[pending] = line
            pending = None
    return answers


def parse_exam(text: str, source: str) -> dict:
    rnd = re.search(r"제\s*(\d+)\s*회", text)
    lvl = re.search(r"\b(특급|[1-4]급(?:Ⅱ|II)?)\b", text)
    level = lvl.group(1) if lvl else "?"
    answers = parse_answers(text)

    # 문제 본문은 첫 '<끝>' 이전까지 (이후는 답안지)
    body = text.split("<끝>")[0]
    blocks = list(BLOCK.finditer(body))
    questions = []
    for bi, b in enumerate(blocks):
        start, end = int(b.group(1)), int(b.group(2))
        qtype, label = classify(b.group(3))
        seg_start = b.end()
        seg_end = blocks[bi + 1].start() if bi + 1 < len(blocks) else len(body)
        segment = body[seg_start:seg_end]
        for m in ITEM.finditer(segment):
            num = int(m.group(1))
            if not (start <= num <= end):
                continue
            prompt = m.group(2).strip()
            runs = CJK_RUN.findall(prompt)
            hanja = sorted({c for r in runs for c in r})
            words = [r for r in runs if len(r) >= 2]
            questions.append({
                "num": num,
                "type": qtype,
                "typeLabel": label,
                "prompt": prompt,
                "answer": answers.get(num),
                "hanja": hanja,
                "words": words,
            })
    return {
        "source": source,
        "round": int(rnd.group(1)) if rnd else None,
        "level": level,
        "levelCode": LEVEL_CODE.get(level, "?"),
        "numQuestions": len(questions),
        "questions": questions,
    }


def main():
    summary = []
    for f in sorted(glob.glob(str(ROOT / "docs" / "*_문답.hwp"))):
        name = Path(f).stem
        text = "\n".join(extract_text(f))
        exam = parse_exam(text, name)
        out = OUT / f"{name}.json"
        out.write_text(json.dumps(exam, ensure_ascii=False, indent=2), encoding="utf-8")
        n_ans = sum(1 for q in exam["questions"] if q["answer"])
        summary.append((name, exam["level"], exam["numQuestions"], n_ans))
        print(f"{name}: level={exam['level']} questions={exam['numQuestions']} with-answer={n_ans}")
    print("done", len(summary), "exams")


if __name__ == "__main__":
    main()
