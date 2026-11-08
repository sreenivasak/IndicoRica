# PROMPT 01 — Foundation, architecture and deployed proof-of-concept

Use `00-PROJECT-CONTRACT.md` as mandatory standing instructions. Work in the existing `indicorica` private GitHub repository.

## Goal

Set up the real Next.js **frontend**, Hono **backend**, Supabase **database** and Cloudflare-compatible deployment. Before implementing the full site, PROVE the three layers communicate on intended free-tier hosting.

## Tasks

1. Inspect repository; do not overwrite existing files without reason.
2. Choose current compatible versions of Next.js, React, TypeScript, Tailwind, Hono, Cloudflare tooling and Supabase SDK. Check official docs in real time; document exact versions and reasons.
3. Set up a monorepo (`pnpm` workspaces preferred if supported), containing:
   - `apps/web` — Next.js App Router with a premium IndicoRica-branded homepage shell and `/health` page;
   - `apps/api` — independently deployed Hono Worker with `/api/v1/health` and `/api/v1/public/system-info` endpoints;
   - `packages/contracts` — API request/response and validation types;
   - `supabase/migrations` and `supabase/seed`;
   - `tests`, `docs` and scripts.
4. Set up Next.js on Cloudflare Workers using documented **vinext** approach; use a separate Hono Worker. Check vinext compatibility and record actual outcome. Do not use `@hono/vercel` with Workers without a proven supported mechanism.
5. Configure frontend to call API through a public base URL and handle network and API errors gracefully.
6. Create a minimal `app_settings_public` migration with a read-only `site_name` sample record, with safe RLS. The API must query the Supabase database and return the name.
7. Show the returned value on the homepage through the API. This must be an actual database query, not a hardcoded response.
8. Configure HTTPS, origin handling, restricted CORS, appropriate cookie/token architecture, and controlled development origins. Explain CSRF strategy for any cookie-based sessions.
9. Add `.env.example` and deployment docs, using placeholder secrets only. Avoid automatic paid plan activation.
10. Implement minimal structured logs, consistent error format, dependency/lint/type/test/build scripts, and deployment instructions.
11. Provide an architecture decision record explaining **why two Workers** and the fallback if current versions are incompatible.

## Acceptance gate

- Local frontend and backend start using documented commands.
- Database migration runs.
- Browser page receives `site_name` from API which actually reads PostgreSQL.
- CORS rejects an unauthorized origin while permitted frontend works.
- Public secrets do not appear in JavaScript bundles.
- Both Workers deploy to intended Cloudflare environment, OR deployment is honestly blocked with logs and a concrete fix proposal.
- Production URL tests work with the deployed database, before Phase 2 is allowed.
- Lint/type/build/tests run successfully.

End with a truthful report, links or paths that actually exist, instructions for owner-managed secrets, and a Git commit.
