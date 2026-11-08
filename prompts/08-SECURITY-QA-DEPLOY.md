# PROMPT 08 — Security, quality assurance, backups and deployment

Apply `00-PROJECT-CONTRACT.md`. This is a launch-blocking security and recovery phase, not an opportunity to rewrite the app.

## Audit

Review source, dependencies, environment handling, database schema/RLS, authentication, authorization, origin/CORS strategy, CSRF defenses, webhooks, files, third-party ads, SEO rendering and deployment configuration. Prioritize findings by severity and fix critical/high issues.

## Mandatory adversarial tests

1. Anonymous visitor tries to read draft/private page, private storage, `/admin` APIs, member accounts.
2. Member attempts to impersonate another member or change their role.
3. Owner A tries to edit, claim or delete Owner B's business via direct API/DB requests.
4. Advertising manager attempts super-admin provider modification.
5. Public submission includes dangerous HTML/JS URLs or malformed image payload.
6. Login redirect contains malicious cross-origin target; session expiry and logout behavior tested.
7. Cross-origin API requests and cookies/tokens follow documented CORS/CSRF policy.
8. Turnstile form checks verify tokens on server; abusive form requests rate-limited.
9. Stored rich text sanitized and CSP active; unapproved ad scripts never execute.
10. Service-role token and other secrets absent from public code, bundles and logs.

## Backup and recovery

- Produce encrypted logical PostgreSQL backup to a **separate private destination** with limited access and retention policy.
- Explain actual automatic schedule, owner tasks and credentials. If a truly free scheduler/destination cannot be configured, document manual backup without claiming automation.
- Run a tested restore into an isolated test database; record evidence and duration.
- Define data recovery and Worker rollback procedures.
- Never put personal data backups into a public GitHub repo or public bucket.

## Operational/financial controls

- Record usage and relevant Cloudflare/Supabase free quotas. Identify potential upgrade triggers, paid SMS/email options and anything that could incur charges.
- Check monitoring and error tracking availability, PII-safe logs and alerts, basic failure modes, paused free Supabase project handling.
- Prepare minimum required privacy, cookies/ads disclosures, editorial policy, acceptable use and account deletion workflows; owner must review local legal compliance before launch.

## Full end-to-end test

Visitor searches and reads; member signs in and saves; business owner edits owned listing; editor publishes/rolls back content; ad manager schedules approved banner; super admin manages permissions and provider kill switch. Check mobile, accessibility, SEO indexability and performance.

## Deployment

Deploy real frontend + Hono API (or owner-approved documented fallback) to Cloudflare Workers; apply reviewed Supabase migrations; configure OAuth real domain and email sender; smoke test HTTPS and APIs; validate sitemap and search previews. Never fabricate URLs or test successes.

## Deliverables

- Security report with actual pass/fail evidence and unresolved issues.
- Production deployment links that were actually opened/tested.
- Backup and restore evidence; recovery instructions.
- `docs/LAUNCH-CHECKLIST.md` updated with proof.
- Documented usage/cost/secret risks.
- Versioned git commit or release tag.

**Do not declare production-ready if any critical authorization, authentication, backups, or untrusted ad-script safety test fails.**
