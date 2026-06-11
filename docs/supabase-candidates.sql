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

drop policy if exists "Allow anonymous candidate reads"   on public.candidates;
drop policy if exists "Allow anonymous candidate inserts" on public.candidates;

create policy "Allow anonymous candidate reads"
on public.candidates for select to anon using (true);

create policy "Allow anonymous candidate inserts"
on public.candidates for insert to anon with check (true);
