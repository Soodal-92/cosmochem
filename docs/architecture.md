# 아키텍처

## 언어 구성

| 영역 | 언어/도구 | 이유 |
|------|-----------|------|
| 과학 계산 코어 | **Python** | RDKit·Vina·scikit-learn·pyDOE 등 cheminformatics 생태계가 전부 Python |
| 인터페이스 | **React + Tailwind** | 기존 사용 스택, 화면·인터랙션에 최적 |
| API 계층 | **FastAPI** | Python·비동기·자동 문서화(Pydantic), ML/과학 API 표준 |
| 데이터 | **PostgreSQL / Supabase** | 분자 부분구조·유사도 검색(RDKit 카트리지) 지원. Firestore는 구조 검색 불가 |
| 작업 큐 | **Redis + Celery/RQ** | 분 단위 무거운 작업(docking·batch)을 비동기 처리 |

## 동기 / 비동기 분기 (핵심 설계)

FastAPI는 단순 통로가 아니라 **라우터**다. 요청을 비용에 따라 나눈다.

- **빠른 경로(동기)** — 단일 분자 descriptor 등 수 밀리초 작업. 요청 안에서 바로 계산해 응답.
- **느린 경로(비동기)** — docking 1건, QSAR batch, 후보 100개 랭킹 등 초~분 단위.
  큐에 등록 → `job_id` 반환 → 프론트가 폴링/SSE로 진행률·결과 조회.

> 기준: **1~2초 안에 안정적으로 못 끝나면 비동기.**
> 모든 걸 큐로 보내면 즉답할 일을 폴링으로 만들어 UX·복잡도가 나빠진다.

Postgres는 체인 끝이 아니라 **API와 Worker 양쪽이 접근**한다
(API: 작업 상태·빠른 조회 / Worker: 결과 저장).

## 모듈별 도구 매핑

| 모듈 | 핵심 도구 | 경로 |
|------|-----------|------|
| 물질 선정·구조 확인 | RDKit, Postgres+RDKit 카트리지 | 동기 |
| 반응조건 세팅 | pyDOE, Ax/BoTorch(베이지안 최적화), AiZynthFinder/ASKCOS | 혼합 |
| 정제법 세팅 | RDKit 물성 기반 룰 엔진 | 동기 |
| 수율·재현 | pandas, statsmodels, scipy.stats | 동기 |
| 단계별 구조 분석 | RDKit(fragment·exact mass), nmrglue | 동기 |
| 효능 시뮬레이션 | AutoDock Vina(+Meeko/Open Babel), DeepChem/scikit-learn QSAR, admet-ai | **비동기** |

피부 투과는 Potts-Guy 식처럼 간단한 건 동기로 즉시 계산 가능:
`logKp = -2.7 + 0.71·logP − 0.0061·MW`

## 단계별 인프라

- **Phase A**: 백엔드 0원. 브라우저 프로토타입만.
- **Phase B**: FastAPI 컨테이너 1개 + Postgres. 큐 불필요.
- **Phase C**: docking 도입 시점에 Redis + Worker 추가.

> 연구실 단위 도구이므로 마이크로서비스·k8s는 불필요.
> FastAPI 컨테이너 + Postgres + Worker 하나면 충분하다.
