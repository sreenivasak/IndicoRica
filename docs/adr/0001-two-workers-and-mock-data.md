# ADR 0001 — Two Workers, and mock data for Supabase (phase 01)

## Decision
- `apps/web` (Next.js) and `apps/api` (Hono) are separate deployables, joined over HTTPS at `/api/v1`.
- The API reads data through a `SettingsRepo` interface. `DATA_SOURCE=mock` (default) uses an in-memory adapter;
  `DATA_SOURCE=supabase` uses `@supabase/supabase-js` with the **publishable key only** (RLS applies; no service-role key).

## Why two Workers
Hono runs natively on Workers; the official Hono–Next.js integration targets Node, so it is not assumed to work under vinext.
Separate deployables keep contracts, auth and CORS explicit and let each scale/fail independently.

## Fallback
If separate Workers prove unworkable on free tiers, switch to Next.js Route Handlers behind the same `/api/v1` contracts —
only with owner approval, with evidence.

## Status (2026-11-08)
- Verified locally: API tests (6), typecheck, Next build, live CORS check, web page renders API data.
- NOT verified: vinext/Cloudflare deployment, real Supabase query. The UI and `/public/system-info` label mock data
  (`isRealDatabase: false`), so the phase-01 "real database" gate remains OPEN.

## Switching to real Supabase
1. Create project, run `supabase/migrations/*` then `supabase/seed/seed.sql`.
2. In `apps/api/.dev.vars`: `DATA_SOURCE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
