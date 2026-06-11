-- candidates 테이블: 후보 설계 결과 저장
-- Supabase SQL Editor에서 실행

create table if not exists public.candidates (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),

  -- 입력 컨텍스트
  input_smiles   text not null,
  input_name     text,
  target         text,

  -- 후보 기본 정보
  label          text,
  smiles         text not null,
  candidate_type text,
  confidence     text,

  -- 계산 결과 (JSON)
  descriptors    jsonb,
  scores         jsonb,
  compound_types jsonb,   -- classify_compound() 결과 배열

  -- 설계 계획 (JSON)
  synthesis         jsonb,
  purification_plan jsonb,
  analysis_plan     jsonb,
  rationale         jsonb
);

alter table public.candidates enable row level security;

-- ──────────────────────────────────────────────────────────────────────────────
-- 운영 구조: React → FastAPI (SUPABASE_SERVICE_ROLE_KEY) → Supabase
-- service_role은 RLS를 우회하므로 백엔드 동작에는 아래 정책이 필요 없습니다.
-- anon 에게는 최소 권한만 부여합니다 (개발 환경 직접 조회용 SELECT만 허용).
-- ──────────────────────────────────────────────────────────────────────────────

-- 개발용: anon SELECT (대시보드/SQL Editor 확인용)
drop policy if exists "Allow anonymous candidate reads"   on public.candidates;
drop policy if exists "Allow anonymous candidate inserts" on public.candidates;
drop policy if exists "Allow anonymous candidate deletes" on public.candidates;

create policy "dev: anon read-only"
on public.candidates for select to anon using (true);

-- 운영 환경에서는 위 policy도 drop하고 service_role 전용으로 전환하세요:
-- drop policy if exists "dev: anon read-only" on public.candidates;
