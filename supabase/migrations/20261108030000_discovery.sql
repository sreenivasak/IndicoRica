-- Phase 02 / 3: business directory, ownership, consent-based contacts, grocery finder.

do $$ begin create type public.verification_status as enum ('unverified','pending','verified','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  category_id uuid references public.categories(id) on delete set null,
  description text check (char_length(description) <= 4000),
  area text, city text, address_line text,
  website text check (website is null or website ~ '^https://'),
  is_grocery_supplier boolean not null default false,
  verification_status public.verification_status not null default 'unverified',
  verification_source text, verified_at timestamptz, verified_by uuid,
  is_demo boolean not null default false,
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists businesses_status_city on public.businesses(status, city);
create index if not exists businesses_category on public.businesses(category_id);

create table if not exists public.business_owners (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  evidence_note text check (char_length(evidence_note) <= 1000),
  requested_at timestamptz not null default now(),
  verified_by uuid, verified_at timestamptz,
  primary key (business_id, user_id)
);

-- Only VERIFIED owners count. Definer so it can read business_owners regardless of caller RLS.
create or replace function private.owns_business(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_owners o
                 where o.business_id = b and o.user_id = (select auth.uid()) and o.status = 'verified') $$;
grant execute on function private.owns_business(uuid) to anon, authenticated;

-- Contacts live in their own table so a row can never leak private details by accident.
create table if not exists public.business_contacts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ()-]{6,20}$'),
  email text check (email is null or email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
  public_consent boolean not null default false,
  consent_by uuid, consent_at timestamptz,
  check (not public_consent or consent_at is not null)
);

create or replace function private.stamp_consent() returns trigger language plpgsql as $$
begin
  if new.public_consent and (tg_op = 'INSERT' or not old.public_consent) then
    new.consent_by := (select auth.uid()); new.consent_at := now();
  elsif not new.public_consent then
    new.consent_by := null; new.consent_at := null;
  end if;
  return new;
end $$;

create table if not exists public.business_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null check (char_length(alt_text) between 1 and 200),
  position int not null default 0,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  check (storage_path like business_id::text || '/%')
);

