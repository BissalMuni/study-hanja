# -*- coding: utf-8 -*-
"""Unihan 데이터로 각 글자에 부수(部首)와 획수(劃數)를 보강한다.
- kRSUnicode  : '부수번호.나머지획수'
- kTotalStrokes: 총 획수
- CJKRadicals.txt: 부수번호 -> 부수 글자
- radical_names_ko: 부수번호 -> 한국어 부수명
또한 부수 사전(data/radicals.json)도 함께 생성한다."""
import io
import sys
import json
import zipfile
from pathlib import Path

from radical_names_ko import RADICAL_NAMES_KO

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
HANJA = DATA / "hanja"


def load_irg():
    """char -> {radNum, residual, strokes}"""
    z = zipfile.ZipFile(DATA / "Unihan.zip")
    text = z.read("Unihan_IRGSources.txt").decode("utf-8")
    info = {}
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        cp, field, value = line.split("\t")
        char = chr(int(cp[2:], 16))
        d = info.setdefault(char, {})
        if field == "kRSUnicode":
            # 여러 부수표기가 있으면 첫 번째(정규) 사용
            first = value.split(" ")[0]
            rad, _, res = first.partition(".")
            d["radNum"] = int(rad.replace("'", ""))  # 120' 같은 간체 부수표기 정규화
            d["residual"] = int(res) if res else 0
        elif field == "kTotalStrokes":
            d["strokes"] = int(value.split(" ")[0])
    return info


def load_radical_chars():
    """부수번호 -> 부수 글자(기본형)"""
    text = (DATA / "CJKRadicals.txt").read_text(encoding="utf-8")
    rad_char = {}
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        num, _kangxi, unified = [p.strip() for p in line.split(";")]
        # '1' 또는 "1'"(변형) — 변형은 건너뛰고 기본 번호만
        if "'" in num:
            continue
        rad_char[int(num)] = chr(int(unified, 16))
    return rad_char


def build_radical_dict(rad_char):
    radicals = {}
    for num, name in RADICAL_NAMES_KO.items():
        radicals[num] = {
            "num": num,
            "char": rad_char.get(num, ""),
            "name": name,
        }
    out = DATA / "radicals.json"
    out.write_text(json.dumps(radicals, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"radicals.json: {len(radicals)} radicals")
    return radicals


def main():
    irg = load_irg()
    rad_char = load_radical_chars()
    radicals = build_radical_dict(rad_char)

    for level in ("4", "3", "2"):
        raw = json.loads((HANJA / f"{level}geup.raw.json").read_text(encoding="utf-8"))
        missing = []
        for e in raw:
            ch = e["char"]
            meta = irg.get(ch, {})
            num = meta.get("radNum")
            if num is None:
                missing.append(ch)
                e["radical"] = None
                e["strokes"] = meta.get("strokes")
                e["residualStrokes"] = None
                continue
            e["radical"] = {
                "num": num,
                "char": rad_char.get(num, ""),
                "name": radicals.get(num, {}).get("name", ""),
            }
            e["strokes"] = meta.get("strokes")
            e["residualStrokes"] = meta.get("residual")
        out = HANJA / f"{level}geup.json"
        out.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"level {level}: {len(raw)} chars enriched -> {out.name}; missing radical: {len(missing)} {missing[:10]}")


if __name__ == "__main__":
    main()
