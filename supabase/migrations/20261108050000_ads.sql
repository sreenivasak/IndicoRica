-- Phase 02 / 5: advertising. Image creatives + approved provider IDs only. No script storage.

create table if not exists public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null, contact_email text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);
create table if not exists public.ad_slots (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique check (slot_key ~ '^[a-z0-9_]+$'),
  label text not null, width int check (width > 0), height int check (height > 0),
  is_active boolean not null default true
);
-- Which ad networks are allowed at all: super admin only.
create table if not exists public.ad_providers (
  provider_key text primary key check (provider_key ~ '^[a-z0-9_]+$'),
  name text not null,
  approved boolean not null default false,
  reviewed_by uuid, reviewed_at timestamptz
);
-- Provider slot IDs are plain identifiers (no HTML/JS can be stored).
create table if not exists public.ad_provider_config (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.ad_providers(provider_key) on delete cascade,
  slot_id uuid not null references public.ad_slots(id) on delete cascade,
  provider_slot_id text not null check (provider_slot_id ~ '^[A-Za-z0-9_/-]{1,64}$'),
  enabled boolean not null default false,
  unique (provider_key, slot_id)
);
create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers(id) on delete cascade,
  image_path text not null check (image_path ~ '^[A-Za-z0-9_./-]+$'),
  alt_text text not null,
  click_url text not null check (click_url ~ '^https://'),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.ad_settings (   -- single row: global kill switch
  id boolean primary key default true check (id),
  ads_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.ad_settings(id) values (true) on conflict do nothing;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers(id) on delete cascade,
  creative_id uuid not null references public.ad_creatives(id) on delete restrict,
  slot_id uuid not null references public.ad_slots(id) on delete restrict,
  starts_on date not null, ends_on date not null,
  status text not null default 'draft' check (status in ('draft','approved','paused','ended')),
  disclosure_label text not null default 'Sponsored' check (disclosure_label in ('Sponsored','Ad','Advertisement')),
  targeting jsonb not null default '{}'::jsonb
    check (jsonb_typeof(targeting) = 'object' and (targeting - array['areas','categories','languages']) = '{}'::jsonb),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create table if not exists public.sponsored_listings (
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  primary key (campaign_id, business_id)
);

-- Provider config may only be enabled for an approved provider.
create or replace function private.guard_provider_config() returns trigger language plpgsql as $$
begin
  if new.enabled and not exists (select 1 from public.ad_providers p where p.provider_key = new.provider_key and p.approved) then
    raise exception 'ad provider % is not approved', new.provider_key using errcode = '23514';
  end if;
  return new;
end $$;
create or replace function private.stamp_provider_review() returns trigger language plpgsql as $$
begin
  if new.approved and (tg_op = 'INSERT' or not old.approved) then new.reviewed_by := (select auth.uid()); new.reviewed_at := now(); end if;
  return new;
end $$;
select private.mk_trigger('public.ad_provider_config', 'guard', 'before insert or update', 'private.guard_provider_config');
select private.mk_trigger('public.ad_providers', 'stamp', 'before insert or update', 'private.stamp_provider_review');
select private.mk_trigger('public.ad_providers', 'audit', 'after insert or update or delete', 'private.audit');
select private.mk_trigger('public.ad_provider_config', 'audit', 'after insert or update or delete', 'private.audit');
select private.mk_trigger('public.ad_campaigns', 'audit', 'after insert or update or delete', 'private.audit');
select private.mk_trigger('public.ad_settings', 'audit', 'after update', 'private.audit');

select private.rls('public.advertisers'); select private.rls('public.ad_slots');
select private.rls('public.ad_providers'); select private.rls('public.ad_provider_config');
select private.rls('public.ad_creatives'); select private.rls('public.ad_settings');
select private.rls('public.ad_campaigns'); select private.rls('public.sponsored_listings');

select private.mk_policy('public.advertisers', 'ad managers all', 'all', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');

select private.mk_policy('public.ad_slots', 'public read active', 'select', 'anon, authenticated', 'is_active or private.is_ad_manager()');
select private.mk_policy('public.ad_slots', 'ad managers write', 'all', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');

select private.mk_policy('public.ad_providers', 'public read approved', 'select', 'anon, authenticated', 'approved or private.is_ad_manager()');
select private.mk_policy('public.ad_providers', 'super admin write', 'all', 'authenticated', 'private.is_super_admin()', 'private.is_super_admin()');

select private.mk_policy('public.ad_provider_config', 'public read enabled', 'select', 'anon, authenticated', 'enabled or private.is_ad_manager()');
select private.mk_policy('public.ad_provider_config', 'ad managers write', 'all', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');

select private.mk_policy('public.ad_creatives', 'public read approved', 'select', 'anon, authenticated', $q$review_status = 'approved' or private.is_ad_manager()$q$);
select private.mk_policy('public.ad_creatives', 'ad managers write', 'all', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');

select private.mk_policy('public.ad_settings', 'public read', 'select', 'anon, authenticated', 'true');
select private.mk_policy('public.ad_settings', 'ad managers toggle', 'update', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');

-- Live campaigns: approved, in date, kill switch on, creative approved.
select private.mk_policy('public.ad_campaigns', 'public read live', 'select', 'anon, authenticated',
  $q$(status = 'approved' and current_date between starts_on and ends_on
      and (select ads_enabled from public.ad_settings)
      and exists (select 1 from public.ad_creatives c where c.id = creative_id and c.review_status = 'approved'))
     or private.is_ad_manager()$q$);
select private.mk_policy('public.ad_campaigns', 'ad managers write', 'all', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');

select private.mk_policy('public.sponsored_listings', 'public read live', 'select', 'anon, authenticated',
  $q$exists (select 1 from public.ad_campaigns c where c.id = campaign_id)
     and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published')$q$);
select private.mk_policy('public.sponsored_listings', 'ad managers write', 'all', 'authenticated', 'private.is_ad_manager()', 'private.is_ad_manager()');
