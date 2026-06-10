-- Development-only policies for anon-key access.
-- Preferred architecture: React -> FastAPI -> Supabase using SUPABASE_SERVICE_ROLE_KEY.
-- If the backend uses only SUPABASE_ANON_KEY during local prototyping, run these
-- in Supabase SQL Editor so FastAPI can insert and read rows with the anon role.

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
