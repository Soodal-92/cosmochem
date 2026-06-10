# CosmoChem

화장품 원료 합성을 위한 **컴퓨터 보조 설계·분석 플랫폼**.

물질 선정부터 반응조건·정제·수율 재현·구조 확인·효능 스크리닝까지, 합성 워크플로를
한 곳에서 다루는 것을 목표로 합니다.

> **범위에 대한 솔직한 정의**
> 이 프로젝트는 반응을 처음부터 물리적으로 시뮬레이션하는 도구가 아니라,
> cheminformatics·통계·도킹을 활용한 **의사결정 지원(decision-support) 플랫폼**입니다.
> 계산 결과(특히 logP·TPSA·효능)는 추정·스크리닝 용도이며, in-vitro 검증이 전제입니다.

---

## 현재 상태

| 단계 | 내용 | 상태 |
|------|------|------|
| **Phase A** | 브라우저 프로토타입 — 물질 선정 + 구조 분석 (SMILES → 분자식·질량·descriptor·해석) | ✅ 동작 |
| **Phase B** | FastAPI + RDKit 백엔드 — 정밀 descriptor, DOE, 통계 | ⬜ 예정 |
| **Phase C** | 작업 큐 기반 비동기 계산 — docking(Vina), QSAR, 후보 랭킹 | ⬜ 예정 |

`prototype/index.html` 을 브라우저로 열면 Phase A가 바로 실행됩니다. 설치 불필요.

---

## 모듈

1. **물질 선정 · 구조 확인** — RDKit 기반 구조·descriptor, 부분구조/유사도 검색
2. **반응조건 세팅** — DOE(실험계획) + 베이지안 최적화, 역합성 추천
3. **정제법 세팅** — 물성(logP·극성·pKa) 기반 룰 엔진
4. **수율 · 재현실험** — 배치 로깅 + 통계 분석 (LabNote 연계)
5. **단계별 구조 분석** — fragment·exact mass·스펙트럼 확인 포인트
6. **효능 시뮬레이션** — 도킹·QSAR·ADMET·피부 투과 (스크리닝, 검증 필요)

---

## 아키텍처 (요약)

```
React + Tailwind  (프론트엔드 · JS)
        │
     FastAPI       (요청 라우터 · Python)
     ┌──┴──────────────┐
 빠른 경로(동기)     작업 큐(비동기, Phase C)
 단일 분자 즉시 응답   Redis · Celery/RQ → 계산 Worker
     └──────┬──────────┘
        Postgres / Supabase  (데이터)
```

핵심 원칙: **가벼운 작업은 동기로 즉시 응답, 무거운 작업(docking·batch)만 큐로.**
자세한 내용은 [`docs/architecture.md`](docs/architecture.md) 참고.

---

## 실행 방법

### Phase A — 프로토타입 (지금 동작)
```bash
# 그냥 브라우저로 열기
open prototype/index.html        # macOS
# 또는 로컬 서버
python -m http.server 8000       # http://localhost:8000/prototype/
```

### Phase B — 백엔드 (구현 예정)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload        # http://localhost:8000/docs
```

---

## 배포

- **프로토타입**: GitHub Pages (Settings → Pages → `/prototype` 또는 root)
- **프론트엔드(Phase B~)**: Vercel (GitHub 연동 자동 배포)
- **백엔드**: Railway / Render / Cloud Run (컨테이너)
- **데이터**: Supabase (Postgres + 인증 + 스토리지, RDKit 확장 활성화 가능)

---

## 로드맵

전체 단계별 계획은 [`docs/roadmap.md`](docs/roadmap.md) 참고.

## 라이선스

[MIT](LICENSE)
