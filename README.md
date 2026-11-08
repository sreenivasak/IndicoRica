# IndicoRica — Full-Stack Build Playbook

> **Purpose:** Build a secure, SEO-friendly Indian community and business-discovery web app for Costa Rica, with a no-code admin dashboard and a **$0/month hosting target at launch**.
>
> **Status:** Planning and AI-development prompt pack. **This is not a finished application.**
>
> **Last reviewed:** 2026-11-07. Verify current provider features, documentation, and pricing before starting.

## 1. What we are building

IndicoRica connects Indians living in, visiting, relocating to, and doing business in Costa Rica — and Costa Ricans interested in Indian businesses, food, and culture.

**Public features:** homepage, searchable Indian business directory, grocery/ingredient finder, immigration and relocation guides, events, community Q&A, English-first content with Spanish-ready architecture, and useful search-engine-indexable articles.

**Accounts:** browse as guest (no account required), register/sign in with Google, email passwordless sign-in, member dashboard, business-owner accounts, role-restricted editors and admins. Phone sign-in via SMS OTP is a **later, cost-dependent integration**, not a fake free feature.

**Admin:** a nontechnical editor can add/edit/preview/publish/archive/restore pages and listings, manage homepage sections, media, menus, FAQs and approved advertising campaigns without editing code.

**Advertising:** uploaded banners, sponsored listings, and approved ad-network integrations, with clear sponsorship disclosures and restricted script configuration. **Never accept arbitrary JavaScript from advertisers or ordinary editors.**

## 2. Chosen architecture

```text
                    VISITORS / MEMBERS / ADMINISTRATORS
                                  |
                             HTTPS / TLS
                                  |
                 FRONTEND — Next.js + React + Tailwind
                 Public pages, SEO, member and admin UI
                                  |
                            /api/v1 HTTPS
                                  |
                 BACKEND — TypeScript + Hono on Workers
                 Validation, authorization, workflows, ads
                                  |
                 DATABASE — Supabase PostgreSQL + RLS
                    Supabase Auth / Supabase Storage
```

Use **one GitHub monorepo with three explicit layers**:

```text
indicorica/
├── apps/
│   ├── web/                     # Next.js frontend
│   └── api/                     # Hono backend on Cloudflare Workers
├── packages/
│   ├── contracts/               # Shared types, Zod validation, API contracts
│   └── ui/                      # Optional shared UI components
├── supabase/
│   ├── migrations/              # Versioned SQL + RLS policies
│   └── seed/                    # Safe development demo data ONLY
├── tests/
│   ├── integration/
│   └── e2e/
├── docs/
├── prompts/
├── .env.example                 # Placeholders ONLY; not credentials
└── README.md
```

### Important deployment decision (do this *before* feature development)

- Cloudflare recommends **vinext** for running full-stack Next.js on Workers. Verify the current compatibility of the particular Next.js version and features used.
- Hono works natively on Cloudflare Workers. **Do not assume a particular Hono Next.js adapter works inside vinext.** The official Hono Next.js integration documents a Node runtime integration. Our default is **two independently deployed Cloudflare Workers**: Next.js frontend and Hono API, connected over HTTPS.
- First prove a tiny **browser → API → database** end-to-end flow on free plans, including authentication and CORS. If separate Workers prove incompatible with a free-tier constraint, present a documented fallback such as native Next.js Route Handlers with the same `/api/v1` contracts. Do not silently switch stacks.
- **Fastify + Node.js** is a valid future alternative for a separately hosted backend, but is *not* the default for a $0 Cloudflare-first launch.
- All privileged writes must be authorized on the backend, and all exposed Supabase tables must enforce correct Row Level Security. Do not rely on hidden buttons for security.

## 3. Free-tier reality check

