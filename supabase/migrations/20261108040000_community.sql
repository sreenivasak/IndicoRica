-- Phase 02 / 4: community Q&A, moderation, reports, favorites, events.

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists answers_question on public.answers(question_id);

create table if not exists public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('questions','answers','event_submissions','availability_evidence','business_owners')),
  target_id text not null,
  decision text not null check (decision in ('approve','reject','remove','restore')),
  reason text check (char_length(reason) <= 1000),
  decided_by uuid default auth.uid(),
  decided_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_table text not null check (target_table in ('questions','answers','businesses','articles','events')),
  target_id text not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  description text check (char_length(description) <= 4000),
  starts_at timestamptz not null, ends_at timestamptz,
  location text, link text check (link is null or link ~ '^https://'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text,
  starts_at timestamptz not null, ends_at timestamptz,
  location text, link text check (link is null or link ~ '^https://'),
  source_submission_id uuid references public.event_submissions(id) on delete set null,
  status public.content_status not null default 'draft',
  published_at timestamptz, deleted_at timestamptz, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.editorial_table('public.events');

-- Members can never self-approve: moderation fields are controlled by editors only.
create or replace function private.protect_moderation() returns trigger language plpgsql as $$
begin
  if (private.is_api_role() and not private.is_editor()) then
    if tg_op = 'INSERT' then new.moderation_status := 'pending';
    else new.moderation_status := old.moderation_status; new.author_id := old.author_id; end if;
  end if;
  return new;
end $$;
create or replace function private.protect_submission() returns trigger language plpgsql as $$
begin
  if (private.is_api_role() and not private.is_editor()) then
    if tg_op = 'INSERT' then new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
    else new.status := old.status; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
         new.submitter_id := old.submitter_id; end if;
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    new.reviewed_by := (select auth.uid()); new.reviewed_at := now();
  end if;
  return new;
end $$;
select private.mk_trigger('public.questions', 'protect', 'before insert or update', 'private.protect_moderation');
select private.mk_trigger('public.answers', 'protect', 'before insert or update', 'private.protect_moderation');
select private.mk_trigger('public.event_submissions', 'protect', 'before insert or update', 'private.protect_submission');
select private.mk_trigger('public.questions', 'touch', 'before update', 'private.set_updated_at');
select private.mk_trigger('public.answers', 'touch', 'before update', 'private.set_updated_at');

select private.rls('public.questions'); select private.rls('public.answers');
select private.rls('public.moderation_decisions'); select private.rls('public.reports');
select private.rls('public.favorites'); select private.rls('public.event_submissions');

select private.mk_policy('public.questions', 'public read approved', 'select', 'anon, authenticated',
  $q$moderation_status = 'approved' or author_id = (select auth.uid()) or private.is_editor()$q$);
select private.mk_policy('public.questions', 'members ask', 'insert', 'authenticated', null,
  $q$author_id = (select auth.uid()) and moderation_status = 'pending'$q$);
select private.mk_policy('public.questions', 'author edits while pending', 'update', 'authenticated',
  $q$author_id = (select auth.uid()) and moderation_status = 'pending'$q$,
  $q$author_id = (select auth.uid()) and moderation_status = 'pending'$q$);
select private.mk_policy('public.questions', 'editors moderate', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.questions', 'author deletes own', 'delete', 'authenticated',
  'author_id = (select auth.uid()) or private.is_editor()');

select private.mk_policy('public.answers', 'public read approved', 'select', 'anon, authenticated',
  $q$(moderation_status = 'approved' and exists (select 1 from public.questions q where q.id = question_id and q.moderation_status = 'approved'))
     or author_id = (select auth.uid()) or private.is_editor()$q$);
select private.mk_policy('public.answers', 'members answer', 'insert', 'authenticated', null,
  $q$author_id = (select auth.uid()) and moderation_status = 'pending'$q$);
select private.mk_policy('public.answers', 'author edits while pending', 'update', 'authenticated',
  $q$author_id = (select auth.uid()) and moderation_status = 'pending'$q$,
  $q$author_id = (select auth.uid()) and moderation_status = 'pending'$q$);
select private.mk_policy('public.answers', 'editors moderate', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.answers', 'author deletes own', 'delete', 'authenticated',
  'author_id = (select auth.uid()) or private.is_editor()');

-- Append-only decision log.
select private.mk_policy('public.moderation_decisions', 'editors read', 'select', 'authenticated', 'private.is_editor()');
select private.mk_policy('public.moderation_decisions', 'editors record', 'insert', 'authenticated', null,
  'private.is_editor() and decided_by = (select auth.uid())');

select private.mk_policy('public.reports', 'members report', 'insert', 'authenticated', null,
  $q$reporter_id = (select auth.uid()) and status = 'open'$q$);
select private.mk_policy('public.reports', 'read own or editor', 'select', 'authenticated',
  'reporter_id = (select auth.uid()) or private.is_editor()');
select private.mk_policy('public.reports', 'editors triage', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');

select private.mk_policy('public.favorites', 'own select', 'select', 'authenticated', 'user_id = (select auth.uid())');
select private.mk_policy('public.favorites', 'own insert', 'insert', 'authenticated', null, 'user_id = (select auth.uid())');
select private.mk_policy('public.favorites', 'own delete', 'delete', 'authenticated', 'user_id = (select auth.uid())');

select private.mk_policy('public.event_submissions', 'read own or editor', 'select', 'authenticated',
  'submitter_id = (select auth.uid()) or private.is_editor()');
select private.mk_policy('public.event_submissions', 'members submit', 'insert', 'authenticated', null,
  $q$submitter_id = (select auth.uid()) and status = 'pending'$q$);
select private.mk_policy('public.event_submissions', 'submitter edits while pending', 'update', 'authenticated',
  $q$submitter_id = (select auth.uid()) and status = 'pending'$q$, $q$submitter_id = (select auth.uid()) and status = 'pending'$q$);
select private.mk_policy('public.event_submissions', 'editors review', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');
select private.mk_policy('public.event_submissions', 'submitter withdraws pending', 'delete', 'authenticated',
  $q$(submitter_id = (select auth.uid()) and status = 'pending') or private.is_editor()$q$);

-- Public author names: ONLY the display name of people with approved posts (no other profile data).
create or replace view public.community_authors as
  select p.id, p.display_name from public.profiles p
  where p.id in (select author_id from public.questions where moderation_status = 'approved'
                 union select author_id from public.answers where moderation_status = 'approved');
