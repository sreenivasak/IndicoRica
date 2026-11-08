-- Phase 02 / 2: editorial content with draft -> review -> publish workflow, revisions, trash.

-- Workflow: only editors can publish/archive/trash; contributors stay in draft/in_review.
create or replace function private.enforce_workflow() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status in ('published','archived','trashed') and (private.is_api_role() and not private.is_editor()) then
      raise exception 'only editors can set status %', new.status using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and (private.is_api_role() and not private.is_editor()) then
    new.published_at := old.published_at;
    new.deleted_at   := old.deleted_at;
    new.deleted_by   := old.deleted_by;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  if new.status = 'trashed' and (tg_op = 'INSERT' or old.status is distinct from 'trashed') then
    new.deleted_at := now(); new.deleted_by := (select auth.uid());
  elsif new.status <> 'trashed' then
    new.deleted_at := null; new.deleted_by := null;
  end if;
  return new;
end $$;

-- Standard editorial table setup: RLS + policies + triggers.
create or replace function private.editorial_table(tbl regclass) returns void language plpgsql as $$
begin
  perform private.rls(tbl);
  perform private.mk_policy(tbl, 'read published or own or editor', 'select', 'anon, authenticated',
    $q$status = 'published' or private.is_editor() or created_by = (select auth.uid())$q$);
  perform private.mk_policy(tbl, 'editors insert', 'insert', 'authenticated', null, 'private.is_editor()');
  perform private.mk_policy(tbl, 'editors update', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');
  perform private.mk_policy(tbl, 'contributors insert drafts', 'insert', 'authenticated', null,
    $q$private.is_contributor_plus() and created_by = (select auth.uid()) and status in ('draft','in_review')$q$);
  perform private.mk_policy(tbl, 'contributors update own drafts', 'update', 'authenticated',
    $q$private.is_contributor_plus() and created_by = (select auth.uid()) and status in ('draft','in_review')$q$,
    $q$private.is_contributor_plus() and created_by = (select auth.uid()) and status in ('draft','in_review')$q$);
  perform private.mk_policy(tbl, 'super admin hard delete', 'delete', 'authenticated', 'private.is_super_admin()');
  perform private.mk_trigger(tbl, 'workflow', 'before insert or update', 'private.enforce_workflow');
  perform private.mk_trigger(tbl, 'touch', 'before update', 'private.set_updated_at');
end $$;
revoke execute on function private.editorial_table(regclass), private.enforce_workflow() from public;

-- Common column block is repeated per table (explicit > clever).
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('article','business','ingredient')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  meta_description text check (char_length(meta_description) <= 300),
  locale text not null default 'en' check (locale in ('en','es')),
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  position int not null default 0,
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  summary text check (char_length(summary) <= 500),
  body text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  locale text not null default 'en' check (locale in ('en','es')),
  is_high_stakes boolean not null default false,   -- legal/immigration/tax/driving
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','reviewed','needs_update')),
  last_reviewed_at date,
  reviewed_by uuid,
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

create table if not exists public.editorial_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  title text not null,
  publisher text,
  url text not null check (url ~ '^https://'),
  accessed_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists editorial_sources_article on public.editorial_sources(article_id);

create table if not exists public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  version int not null,
  title text not null, summary text, body text not null,
  status public.content_status not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (article_id, version)
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null, answer text not null,
  article_id uuid references public.articles(id) on delete set null,
  position int not null default 0,
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique check (from_path ~ '^/[^ ]*$'),
  to_path text not null check (to_path ~ '^(/|https://)[^ ]*$'),
  status_code smallint not null default 301 check (status_code in (301,302)),
  created_at timestamptz not null default now()
);

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  menu text not null check (menu in ('header','footer')),
  label text not null,
  href text not null check (href ~ '^(/|https://)[^ ]*$'),
  position int not null default 0,
  is_visible boolean not null default true
);

-- Standard workflow tables
select private.editorial_table('public.pages');
select private.editorial_table('public.site_sections');
select private.editorial_table('public.articles');
select private.editorial_table('public.faqs');

-- High-stakes articles need a completed review and at least one official source to publish.
create or replace function private.articles_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.is_high_stakes then
    if new.review_status <> 'reviewed' or new.last_reviewed_at is null then
      raise exception 'high-stakes article needs completed editorial review before publishing' using errcode = '23514';
    end if;
    if not exists (select 1 from public.editorial_sources s where s.article_id = new.id) then
      raise exception 'high-stakes article needs at least one cited source before publishing' using errcode = '23514';
    end if;
  end if;
  -- only editors may mark an article reviewed
  if (tg_op = 'INSERT' or new.review_status is distinct from old.review_status
      or new.last_reviewed_at is distinct from old.last_reviewed_at) and (private.is_api_role() and not private.is_editor()) then
    if tg_op = 'INSERT' then new.review_status := 'unreviewed'; new.last_reviewed_at := null; new.reviewed_by := null;
    else new.review_status := old.review_status; new.last_reviewed_at := old.last_reviewed_at; new.reviewed_by := old.reviewed_by; end if;
  elsif new.review_status = 'reviewed' and (tg_op = 'INSERT' or old.review_status is distinct from 'reviewed') then
    new.reviewed_by := (select auth.uid());
  end if;
  return new;
end $$;
select private.mk_trigger('public.articles', 'guard', 'before insert or update', 'private.articles_guard');

-- Revisions (written by the database, never by clients).
create or replace function private.record_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or (new.title, new.summary, new.body, new.status)
       is distinct from (old.title, old.summary, old.body, old.status) then
    insert into public.article_revisions(article_id, version, title, summary, body, status, created_by)
    select new.id, coalesce(max(version), 0) + 1, new.title, new.summary, new.body, new.status, (select auth.uid())
    from public.article_revisions where article_id = new.id;
  end if;
  return null;
end $$;
select private.mk_trigger('public.articles', 'revision', 'after insert or update', 'private.record_revision');

-- Auxiliary tables
select private.rls('public.categories'); select private.rls('public.tags');
select private.rls('public.article_tags'); select private.rls('public.editorial_sources');
select private.rls('public.article_revisions'); select private.rls('public.redirects');
select private.rls('public.navigation_items');

select private.mk_policy('public.categories', 'public read', 'select', 'anon, authenticated', 'true');
select private.mk_policy('public.categories', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.tags', 'public read', 'select', 'anon, authenticated', 'true');
select private.mk_policy('public.tags', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.redirects', 'public read', 'select', 'anon, authenticated', 'true');
select private.mk_policy('public.redirects', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.navigation_items', 'public read visible', 'select', 'anon, authenticated', 'is_visible or private.is_editor()');
select private.mk_policy('public.navigation_items', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');

select private.mk_policy('public.article_tags', 'read for visible articles', 'select', 'anon, authenticated',
  'exists (select 1 from public.articles a where a.id = article_id)');
select private.mk_policy('public.article_tags', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');

select private.mk_policy('public.editorial_sources', 'read for visible articles', 'select', 'anon, authenticated',
  'exists (select 1 from public.articles a where a.id = article_id)');
select private.mk_policy('public.editorial_sources', 'editors write', 'all', 'authenticated', 'private.is_editor()', 'private.is_editor()');

select private.mk_policy('public.article_revisions', 'staff read', 'select', 'authenticated', 'private.is_staff()');