| Service | Launch plan | Notes |
|---|---|---|
| Cloudflare Workers | Free tier | Request and CPU limits apply; confirm frontend + API usage. |
| Supabase | Free tier | Database/storage/auth quotas; project can pause with inactivity. |
| Cloudflare Turnstile | Free tier | Anti-bot protection; verify tokens server-side. |
| GitHub | Free private repository | Source control; never commit keys. |
| Free website address | `*.workers.dev` | An owned `.com` domain normally costs money. |
| Google OAuth | Setup usually free | Requires provider credentials and correct redirects. |
| Email sign-in | Limited provider quotas | Verify production email delivery provider/limits. |
| SMS phone OTP | **Likely paid** | Leave disabled until funded, configured and tested. |
| AI coding platform | Varies | AI credits/subscription not included in $0 hosting target. |
| Backups | Must be arranged | Supabase Free does not include paid-tier managed backups. |

**Zero-cost is a target, not a guarantee.** Verify current limits and do not enable paid usage automatically. Free hosting does not guarantee high uptime, automatic backups, or zero maintenance.

## 4. Accounts to create (owner-operated)

1. **GitHub** — https://github.com/signup — private repository `indicorica`.
2. **Cloudflare** — https://dash.cloudflare.com/sign-up — free plan, deploy frontend and API Workers after proof-of-concept.
3. **Supabase** — https://supabase.com/dashboard — free PostgreSQL/Auth/Storage project; save database password in a password manager.
4. **Google Cloud** — https://console.cloud.google.com/ — create OAuth application and consent configuration when prompted.
5. **AI coding agent/workspace** — choose one that can edit the GitHub repo, run terminal commands, manage secrets, test and deploy. AI development tooling itself may charge.
6. **Optional later:** production email sender, SMS provider, domain registrar and approved ad accounts.

**Secrets rule:** Never paste credentials into normal chat prompts, committed files, screenshots or frontend source. Use your development environment's protected secrets manager and provider consoles. For browser-side Supabase only the intended public/publishable configuration may be exposed; **never expose service-role keys**.

## 5. Run prompts in this exact order

| Order | File | Outcome | Gate to proceed |
|---|---|---|---|
| 00 | [`prompts/00-PROJECT-CONTRACT.md`](prompts/00-PROJECT-CONTRACT.md) | Permanent rules and architecture | Agent acknowledges and creates plan |
| 01 | [`prompts/01-FOUNDATION-AND-POC.md`](prompts/01-FOUNDATION-AND-POC.md) | Repository, deployment compatibility proof, database starter | Browser → API → DB works |
| 02 | [`prompts/02-DATABASE-AND-SECURITY.md`](prompts/02-DATABASE-AND-SECURITY.md) | Schema, migrations, roles, RLS, private storage | Authorization tests pass |
| 03 | [`prompts/03-PUBLIC-FRONTEND.md`](prompts/03-PUBLIC-FRONTEND.md) | Premium public website, search, guides, businesses, food finder | Real read-only DB data; mobile preview |
| 04 | [`prompts/04-AUTH-AND-MEMBERS.md`](prompts/04-AUTH-AND-MEMBERS.md) | Google/email login, member/business-owner access | Guest/member/owner isolation verified |
| 05 | [`prompts/05-NOCODE-ADMIN.md`](prompts/05-NOCODE-ADMIN.md) | Wife-friendly admin CMS with CRUD, previews, rollback | Nontechnical editor completes workflow |
| 06 | [`prompts/06-ADS-AND-COMMUNITY.md`](prompts/06-ADS-AND-COMMUNITY.md) | Safe ad manager, Q&A, events, submissions | No unapproved script runs; moderation passes |
| 07 | [`prompts/07-SEO-AND-CONTENT.md`](prompts/07-SEO-AND-CONTENT.md) | SEO, source freshness, English/Spanish readiness | Crawl/index metadata validated |
| 08 | [`prompts/08-SECURITY-QA-DEPLOY.md`](prompts/08-SECURITY-QA-DEPLOY.md) | End-to-end security, backup/restore, production deploy | All launch-blocking tests pass |
| 09 | [`prompts/09-HANDOVER-AND-OPERATIONS.md`](prompts/09-HANDOVER-AND-OPERATIONS.md) | Nontechnical manuals and ongoing upkeep | Owner can operate without code |

### For each prompt

