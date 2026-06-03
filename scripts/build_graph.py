# -*- coding: utf-8 -*-
"""배정한자 + 기출 데이터를 합쳐 급수별 지식 그래프 데이터를 만든다.

출력: data/graph/<level>.json
 - chars: 글자 노드(훈/음/부수/획수 + 유의·반의·이체 + 단어 + 기출)
 - words: 한자어 노드(독음/구성 글자/기출 + 반대어·동음이의)
 - index: 음(sori)·부수(radical)별 글자 묶음 (동음/동부수 학습용)
 - radicals: 부수 사전
"""
import io
import sys
import re
import json
import glob
from pathlib import Path
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
HANJA = ROOT / "data" / "hanja"
EXAMS = ROOT / "data" / "exams"
OUT = ROOT / "data" / "graph"
OUT.mkdir(parents=True, exist_ok=True)

CJK = r"[㐀-䶿一-鿿豈-﫿\U00020000-\U0002ffff]"
CJK_CHAR = re.compile(CJK)


def load_levels():
    levels = {}
    for lv in ("4", "3", "2"):
        levels[lv] = json.loads((HANJA / f"{lv}geup.json").read_text(encoding="utf-8"))
    return levels


def load_exams():
    exams = []
    for f in sorted(glob.glob(str(EXAMS / "*.json"))):
        exams.append(json.loads(Path(f).read_text(encoding="utf-8")))
    return exams


def cjk_chars(s):
    return CJK_CHAR.findall(s or "")


def adjacent_char_to_blank(prompt):
    """'(  )却' / '尖(  )' 처럼 빈칸에 인접한 한 글자를 찾는다."""
    m = re.search(r"\(\s*\)", prompt)
    if not m:
        return None
    before = prompt[:m.start()]
    after = prompt[m.end():]
    # 빈칸 바로 뒤 글자 우선, 없으면 바로 앞 글자
    am = CJK_CHAR.match(after)
    if am:
        return am.group(0)
    bm = CJK_CHAR.search(before[::-1])
    if bm:
        return bm.group(0)
    return None


def build_word_bank(exams):
    """한자어 노드와 글자 쌍 관계를 기출에서 추출한다."""
    words = {}            # word -> {word, chars, reading, meaning, exams}
    char_pairs = defaultdict(set)  # (relType) -> set of (a,b) frozenset
    syn, ant, var = set(), set(), set()   # 글자쌍: 유의/반의/이체
    word_ant, word_hom = set(), set()      # 단어쌍: 반대어/동음이의

    def add_word(w, ref, reading=None, meaning=None):
        if not w or len(w) < 1:
            return
        node = words.setdefault(w, {
            "word": w, "chars": cjk_chars(w),
            "reading": None, "meaning": None, "exams": [],
        })
        if reading and not node["reading"]:
            node["reading"] = reading
        if meaning and not node["meaning"]:
            node["meaning"] = meaning
        if ref not in node["exams"]:
            node["exams"].append(ref)

    for ex in exams:
        meta = {"round": ex["round"], "level": ex["level"], "levelCode": ex["levelCode"]}
        for q in ex["questions"]:
            ref = {**meta, "num": q["num"], "type": q["type"], "label": q["typeLabel"]}
            t = q["type"]
            pwords = q["words"]
            ans = q["answer"]
            ans_runs = [r for r in re.findall(CJK + "+", ans or "")]
            ans_words = [r for r in ans_runs if len(r) >= 2]
            ans_chars = cjk_chars(ans)

            if t == "讀音":
                for w in pwords:
                    add_word(w, ref, reading=ans)
            elif t == "漢字쓰기":
                for w in ans_words:
                    add_word(w, ref)  # 정답이 한자어(정자)
            elif t == "뜻풀이":
                for w in pwords:
                    add_word(w, ref, meaning=ans)
            elif t == "同音異義":
                for w in pwords:
                    add_word(w, ref)
                for w in ans_words:
                    add_word(w, ref)
                if pwords and ans_words:
                    word_hom.add(frozenset((pwords[0], ans_words[0])))
            elif t == "反義語":
                # '肯定 ↔ (  )定' + ans 否  -> (肯定, 否定)
                left = pwords[0] if pwords else None
                # 오른쪽 단어 복원: 프롬프트의 빈칸을 정답 글자로 채움
                filled = q["prompt"].split("↔")[-1] if "↔" in q["prompt"] else ""
                ai = iter(ans_chars)
                right = re.sub(r"\(\s*\)", lambda _: next(ai, ""), filled)
                right = "".join(cjk_chars(right)) or (ans_words[0] if ans_words else "")
                if left:
                    add_word(left, ref)
                if right:
                    add_word(right, ref, reading=None)
                if left and right:
                    word_ant.add(frozenset((left, right)))
            elif t == "四字成語":
                filled = re.sub(r"\(\s*\)", lambda _: ans_chars[0] if ans_chars else "", q["prompt"])
                idiom = "".join(cjk_chars(filled.split(":")[0]))
                if len(idiom) >= 3:
                    add_word(idiom, ref)
            elif t == "類義字":
                other = adjacent_char_to_blank(q["prompt"])
                if other and ans_chars:
                    syn.add(frozenset((ans_chars[0], other)))
            elif t == "反義字":
                other = adjacent_char_to_blank(q["prompt"])
                if other and ans_chars:
                    ant.add(frozenset((ans_chars[0], other)))
            elif t == "略字":
                if q["prompt"] and ans_chars:
                    pc = cjk_chars(q["prompt"])
                    if pc:
                        var.add(frozenset((pc[0], ans_chars[0])))
            else:
                for w in pwords:
                    add_word(w, ref)

    return words, syn, ant, var, word_ant, word_hom


