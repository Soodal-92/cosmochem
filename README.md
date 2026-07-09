# CosmoChem

화장품 원료 합성과 소재 개발을 위한 **컴퓨터 보조 설계·분석 의사결정 지원 플랫폼**입니다.

물질 선정, 구조 확인, 반응조건 검토, 정제 전략, 수율 관리, 효능 스크리닝까지 이어지는 R&D 업무 흐름을 데이터 기반으로 정리하는 것을 목표로 합니다.

> 이 프로젝트는 반응을 물리적으로 완전 예측하는 시뮬레이터가 아니라, cheminformatics, 통계, 도킹, 실험 데이터 관리를 활용한 **decision-support platform**입니다. 계산 결과는 후보 선별과 가설 수립을 위한 참고값이며, 최종 판단은 실험 검증을 전제로 합니다.

---

## 1. 프로젝트 배경

화장품 원료 개발에서는 후보 물질 선정, 합성 가능성 검토, 물성 예측, 정제 전략, 구조 확인, 효능 평가가 서로 연결되어 있습니다. 하지만 실제 업무에서는 문헌, 엑셀, 실험노트, 분석 결과가 분산되어 있어 후보 물질 간 비교와 재현 실험 관리가 어렵습니다.

CosmoChem은 이런 문제를 줄이기 위해 아래 기능을 목표로 설계했습니다.

- 후보 물질의 구조와 기본 descriptor 확인
- SMILES 기반 분자식, 분자량, logP, TPSA 등 기초 정보 정리
- 실험 조건과 결과를 함께 기록
- 물성 기반 정제 전략 검토
- 반복 실험과 수율 추이를 데이터로 관리
- docking, QSAR, ADMET 등은 후보 스크리닝 관점으로 확장

---

## 2. 현재 상태

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase A | 브라우저 프로토타입 — 물질 선정, 구조 분석, descriptor 확인 | 동작 |
| Phase B | FastAPI + RDKit 백엔드 — 정밀 descriptor, PubChem 연동, DOE, 통계 | 진행 중 |
| Phase C | 작업 큐 기반 비동기 계산 — docking, QSAR, 후보 랭킹 | 예정 |

`prototype/index.html`을 브라우저로 열면 Phase A 프로토타입을 바로 실행할 수 있습니다.

---

## 3. 주요 모듈

### 물질 선정 / 구조 확인

- SMILES 입력 기반 구조 확인
- 분자식, 분자량, descriptor 계산
- 부분구조 및 유사도 검색 구상
- 후보 물질 비교 테이블

### 반응조건 검토

- DOE 기반 조건 비교 구조
- 반응 변수와 결과값 기록
- 조건 변경 이력 관리
- 수율 및 재현성 비교

### 정제 전략 검토

- logP, 극성, pKa 등 물성 기반 정제 방향 제안
- 용매 / 석출 / 컬럼 조건 검토 메모
- 정제 단계별 결과 기록

### 분석 / 구조 확인

- exact mass, fragment, spectrum 확인 포인트 정리
- 단계별 분석 결과 연결
- 실험 결과와 분석 결과의 추적성 확보

### 효능 스크리닝

- docking, QSAR, ADMET 기반 후보 랭킹 구상
- 피부 투과, 활성 가능성 등은 참고 지표로 사용
- in-vitro 검증 전 후보 선별용으로 제한

---

## 4. 아키텍처 요약

```text
React + Tailwind
        │
        ▼
FastAPI
        │
 ┌──────┴────────┐
 │               │
동기 계산        비동기 작업 큐
단일 분자 응답    docking / batch 계산
 │               │
 └──────┬────────┘
        ▼
Postgres / Supabase
```

핵심 원칙은 다음과 같습니다.

- 가벼운 descriptor 계산은 동기 응답
- docking, batch 계산처럼 무거운 작업은 큐 기반 비동기 처리
- 실험 결과와 계산 결과를 같은 프로젝트 단위로 관리
- 최종 판단은 계산값이 아니라 실험 검증을 기준으로 수행

---

## 5. 기술 스택

| 구분 | 사용 기술 |
|---|---|
| Prototype | HTML, JavaScript |
| Frontend | React, Tailwind CSS |
| Backend | FastAPI, Python |
| Cheminformatics | RDKit |
| Queue | Redis, Celery 또는 RQ |
| Database | Postgres / Supabase |
| Deploy | GitHub Pages, Vercel, Railway / Render / Cloud Run |

---

## 6. 실행 방법

### Phase A — 브라우저 프로토타입

```bash
# macOS 예시
open prototype/index.html

# 또는 로컬 서버 실행
python -m http.server 8000
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:8000/prototype/
```

### Phase B — FastAPI 백엔드

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API 문서는 아래 주소에서 확인할 수 있습니다.

```text
http://localhost:8000/docs
```

---

## 7. 포트폴리오 관점의 핵심 포인트

CosmoChem은 연구자가 직접 겪는 R&D 의사결정 문제를 도구화한 프로젝트입니다.

- 화장품 원료 개발 업무 흐름을 데이터 구조로 분해
- 화학 구조, 물성, 실험 조건, 분석 결과를 연결하는 방향으로 설계
- 계산값의 한계를 명확히 두고, 실험 검증 중심으로 해석
- 연구개발 경험과 웹/데이터 도구 제작 역량을 함께 보여주는 프로젝트
- 단순 웹앱이 아니라 R&D workflow decision-support 관점으로 확장 가능

---

## 8. 로드맵

- PubChem 연동
- RDKit descriptor 계산 고도화
- DOE 기반 조건 비교 UI
- 실험 결과 입력 및 수율 트렌드 관리
- 후보 물질 랭킹 기능
- docking / QSAR / ADMET 스크리닝 모듈
- LabNote 프로젝트와 연동

---

## 9. 주의 사항

이 프로젝트는 학습 및 포트폴리오 목적의 R&D 의사결정 지원 도구입니다. 계산 결과는 후보 선별과 가설 수립을 위한 참고값이며, 실제 제품 개발과 효능 판단에는 별도의 실험 검증이 필요합니다.

## License

MIT