1. Open the **same** coding workspace and **same** GitHub repo.
2. Give the agent `00-PROJECT-CONTRACT.md` as standing context, then paste the current numbered prompt.
3. Ask it to **implement**, not merely describe, the requested files and features.
4. Let it run build, type-check, lint, tests, migrations and deployed smoke tests as applicable.
5. Review the actual application, not just screenshots.
6. Require a short report: `implemented / tested / failed / manual owner steps / costs / next gate`.
7. Commit a working checkpoint to GitHub; use a feature branch and PR for risky changes.
8. Do **not** continue if the phase's gate has failed.

If the agent loses context or breaks the project, use [`prompts/RECOVERY.md`](prompts/RECOVERY.md).

## 6. Owner setup steps in more detail

### 6.1 Repository

- Create the private `indicorica` repo. Add `README.md`, `/prompts` and `/docs` from this pack.
- Connect your coding workspace to the repository. Prefer limited repository permissions.
- Require commits after tested stages; protect the main branch once the project is stable.

### 6.2 Supabase

- Create a project, record project URL and public publishable key.
- Set up migrations from source control; **do not hand-edit production SQL as the standard workflow**.
- Enable RLS on relevant tables; test anon, member, business-owner, editor and admin permissions.
- Configure private and public media buckets separately; block executable uploads.
- Set **Site URL** and **redirect allowlist** only after the real app URLs are known.
- Keep Google, email sender and phone providers separate; no simulated sign-in in production.

### 6.3 Google OAuth

- In Google Cloud, configure an OAuth consent screen, authorized origins and redirect URIs matching Supabase's **actual** callback settings.
- Enable Google in Supabase Auth with secrets stored in the provider configuration, not source code.
- Test a real Google sign-in on the deployed HTTPS domain, logout and token refresh.
- Remember: "login via Gmail" means **Continue with Google**; ordinary Gmail email addresses can also use email sign-in.

### 6.4 Cloudflare

- Follow the *current* Next.js/vinext Workers guide for the frontend and Hono Workers guide for the API.
- First deploy the proof-of-concept and check request routing, CORS/CSRF strategy, cookies/tokens, external Supabase connectivity, and limits.
- Configure secrets in Cloudflare's secret manager.
- Use the free `workers.dev` subdomains initially. Configure a custom domain later, if purchased.
- Set HTTPS, security headers, rate limiting and server-verified Turnstile where needed.

### 6.5 Email and phone

- Do not invite a public audience to production email sign-in until a suitable sender is configured and tested.
- The app must distinguish **disabled phone OTP** from **working phone OTP**. A plus-country-code input does not equal authentication.
- SMS OTP for Costa Rican (+506) and Indian (+91) numbers should be costed and verified with a provider before activation.

### 6.6 Advertising

- Start with direct image banners and sponsored listings.
- Add Google AdSense/Ad Manager only when the appropriate accounts and provider approvals are ready.
- Administrators configure **approved provider IDs and slot IDs**; untrusted people never paste executable scripts into articles or ads.
- Always disclose sponsored content and implement appropriate consent controls.

## 7. Nontechnical admin operating workflow

Once deployed, an authorized editor should be able to:

1. Sign in at `/admin` with MFA if privileged.
2. Choose **Businesses → Add Business**.
3. Enter name, category, location, photos, contact, WhatsApp, verification source and date.
4. **Save Draft → Preview → Publish**.
5. See the listing appear publicly and in applicable search/category pages.
6. Edit the listing later or **Unpublish/Archive** and restore a previous revision.
7. Add a guide through **Articles → New** using a rich-text/block editor.
8. Change homepage cards and menu links through easy settings forms.
9. Upload a direct ad banner, choose location and dates, and enable/disable it.
10. Review pending tips before publication.

A normal editor **must not** be able to elevate their role, access private user records, change infrastructure settings, or inject executable ad scripts.

## 8. Safety and reliability release requirements

**Before any public launch:**

