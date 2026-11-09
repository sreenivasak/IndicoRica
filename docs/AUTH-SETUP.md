# Sign-in, accounts, MFA and the first super admin (phase 04)

## How sign-in is built
- **Providers:** Continue with Google (Supabase OAuth, PKCE) and a passwordless **email link**. Phone/SMS sign-in is
  deliberately **off** (paid provider needed): the UI says "coming later".
- **Sessions:** the web app (Next.js on Workers) holds the Supabase session in secure cookies on **its own origin**
  (`@supabase/ssr`; `proxy.ts` refreshes it). Pages call `requireUser()`, which verifies the user with Supabase
  (not just by reading a cookie).
- **Web → API:** the web server sends `Authorization: Bearer <access token>` to the separate API Worker.
  The API verifies the token with Supabase on **every** request and then talks to the database **as that user**
  (the user's token is forwarded), so Row Level Security applies exactly as for direct access.
- **CSRF / CORS decision:** the API never reads cookies, so it has no CSRF surface; CORS allows only the web origin,
  with no credentials. The only cookie-authenticated POST on the web app (`/auth/signout`) checks the `Origin` header.
- **Safe redirects:** after login the user is sent only to an allowlisted same-site path (`lib/safe-redirect.ts`, tested).
- **Logs:** the API logs method, path, status and timing only; never headers, tokens or query strings.

## Roles and MFA
- Staff roles (`contributor`, `editor`, `ad_manager`, `content_admin`, `super_admin`) live in `user_roles`.
- **MFA is enforced in the database too:** every staff check requires an `aal2` (authenticator-verified) session
  (`20261109000000_mfa_for_staff.sql`). A staff member without MFA is treated like an ordinary member, even if they call
  the database directly. The API's `/admin/status` answers `mfa_required` and the web app sends them to
  `/account/security`.
- Members/owners are unaffected by MFA.
- **Lost authenticator:** there are no recovery codes (Supabase TOTP has none). Reset by removing the factor:
  Supabase dashboard → Authentication → Users → the user → remove MFA factor, then enroll again. Keep the setup
  secret in a password manager when enrolling.

## First super admin (one-time, manual, protected)
Nothing in the app or the browser can grant admin. The first super admin is created by the project owner in the
Supabase **SQL Editor** (protected by the owner's Supabase login):

1. Sign in to the site once (so the account exists).
2. Run, with your own email:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'super_admin' from auth.users
   where email = 'YOU@example.com'
     and not exists (select 1 from public.user_roles where role = 'super_admin');
   ```
   It does nothing if a super admin already exists. Check: `select * from public.user_roles;`
3. Open `/admin`. You will be sent to `/account/security` to set up the authenticator app, then back to `/admin`.
4. Further roles are granted by a super admin (tests prove an editor cannot grant roles, and every grant is audited).

## Google OAuth (owner steps)
1. Google Cloud Console → new project → OAuth consent screen (External) → Credentials → OAuth client ID (Web).
2. Authorized redirect URI: `https://ctdegrdmcjtvtcbwzcob.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google: paste Client ID and secret (never commit them).
4. Supabase → Authentication → URL Configuration: Site URL `https://indicorica-web.indicorica.workers.dev`;
   Redirect URLs: `https://indicorica-web.indicorica.workers.dev/auth/callback` and `http://localhost:3000/auth/callback`.

## Email
Supabase's built-in email sender is for testing (very low hourly limits, may land in spam). **Before inviting the
public**, configure a real sender (Supabase → Authentication → SMTP Settings) and test delivery.

## Account linking
Supabase links identities that share the same **verified** email (Google + email link). Accounts are never merged by an
unverified typed email or phone number.

## Not built / follow-ups (honest list)
- **Anti-bot (Turnstile) on sign-in:** can be enabled in Supabase → Authentication → Attack Protection once a Turnstile
  site key exists; the login form will then need the widget. Supabase's own rate limits apply meanwhile.
- **Self-service account deletion:** needs a privileged server step; currently by email request.
- **Business owner editing forms and the real admin screens:** phase 05.
- **Not verified yet:** real Google login and real email delivery (need the owner's Google/SMTP setup and a browser).
