-- Phase 02 / 6: operations, storage policies, and table grants (default deny).

create table if not exists public.content_correction_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_table text not null check (target_table in ('articles','businesses','pages','events')),
  target_id text not null,
  description text not null check (char_length(description) between 5 and 2000),
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('business-images','ad-creatives','private-imports')),
  path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','text/csv','application/json')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  alt_text text,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create or replace function private.protect_correction() returns trigger language plpgsql as $$
begin
  if (private.is_api_role() and not private.is_editor()) then
    if tg_op = 'INSERT' then new.status := 'open'; new.resolved_by := null; new.resolved_at := null;
    else new.status := old.status; new.resolved_by := old.resolved_by; new.resolved_at := old.resolved_at; end if;
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    new.resolved_by := (select auth.uid()); new.resolved_at := now();
  end if;
  return new;
end $$;
select private.mk_trigger('public.content_correction_requests', 'protect', 'before insert or update', 'private.protect_correction');

select private.rls('public.content_correction_requests'); select private.rls('public.media_assets');
select private.mk_policy('public.content_correction_requests', 'members submit', 'insert', 'authenticated', null,
  $q$submitted_by = (select auth.uid()) and status = 'open'$q$);
select private.mk_policy('public.content_correction_requests', 'read own or editor', 'select', 'authenticated',
  'submitted_by = (select auth.uid()) or private.is_editor()');
select private.mk_policy('public.content_correction_requests', 'editors resolve', 'update', 'authenticated', 'private.is_editor()', 'private.is_editor()');

select private.mk_policy('public.media_assets', 'read public bucket or own or editor', 'select', 'anon, authenticated',
  $q$bucket in ('business-images','ad-creatives') or uploaded_by = (select auth.uid()) or private.is_editor()$q$);
select private.mk_policy('public.media_assets', 'staff register uploads', 'insert', 'authenticated', null,
  $q$uploaded_by = (select auth.uid()) and (
       (bucket = 'private-imports' and private.is_content_admin())
    or (bucket = 'ad-creatives' and private.is_ad_manager())
    or (bucket = 'business-images' and (private.is_editor() or private.try_uuid(split_part(path, '/', 1)) is not null
          and private.owns_business(private.try_uuid(split_part(path, '/', 1))))))$q$);
select private.mk_policy('public.media_assets', 'delete own or editor', 'delete', 'authenticated',
  'uploaded_by = (select auth.uid()) or private.is_editor()');

-- Moderation queue: invoker view, so RLS limits it to editors automatically.
create or replace view public.moderation_queue with (security_invoker = true) as
  select 'questions'::text as kind, id::text as id, created_at, title as summary from public.questions where moderation_status = 'pending'
  union all select 'answers', id::text, created_at, left(body, 80) from public.answers where moderation_status = 'pending'
  union all select 'event_submissions', id::text, created_at, title from public.event_submissions where status = 'pending'
  union all select 'availability_evidence', id::text, created_at, coalesce(source_note, source_type) from public.availability_evidence where status = 'pending'
  union all select 'reports', id::text, created_at, reason from public.reports where status = 'open'
  union all select 'business_owners', business_id::text || ':' || user_id::text, requested_at, 'ownership claim' from public.business_owners where status = 'pending'
  union all select 'corrections', id::text, created_at, left(description, 80) from public.content_correction_requests where status = 'open';

-- ----------------------------------------------------------- storage
-- Buckets: size/MIME limits enforced by Storage itself in addition to the policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('business-images', 'business-images', true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('ad-creatives',    'ad-creatives',    true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('private-imports', 'private-imports', false, 10485760, array['text/csv','application/json'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_write_business_object(object_name text) returns boolean
language sql stable as $$
  select private.is_editor()
      or (private.try_uuid((storage.foldername(object_name))[1]) is not null
          and private.owns_business(private.try_uuid((storage.foldername(object_name))[1]))) $$;
grant execute on function private.can_write_business_object(text) to anon, authenticated;

do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and policyname like 'indicorica %' loop
    execute format('drop policy %I on storage.objects', p);
  end loop;
end $$;

create policy "indicorica public read images" on storage.objects for select to anon, authenticated
  using (bucket_id in ('business-images','ad-creatives'));
create policy "indicorica business image write" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-images' and private.can_write_business_object(name));
create policy "indicorica business image update" on storage.objects for update to authenticated
  using (bucket_id = 'business-images' and private.can_write_business_object(name))
  with check (bucket_id = 'business-images' and private.can_write_business_object(name));
create policy "indicorica business image delete" on storage.objects for delete to authenticated
  using (bucket_id = 'business-images' and private.can_write_business_object(name));
create policy "indicorica ad creative write" on storage.objects for all to authenticated
  using (bucket_id = 'ad-creatives' and private.is_ad_manager())
  with check (bucket_id = 'ad-creatives' and private.is_ad_manager());
create policy "indicorica private imports admin only" on storage.objects for all to authenticated
  using (bucket_id = 'private-imports' and private.is_content_admin())
  with check (bucket_id = 'private-imports' and private.is_content_admin());

-- ------------------------------------------------------------ grants
-- Default deny: remove everything, then grant the minimum. RLS then narrows further.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant select on
  public.app_settings_public, public.categories, public.tags, public.article_tags, public.pages,
  public.site_sections, public.articles, public.editorial_sources, public.faqs, public.redirects,
  public.navigation_items, public.businesses, public.business_contacts, public.business_images,
  public.business_hours, public.ingredients, public.ingredient_suppliers, public.availability_evidence,
  public.questions, public.answers, public.events, public.ad_slots, public.ad_providers,
  public.ad_provider_config, public.ad_creatives, public.ad_campaigns, public.sponsored_listings,
  public.ad_settings, public.media_assets, public.community_authors
  to anon;

grant select, insert, update, delete on
  public.profiles, public.profile_private, public.app_settings, public.app_settings_public,
  public.categories, public.tags, public.article_tags, public.pages, public.site_sections, public.articles,
  public.editorial_sources, public.faqs, public.redirects, public.navigation_items,
  public.businesses, public.business_owners, public.business_contacts, public.business_images,
  public.business_hours, public.ingredients, public.ingredient_suppliers, public.availability_evidence,
  public.questions, public.answers, public.reports, public.favorites, public.event_submissions, public.events,
  public.advertisers, public.ad_slots, public.ad_providers, public.ad_provider_config, public.ad_creatives,
  public.ad_campaigns, public.sponsored_listings, public.content_correction_requests, public.media_assets
  to authenticated;
grant select, update on public.ad_settings to authenticated;
grant select, insert, delete on public.user_roles to authenticated;           -- no update: revoke + grant instead
grant select on public.audit_log, public.article_revisions, public.moderation_queue, public.community_authors to authenticated;
grant select, insert on public.moderation_decisions to authenticated;          -- append-only
