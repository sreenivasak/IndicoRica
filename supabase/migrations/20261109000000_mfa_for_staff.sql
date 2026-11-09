-- Phase 04: staff roles only work on an MFA-verified session (aal2).
-- A staff member who has not completed TOTP sign-in keeps NO staff powers, even if they call the
-- database directly. Owner-of-business rights and ordinary member rights are unaffected.
-- Service role / admin SQL are unaffected (they do not use these checks).

create or replace function private.has_any_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid()) and role = any(roles))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2' $$;

-- Separate, MFA-independent check used ONLY so a signed-in person can learn which roles they hold
-- (the API uses it to answer "you are staff but must enroll MFA"). Not used by any write policy.
create or replace function private.holds_any_role() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid())) $$;
grant execute on function private.holds_any_role() to authenticated;
