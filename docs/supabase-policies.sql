-- Development-only policies for the unauthenticated browser prototype.
-- Run these in Supabase SQL Editor if the app has no auth yet.

alter table public.compounds enable row level security;
alter table public.doe_experiments enable row level security;

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
