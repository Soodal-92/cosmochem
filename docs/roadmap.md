# 로드맵

## Phase A — 물질 선정 + 구조 분석 (완료)

브라우저에서 동작하는 프로토타입. 백엔드 없음.

- [x] SMILES 파서 (분자식·정확질량·분자량·HBD/HBA·회전결합·고리수)
- [x] TPSA(Ertl 근사) · logP(간이 추정)
- [x] 화장품 관점 해석 (피부 투과·제형 적합성·게이지)
- [x] 기능성 카테고리별 단계 확인 체크리스트
- [x] 자주 쓰는 원료 프리셋 + 문헌값 비교

## Phase B — 정밀 계산 백엔드

FastAPI + RDKit. 프론트는 그대로, 추정값을 정밀값으로 교체.

- [x] FastAPI `/analyze` — RDKit 정밀 descriptor (동기)
- [x] PubChem 조회 연동 (백엔드 프록시 + 브라우저 직접 호출)
- [x] 프로토타입 → FastAPI /analyze 연동 (백엔드 켜져 있으면 RDKit 정밀값, 꺼져 있으면 JS 추정값 fallback)
- [x] DOE 설계·분석 (pyDOE + statsmodels) — 수율·재현 모듈
- [x] Supabase(Postgres) 데이터 계층 — compounds / doe_experiments 저장
- [x] 프론트엔드를 Vite + React로 이관, API 연동
- [ ] 저장 히스토리 고도화 — 상세 보기, 삭제, 검색/필터

## Phase C — 비동기 효능 계산

무거운 계산을 작업 큐로.

- [ ] Redis + Celery/RQ 작업 큐
- [ ] `/jobs/docking` — AutoDock Vina (Meeko 전처리)
- [ ] QSAR 모델 (scikit-learn/DeepChem) + ADMET(admet-ai)
- [ ] 후보 물질 다중 랭킹 + 진행률(SSE/폴링)
- [ ] 역합성 추천 (AiZynthFinder)

## 다음 한 걸음

Phase B 저장 히스토리: 저장된 화합물과 DOE 실험을 조회하고,
상세 보기·삭제·검색/필터를 추가.
