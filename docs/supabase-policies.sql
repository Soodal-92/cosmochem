-- ──────────────────────────────────────────────────────────────────────────────
-- 개발용 RLS 정책 (DEV ONLY)
-- 운영 구조: React → FastAPI (SUPABASE_SERVICE_ROLE_KEY) → Supabase
-- service_role은 RLS 우회 → 백엔드 동작에는 이 정책이 필요 없음.
-- 로컬 개발 중 SUPABASE_ANON_KEY만 쓸 때만 실행하세요.
-- 운영 배포 전에는 anon insert/delete 정책을 반드시 제거하세요.
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.compounds enable row level security;
alter table public.doe_experiments enable row level security;

drop policy if exists "Allow anonymous compound reads" on public.compounds;
drop policy if exists "Allow anonymous compound inserts" on public.compounds;
drop policy if exists "Allow anonymous DOE reads" on public.doe_experiments;
drop policy if exists "Allow anonymous DOE inserts" on public.doe_experiments;

create policy "Allow anonymous compound reads"
on public.compounds
for select
to anon
using (true);

create policy "Allow anonymous compound inserts"
on public.compounds
for insert
to anon
with check (true);

create policy "Allow anonymous DOE reads"
on public.doe_experiments
for select
to anon
using (true);

create policy "Allow anonymous DOE inserts"
on public.doe_experiments
for insert
to anon
with check (true);

drop policy if exists "Allow anonymous compound deletes"     on public.compounds;
drop policy if exists "Allow anonymous DOE deletes"          on public.doe_experiments;

-- 개발 편의용 삭제 허용 (운영 환경에서는 아래 두 policy 생성 금지)
create policy "dev: anon compound deletes"
on public.compounds
for delete
to anon
using (true);

create policy "dev: anon DOE deletes"
on public.doe_experiments
for delete
to anon
using (true);
