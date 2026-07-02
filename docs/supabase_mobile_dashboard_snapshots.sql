create table if not exists public.mobile_dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_month text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_month)
);

alter table public.mobile_dashboard_snapshots enable row level security;

drop policy if exists "mobile_dashboard_snapshots_select_own" on public.mobile_dashboard_snapshots;
create policy "mobile_dashboard_snapshots_select_own"
on public.mobile_dashboard_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "mobile_dashboard_snapshots_insert_own" on public.mobile_dashboard_snapshots;
create policy "mobile_dashboard_snapshots_insert_own"
on public.mobile_dashboard_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "mobile_dashboard_snapshots_update_own" on public.mobile_dashboard_snapshots;
create policy "mobile_dashboard_snapshots_update_own"
on public.mobile_dashboard_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists mobile_dashboard_snapshots_user_updated_idx
on public.mobile_dashboard_snapshots(user_id, updated_at desc);