create table if not exists public.business_hours (
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time, closes time,
  primary key (business_id, weekday)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text,
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.ingredient_suppliers (
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  primary key (ingredient_id, business_id)
);

-- Dated evidence only; nothing is shown as "in stock" without an approved, dated observation.
create table if not exists public.availability_evidence (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  observed_on date not null check (observed_on <= current_date),
  source_type text not null check (source_type in ('owner_report','staff_visit','member_tip','website')),
  source_note text check (char_length(source_note) <= 500),
  source_url text check (source_url is null or source_url ~ '^https://'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by uuid default auth.uid(),
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists availability_lookup on public.availability_evidence(ingredient_id, business_id, observed_on desc);

-- Business field protection: non-editors cannot touch verification, slug, authorship, demo flag, images approval.
create or replace function private.protect_business() returns trigger language plpgsql as $$
begin
  if (private.is_api_role() and not private.is_editor()) then
    if tg_op = 'INSERT' then
      new.verification_status := 'unverified'; new.verified_at := null; new.verified_by := null;
      new.verification_source := null; new.is_demo := false;
    else
      new.verification_status := old.verification_status; new.verified_at := old.verified_at;
      new.verified_by := old.verified_by; new.verification_source := old.verification_source;
      new.slug := old.slug; new.created_by := old.created_by; new.is_demo := old.is_demo;
    end if;
  elsif new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := now(); new.verified_by := (select auth.uid());
    if new.verification_source is null then
      raise exception 'verification_source is required to mark a business verified' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create or replace function private.protect_image() returns trigger language plpgsql as $$
begin if (private.is_api_role() and not private.is_editor()) then new.is_approved := false; end if; return new; end $$;

create or replace function private.protect_owner_claim() returns trigger language plpgsql as $$
begin
  if (private.is_api_role() and not private.is_editor()) then
    if tg_op = 'INSERT' then new.status := 'pending'; new.verified_by := null; new.verified_at := null; end if;
  elsif new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    new.verified_by := (select auth.uid()); new.verified_at := now();
  end if;
  return new;
end $$;

create or replace function private.protect_evidence() returns trigger language plpgsql as $$
begin
  if (private.is_api_role() and not private.is_editor()) then
    new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
    new.submitted_by := (select auth.uid());
  elsif new.status <> 'pending' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.reviewed_by := (select auth.uid()); new.reviewed_at := now();
  end if;
  return new;
end $$;

-- Triggers
select private.editorial_table('public.businesses');   -- sets RLS, base policies, workflow, touch
select private.editorial_table('public.ingredients');
select private.mk_trigger('public.businesses', 'protect', 'before insert or update', 'private.protect_business');
select private.mk_trigger('public.businesses', 'audit', 'after insert or update or delete', 'private.audit');
select private.mk_trigger('public.business_contacts', 'consent', 'before insert or update', 'private.stamp_consent');
select private.mk_trigger('public.business_images', 'protect', 'before insert or update', 'private.protect_image');
select private.mk_trigger('public.business_owners', 'protect', 'before insert or update', 'private.protect_owner_claim');
select private.mk_trigger('public.business_owners', 'audit', 'after insert or update or delete', 'private.audit');
select private.mk_trigger('public.availability_evidence', 'protect', 'before insert or update', 'private.protect_evidence');

-- Businesses: verified owners may edit their own listing (status/verification protected by triggers).
select private.mk_policy('public.businesses', 'owners read own', 'select', 'authenticated', 'private.owns_business(id)');
select private.mk_policy('public.businesses', 'owners update own', 'update', 'authenticated',
  'private.owns_business(id)', 'private.owns_business(id)');

select private.rls('public.business_owners'); select private.rls('public.business_contacts');
select private.rls('public.business_images'); select private.rls('public.business_hours');
select private.rls('public.ingredient_suppliers'); select private.rls('public.availability_evidence');

-- Ownership claims: members may only file their own PENDING claim; editors verify.
select private.mk_policy('public.business_owners', 'read own claims or editor', 'select', 'authenticated',
  'user_id = (select auth.uid()) or private.is_editor()');
select private.mk_policy('public.business_owners', 'members file pending claim', 'insert', 'authenticated', null,
  $q$user_id = (select auth.uid()) and status = 'pending'$q$);
select private.mk_policy('public.business_owners', 'editors verify', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.business_owners', 'members withdraw pending claim', 'delete', 'authenticated',
  $q$(user_id = (select auth.uid()) and status = 'pending') or private.is_editor()$q$);

-- Contacts: public only with recorded consent AND published business.
select private.mk_policy('public.business_contacts', 'public read consented', 'select', 'anon, authenticated',
  $q$(public_consent and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
     or private.owns_business(business_id) or private.is_editor()$q$);
select private.mk_policy('public.business_contacts', 'owner or editor insert', 'insert', 'authenticated', null,
  'private.owns_business(business_id) or private.is_editor()');
select private.mk_policy('public.business_contacts', 'owner or editor update', 'update', 'authenticated',
  'private.owns_business(business_id) or private.is_editor()', 'private.owns_business(business_id) or private.is_editor()');
select private.mk_policy('public.business_contacts', 'owner or editor delete', 'delete', 'authenticated',
  'private.owns_business(business_id) or private.is_editor()');

-- Images: public only if approved and business published.
select private.mk_policy('public.business_images', 'public read approved', 'select', 'anon, authenticated',
  $q$(is_approved and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
     or private.owns_business(business_id) or private.is_editor()$q$);
select private.mk_policy('public.business_images', 'owner or editor write', 'all', 'authenticated',
  'private.owns_business(business_id) or private.is_editor()', 'private.owns_business(business_id) or private.is_editor()');

select private.mk_policy('public.business_hours', 'public read published', 'select', 'anon, authenticated',
  $q$exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published')
     or private.owns_business(business_id) or private.is_editor()$q$);
select private.mk_policy('public.business_hours', 'owner or editor write', 'all', 'authenticated',
  'private.owns_business(business_id) or private.is_editor()', 'private.owns_business(business_id) or private.is_editor()');

select private.mk_policy('public.ingredient_suppliers', 'public read published', 'select', 'anon, authenticated',
  $q$exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published') or private.is_editor()$q$);
select private.mk_policy('public.ingredient_suppliers', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');

-- Evidence: anonymous sees approved only; members can submit pending tips; editors review.
select private.mk_policy('public.availability_evidence', 'public read approved', 'select', 'anon, authenticated',
  $q$(status = 'approved' and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
     or submitted_by = (select auth.uid()) or private.is_editor()$q$);
select private.mk_policy('public.availability_evidence', 'members submit tips', 'insert', 'authenticated', null,
  $q$submitted_by = (select auth.uid()) and status = 'pending'$q$);
select private.mk_policy('public.availability_evidence', 'editors review', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.availability_evidence', 'own pending delete', 'delete', 'authenticated',
  $q$(submitted_by = (select auth.uid()) and status = 'pending') or private.is_editor()$q$);

-- Editors may record evidence from verified staff visits directly.
select private.mk_policy('public.availability_evidence', 'editors insert', 'insert', 'authenticated', null, 'private.is_editor()');
