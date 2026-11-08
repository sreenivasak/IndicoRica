# PROMPT 04 — Google/email sign-in, membership and verified ownership

Apply `00-PROJECT-CONTRACT.md`. Extend existing frontend/backend/DB; do not rebuild.

## Goal

Implement REAL login and safe membership experiences while preserving guest-friendly public browsing.

## Authentication

1. Guest browsing requires no credentials. Avoid misleading "guest account" UI unless necessary.
2. **Continue with Google** through Supabase Auth OAuth; follow actual current redirect/callback instructions for the deployed domains.
3. **Continue with Email** using a verified passwordless link or OTP delivery via a production-suitable email provider (make delivery setup explicit).
4. Prepare phone verification for +91/+506 and other E.164 numbers, but **do not activate SMS login until a real provider, fees, fraud controls and delivery tests exist**. Show clear unavailable state.
5. Use secure sessions, appropriate token storage, expiring credentials, safe redirect allowlist, logout and revocation, rate limits, anti-bot checks where needed. Document separate-Worker cross-origin cookie/CORS/CSRF choice.
6. Support account linking with proof of control; do not merge accounts based only on an entered phone or email string.

## Roles and pages

- `/login`: Google, email and continue-as-guest; good error/loading states.
- `/account`: verified profile, favorites, contributions, notification preferences, privacy/account deletion.
- `/business/dashboard`: new business submission, claim request, ownership approval status, permitted updates, ad inquiry. Verified business owners **only** edit linked listings.
- `/admin`: separate privileged route for editor/advertising manager/content admin/super admin, with required MFA for privileged roles.
- Provide a safe, one-time super-admin bootstrap mechanism (manual protected server/DB operation). Never use self-declared email or browser input to grant admin.

## Tests / acceptance

- Guest search works; verified Google login works on deployed domain; email login works with real delivery.
- Login returns users to intended safe route.
- Member can save and view their own favorites after re-login.
- Business owner A cannot edit business owned by B (direct HTTP and RLS tests).
- Editor cannot gain admin or manage scripts.
- Admin MFA enrollment/recovery tested.
- No auth token/secrets dumped into logs.
- Verify sessions across frontend Worker and separate API Worker.

Provide actual Google Cloud/Supabase manual steps (exact redirect values from provider dashboard), test results and commit. Never claim login works merely because buttons are visible.
