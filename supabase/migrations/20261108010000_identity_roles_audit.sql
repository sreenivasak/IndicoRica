-- Phase 02 / 1: identity, roles, audit, and shared helper functions.
-- Idempotent: safe to re-run.

create schema if not exists private;  -- NOT exposed through the API
grant usage on schema private to anon, authenticated;

do $$ begin create type public.app_role as enum
  ('contributor','editor','ad_manager','content_admin','super_admin');
exception when duplicate_object then null; end $$;

do $$ begin create type public.content_status as enum
  ('draft','in_review','published','archived','trashed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- helpers
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create or replace function private.try_uuid(t text) returns uuid
language plpgsql immutable as $$ begin return t::uuid; exception when others then return null; end $$;

create table if not exists public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Role checks are SECURITY DEFINER so policies on user_roles itself cannot recurse.
create or replace function private.has_any_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid()) and role = any(roles)) $$;

create or replace function private.is_super_admin() returns boolean
language sql stable as $$ select private.has_any_role(array['super_admin']::public.app_role[]) $$;
create or replace function private.is_content_admin() returns boolean
language sql stable as $$ select private.has_any_role(array['content_admin','super_admin']::public.app_role[]) $$;
create or replace function private.is_editor() returns boolean
language sql stable as $$ select private.has_any_role(array['editor','content_admin','super_admin']::public.app_role[]) $$;
create or replace function private.is_ad_manager() returns boolean
language sql stable as $$ select private.has_any_role(array['ad_manager','super_admin']::public.app_role[]) $$;
create or replace function private.is_contributor_plus() returns boolean
language sql stable as $$ select private.has_any_role(array['contributor','editor','content_admin','super_admin']::public.app_role[]) $$;
create or replace function private.is_staff() returns boolean
language sql stable as $$ select private.has_any_role(array['contributor','editor','ad_manager','content_admin','super_admin']::public.app_role[]) $$;

-- Dynamic helpers used by migrations only (never callable by API roles).
create or replace function private.rls(tbl regclass) returns void language plpgsql as $$
begin execute format('alter table %s enable row level security', tbl); end $$;

create or replace function private.mk_policy(tbl regclass, pname text, cmd text, roles text,
                                             using_expr text, check_expr text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on %s', pname, tbl);
  execute format('create policy %I on %s for %s to %s %s %s', pname, tbl, cmd, roles,
    case when using_expr is not null then format('using (%s)', using_expr) else '' end,
    case when check_expr is not null then format('with check (%s)', check_expr) else '' end);
end $$;

create or replace function private.mk_trigger(tbl regclass, tname text, timing_events text, fn text)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists %I on %s', tname, tbl);
  execute format('create trigger %I %s on %s for each row execute function %s()', tname, timing_events, tbl, fn);
end $$;

-- ------------------------------------------------------------ audit log
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  action     text not null,
  table_name text not null,
  row_id     text,
  detail     jsonb
);

create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  insert into public.audit_log(actor, action, table_name, row_id, detail)
  values ((select auth.uid()), tg_op, tg_table_name,
          coalesce(j->>'id', (j->>'user_id') || ':' || (j->>'role'), j->>'business_id'),
          jsonb_build_object('old', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
                             'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end));
  return null;
end $$;

-- ------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_path        text,
  preferred_language text not null default 'en' check (preferred_language in ('en','es')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Private contact data: owner only, consent-based; never readable by staff via the API.
create table if not exists public.profile_private (
  id         uuid primary key references public.profiles(id) on delete cascade,
  phone      text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  updated_at timestamptz not null default now()
);

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Roles can only be assigned by a super admin; granted_by is stamped by the DB, not the client.
create or replace function private.stamp_grant() returns trigger language plpgsql as $$
begin new.granted_by := (select auth.uid()); new.granted_at := now(); return new; end $$;

select private.mk_trigger('public.user_roles', 'stamp_grant', 'before insert', 'private.stamp_grant');
select private.mk_trigger('public.user_roles', 'audit_roles', 'after insert or update or delete', 'private.audit');
select private.mk_trigger('public.profiles', 'touch', 'before update', 'private.set_updated_at');
select private.mk_trigger('public.profile_private', 'touch', 'before update', 'private.set_updated_at');

-- -------------------------------------------------------------- RLS
select private.rls('public.user_roles');
select private.rls('public.audit_log');
select private.rls('public.profiles');
select private.rls('public.profile_private');

select private.mk_policy('public.user_roles', 'read own or super admin', 'select', 'authenticated',
  'user_id = (select auth.uid()) or private.is_super_admin()');
select private.mk_policy('public.user_roles', 'super admin grants', 'insert', 'authenticated',
  null, 'private.is_super_admin()');
select private.mk_policy('public.user_roles', 'super admin revokes', 'delete', 'authenticated',
  'private.is_super_admin()');

select private.mk_policy('public.audit_log', 'admins read audit', 'select', 'authenticated',
  'private.is_content_admin()');

select private.mk_policy('public.profiles', 'read own or staff', 'select', 'authenticated',
  'id = (select auth.uid()) or private.is_content_admin()');
select private.mk_policy('public.profiles', 'update own', 'update', 'authenticated',
  'id = (select auth.uid())', 'id = (select auth.uid())');

select private.mk_policy('public.profile_private', 'owner read', 'select', 'authenticated', 'id = (select auth.uid())');
select private.mk_policy('public.profile_private', 'owner insert', 'insert', 'authenticated', null, 'id = (select auth.uid())');
select private.mk_policy('public.profile_private', 'owner update', 'update', 'authenticated',
  'id = (select auth.uid())', 'id = (select auth.uid())');
select private.mk_policy('public.profile_private', 'owner delete', 'delete', 'authenticated', 'id = (select auth.uid())');

-- app_settings_public (phase 01): content admins may now edit; public stays read-only.
select private.mk_policy('public.app_settings_public', 'content admins insert', 'insert', 'authenticated',
  null, 'private.is_content_admin()');
select private.mk_policy('public.app_settings_public', 'content admins update', 'update', 'authenticated',
  'private.is_content_admin()', 'private.is_content_admin()');

-- Private admin settings (never public).
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
select private.rls('public.app_settings');
select private.mk_policy('public.app_settings', 'content admins all', 'all', 'authenticated',
  'private.is_content_admin()', 'private.is_content_admin()');

-- Helper execution rights: API roles may run only the role checks used by policies.
revoke execute on all functions in schema private from public;
grant execute on function private.has_any_role(public.app_role[]), private.is_super_admin(),
  private.is_content_admin(), private.is_editor(), private.is_ad_manager(),
  private.is_contributor_plus(), private.is_staff(), private.try_uuid(text) to anon, authenticated;

-- Triggers that restrict "ordinary" writers apply only to the public API roles. Trusted server-side
-- access (service role) and admin SQL run as other roles and are not downgraded by those triggers.
create or replace function private.is_api_role() returns boolean
language sql stable as $$ select current_user in ('anon', 'authenticated') $$;
grant execute on function private.is_api_role() to anon, authenticated;
