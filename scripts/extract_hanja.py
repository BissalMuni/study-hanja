# -*- coding: utf-8 -*-
"""배정한자 PDF에서 글자/훈/음을 추출해 JSON으로 저장한다."""
import re
import json
import sys
import io
from pathlib import Path
import fitz

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = ROOT / "data" / "hanja"
OUT.mkdir(parents=True, exist_ok=True)

PDFS = {
    "4": "한국어문회 한자능력검정시험 배정한자 4급(1000자).pdf",
    "3": "한국어문회 한자능력검정시험 배정한자 3급(1817자).pdf",
    "2": "한국어문회 한자능력검정시험 배정한자 2급(2355자).pdf",
}

# 한자(CJK) 한 글자로 시작하고 공백 뒤에 훈음이 오는 줄
HANJA = r"[㐀-䶿一-鿿豈-﫿]"
LINE = re.compile(rf"^({HANJA})\s+(.+)$")
# 초성 섹션 마커(ㄱ, ㄴ ...) 한 글자
CONSONANT = re.compile(r"^[ㄱ-ㅎ]$")


def split_top_level(hunum: str):
    """복수 음훈을 나누되, 대괄호[]·소괄호() 안의 콤마(예: 신[履, 鞋])는 무시한다."""
    parts, buf, depth = [], [], 0
    for ch in hunum:
        if ch in "[(":
            depth += 1
        elif ch in "])":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p for p in parts if p.strip()]


def split_reading(chunk: str):
    """'내릴 강' -> ('내릴','강',None). 마지막 공백 토큰을 음(소리)으로 본다.
    공백이 없으면('빛날요') 끝 한글 한 글자를 음으로 떼고,
    음에 붙은 참고표기('획(劃)')는 분리해 note로 돌려준다."""
    chunk = chunk.strip()
    if " " in chunk:
        hun, sori = chunk.rsplit(" ", 1)
    else:
        m = re.match(r"^(.*?)([가-힣])$", chunk)
        hun, sori = (m.group(1), m.group(2)) if m else (chunk, "")
    hun, sori = hun.strip(), sori.strip()
    note = None
    m = re.match(r"^([가-힣]+)(.*)$", sori)
    if m:
        sori = m.group(1)
        extra = m.group(2).strip()
        if extra:
            note = extra
    return hun, sori, note


def parse_level(level: str, filename: str):
    doc = fitz.open(str(DOCS / filename))
    text = "\n".join(doc[i].get_text() for i in range(doc.page_count))
    entries = []
    current_consonant = None
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if CONSONANT.match(s):
            current_consonant = s
            continue
        m = LINE.match(s)
        if not m:
            continue  # 헤더/페이지번호/제목 등은 버림
        char, hunum = m.group(1), m.group(2)
        # 복수 음훈: '내릴 강, 항복할 항'
        readings = []
        for chunk in split_top_level(hunum):
            hun, sori, note = split_reading(chunk)
            if hun:
                r = {"hun": hun, "sori": sori}
                if note:
                    r["note"] = note
                readings.append(r)
        if not readings:
            continue
        entries.append({
            "char": char,
            "hun": readings[0]["hun"],     # 대표 훈
            "sori": readings[0]["sori"],   # 대표 음
            "readings": readings,           # 전체 음훈
            "consonant": current_consonant, # 가나다 초성 그룹
        })
    return entries


def main():
    summary = {}
    for level, fn in PDFS.items():
        entries = parse_level(level, fn)
        out = OUT / f"{level}geup.raw.json"
        out.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
        summary[level] = len(entries)
        # 음이 한글 한 글자가 아닌 의심 항목 점검
        bad = [e for e in entries for r in e["readings"]
               if not re.fullmatch(r"[가-힣]", r["sori"])]
        print(f"level {level}: {len(entries)} chars -> {out.name}; suspicious sori: {len(bad)}")
        for e in bad[:10]:
            print("   ?", e["char"], e["readings"])
    print("summary:", summary)


if __name__ == "__main__":
    main()