def pairs_to_map(pairs):
    m = defaultdict(set)
    for fs in pairs:
        items = list(fs)
        if len(items) == 2:
            a, b = items
            m[a].add(b)
            m[b].add(a)
    return m


def build_level(level_code, entries, words, syn_m, ant_m, var_m, exams):
    char_set = {e["char"] for e in entries}
    # 단어-기출 단일글자 문제도 char.exams 로
    char_exam_refs = defaultdict(list)
    for ex in exams:
        meta = {"round": ex["round"], "level": ex["level"], "levelCode": ex["levelCode"]}
        for q in ex["questions"]:
            if q["type"] in ("訓音", "部首", "略字") and len(q["hanja"]) == 1:
                ch = q["hanja"][0]
                if ch in char_set:
                    char_exam_refs[ch].append({**meta, "num": q["num"], "type": q["type"],
                                               "label": q["typeLabel"], "answer": q["answer"]})

    # 글자 -> 단어
    char_words = defaultdict(list)
    for w, node in words.items():
        for ch in set(node["chars"]):
            if ch in char_set:
                char_words[ch].append(w)

    by_sori = defaultdict(list)
    by_radical = defaultdict(list)
    chars = {}
    for e in entries:
        ch = e["char"]
        by_sori[e["sori"]].append(ch)
        if e["radical"]:
            by_radical[str(e["radical"]["num"])].append(ch)
        chars[ch] = {
            "char": ch,
            "hun": e["hun"], "sori": e["sori"], "readings": e["readings"],
            "radical": e["radical"], "strokes": e["strokes"],
            "synonyms": sorted(c for c in syn_m.get(ch, ()) if c != ch),
            "antonyms": sorted(c for c in ant_m.get(ch, ()) if c != ch),
            "variants": sorted(c for c in var_m.get(ch, ()) if c != ch),
            "words": sorted(char_words.get(ch, [])),
            "exams": char_exam_refs.get(ch, []),
        }

    # 이 급수에 등장하는 단어만 추려서 words 노드 포함
    used_words = {w for ws in char_words.values() for w in ws}
    words_out = {w: words[w] for w in used_words}

    radicals = json.loads((ROOT / "data" / "radicals.json").read_text(encoding="utf-8"))
    used_rad = {}
    for num, chs in by_radical.items():
        r = radicals.get(num, {"num": int(num)})
        used_rad[num] = {**r, "chars": sorted(chs)}

    return {
        "level": level_code,
        "count": len(chars),
        "chars": chars,
        "words": words_out,
        "index": {
            "bySori": {k: sorted(v) for k, v in by_sori.items()},
            "byRadical": {k: sorted(v) for k, v in by_radical.items()},
        },
        "radicals": used_rad,
    }


def main():
    levels = load_levels()
    exams = load_exams()
    words, syn, ant, var, word_ant, word_hom = build_word_bank(exams)
    syn_m, ant_m, var_m = pairs_to_map(syn), pairs_to_map(ant), pairs_to_map(var)
    word_ant_m, word_hom_m = pairs_to_map(word_ant), pairs_to_map(word_hom)

    # 단어 노드에 반대어/동음이의 연결 부여
    for w, node in words.items():
        node["antonymOf"] = sorted(word_ant_m.get(w, ()))
        node["homonymOf"] = sorted(word_hom_m.get(w, ()))

    for lv in ("4", "3", "2"):
        data = build_level(lv, levels[lv], words, syn_m, ant_m, var_m, exams)
        out = OUT / f"{lv}.json"
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        nwords = len(data["words"])
        nexamlinks = sum(len(c["exams"]) for c in data["chars"].values())
        size_kb = out.stat().st_size // 1024
        print(f"level {lv}: chars={data['count']} words={nwords} "
              f"charExamLinks={nexamlinks} synPairs~{sum(len(c['synonyms']) for c in data['chars'].values())} "
              f"-> {out.name} ({size_kb} KB)")
    print(f"word-bank total={len(words)} synPairs={len(syn)} antPairs={len(ant)} varPairs={len(var)} "
          f"wordAnt={len(word_ant)} wordHom={len(word_hom)}")


if __name__ == "__main__":
    main()
