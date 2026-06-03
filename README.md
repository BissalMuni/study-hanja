# 한자 지도 (study-hanja)

한국어문회 배정한자(3·4급)와 기출문제를 **지식 그래프**로 잇는 학습 웹앱.
글자(훈·음·부수·획수)를 중심으로 **단어 · 유의/반의자 · 이체/약자 · 동음 · 동부수 · 기출**을
연결해 탐색하며 공부한다.

## 구조

```
docs/                 원본 자료 (배정한자 PDF, 기출 HWP[배포용])
scripts/              파이썬 추출/가공 파이프라인
  extract_hanja.py    배정한자 PDF -> 글자/훈/음
  enrich.py           Unihan -> 부수/획수 보강
  hwp_decrypt.py      배포용 HWP 복호화 (ViewText)
  parse_exams.py      기출 문제/정답 구조화
  build_graph.py      그래프 데이터 빌드
data/
  hanja/<n>geup.json  글자 데이터
  exams/*.json        회차별 기출
  graph/<n>.json      최종 그래프 데이터 (앱이 사용)
app/ components/ lib/  Next.js 그래프 시각화 앱
public/data/          앱이 fetch 하는 그래프 데이터
docs-dev/             개발 문서 (배포용 문서 복호화 설명 등)
```

## 데이터 파이프라인 (재생성)

```bash
python scripts/extract_hanja.py   # PDF -> 글자/훈/음
python scripts/enrich.py          # 부수/획수 보강 (data/Unihan.zip 필요)
python scripts/parse_exams.py     # 기출 HWP 복호화 + 구조화
python scripts/build_graph.py     # 그래프 데이터 생성
cp data/graph/*.json public/data/ # 앱에 반영
```

## 앱 실행

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

급수(3급/4급)를 고르고, 한자·음·훈으로 검색한 뒤 노드를 클릭하며 관계를 따라간다.
'동음'·'동부수' 토글로 같은 소리/부수 글자 묶음을 그래프에 펼칠 수 있다.

## 기출 자료 주의

`docs/`의 기출 HWP는 한글 **배포용(읽기 전용·암호화) 문서**다. 본인 학습 목적의
데이터화를 위해 복호화 절차를 구현했다 — [docs-dev/배포용문서-복호화.md](docs-dev/배포용문서-복호화.md).