- [ ] Frontend and API deployed, routing and TLS verified.
- [ ] Database migrations reproducible; production data not overwritten by seeds.
- [ ] Google and email authentication actually work.
- [ ] Admin MFA and recovery instructions are documented.
- [ ] RLS and server authorization tests pass for all roles.
- [ ] Public content is separated from drafts and private user data.
- [ ] Rich-text input and uploaded files are validated/sanitized.
- [ ] No arbitrary JavaScript can be inserted by members, advertisers or ordinary editors.
- [ ] CSRF/CORS/session defenses match the chosen cross-origin layout.
- [ ] Turnstile tokens are verified server-side and submission routes are rate-limited.
- [ ] Encrypted database backup exists **outside** the live database; restore has been tested.
- [ ] No leaked API secrets, private contact information, or private WhatsApp messages.
- [ ] SEO pages are indexable, with sitemap, canonical URLs and valid metadata.
- [ ] Privacy policy, terms, ad disclosures, editorial corrections policy and contact page are published.
- [ ] Costs/quotas and failure conditions have been recorded.
- [ ] Nontechnical owner has completed hands-on admin acceptance tests.

**No provider or framework can guarantee 100% security.** The goal is defense in depth, measured testing and ongoing maintenance.

## 9. Content and source policies

- Verify legal/visa/driving/tax information against current official sources; include dates and citations. Do not give undocumented immigration advice.
- Label community tips as tips, not verified legal rules.
- Never publish private WhatsApp messages, personal numbers, names or screenshots without appropriate permission.
- Never invent grocery stock, ratings, review counts, stores, official fees, advertisements, traffic figures or testimonials.
- Sponsored placements must be labeled distinctly from independent editorial material.
- Do not create empty SEO doorway pages for every neighborhood; prioritize pages with real local value.

## 10. Suggested public pages for the first launch

- Moving from India to Costa Rica
- Costa Rica entry/visa information for Indian citizens (official citations required)
- Indian groceries in Costa Rica
- Paneer, dahi, milk and Indian spices: where to look
- Indian restaurants in Costa Rica
- Driving rules for Indian visitors/residents (official citations required)
- Opening a bank account
- Finding housing
- Indian community and events
- Starting or promoting a business in Costa Rica

Publish only when fact-checked; otherwise leave as draft.

## 11. Troubleshooting

| Problem | What to ask the agent |
|---|---|
| Blank production page | Check deployed frontend bundle, framework adapter, runtime logs and SSR compatibility. |
| `401` or redirect loop | Check Supabase project URLs, OAuth redirects, session/cookie handling, CORS. |
| User can see another user's data | Stop launch. Audit backend authorization and Supabase RLS; write negative tests. |
| Admin button appears to work but no change | Check request, API validation, database write, UI invalidation and published/draft state. |
| Ad script breaks the page | Disable network ads globally; audit integration and CSP; do not relax security blindly. |
| Website is not indexed | Inspect SSR HTML, robots, sitemap, canonical metadata, search console and content value. |
| Free tier pauses or hits quota | Show visible failure/maintenance state, restore or upgrade transparently; do not imply guaranteed uptime. |
| AI agent changed the stack | Stop, revert to last good commit, and reapply the project contract. |

## 12. Reference documentation (verify live versions)

- Cloudflare Next.js on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Hono documentation: https://hono.dev/docs
- Hono Next.js integration caveat: https://hono.dev/docs/getting-started/nextjs
- Supabase pricing: https://supabase.com/pricing
- Supabase authentication: https://supabase.com/docs/guides/auth
- Supabase database security/RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Google Search Central: https://developers.google.com/search/docs
- OWASP Top 10: https://owasp.org/www-project-top-ten/

## 13. Definition of done

IndicoRica is ready for launch **only when** a real guest can search published information; a real member can sign in; a business owner can update only an authorized listing; a nontechnical editor can fully manage content; an ad manager can configure approved ads; the database protects private information; backups can be restored; tests have passed; and the deployed public pages can be crawled by search engines.

**This package contains instructions and prompts, not runnable application source code.** Give the prompts to a coding agent with repository and terminal access to generate the actual application.
