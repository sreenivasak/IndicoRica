create table if not exists public.app_settings_public (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings_public enable row level security;

-- Public read-only. No insert/update/delete policies => writes denied by RLS.
create policy "public can read app settings"
  on public.app_settings_public for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.app_settings_public from anon, authenticated;
