# PROMPT 02 — Production data model and authorization foundation

Apply `00-PROJECT-CONTRACT.md`. Continue the existing repository; preserve the successful browser → API → PostgreSQL proof-of-concept.

## Goal

Create structured, version-controlled PostgreSQL schema and access controls that will support all core IndicoRica features securely.

## Schema to implement

- Authentication-related: `profiles` linked to Supabase auth IDs, role assignments, verification/audit events; do NOT copy/store passwords.
- Editorial: pages, sections, articles, article revisions, categories, tags, FAQs, editorial sources, verification/review dates, redirects, navigation, settings.
- Discovery: businesses, business categories, addresses/areas, claimed ownership, images, operating information, verification status, ingredient catalog, ingredient-to-supplier relations, dated availability evidence.
- Community: questions, answers, moderation decisions, reports, member favorites, event submissions and event listings.
- Ads: advertisers, creatives, campaigns, targeting, slot definitions, sponsored listing association, authorized provider configuration; avoid storing unreviewed executable scripts.
- Operations: audit log, content correction requests, media metadata, trash/archive history, moderation queue.

## Rules

1. All IDs stable, foreign keys enforced, uniqueness and indexes appropriate. Add `created_at`, `updated_at`, publishing state and provenance where relevant.
2. Store only needed personal data. Keep private email/phone information out of public result types. Make personal contact details consent-based.
3. Enable RLS on all exposed tables; default deny. Public anonymous role can read **published and approved** content only. Draft and private data blocked.
4. Owners can edit only business IDs tied to verified ownership. Role grants must be privileged and audited. Members can update only their own profile, favorites and eligible submissions.
5. Admin write paths must validate a role on the server and in the DB. Prefer scoped end-user tokens when appropriate; restrict privileged service-role usage to narrow server operations.
6. Draft→review→publish workflow and reversible trash. Maintain revisions.
7. Storage policies for public business images vs private imports. Validate MIME type, size and permissions; never accept arbitrary files publicly.
8. Include transactions, safe pagination and parameterized queries. Never build SQL by interpolating untrusted strings.
9. Create idempotent migrations and a development-only demo seed; do not import invented real-world information as verified.
10. Add a data dictionary, entity relationship diagram (Mermaid acceptable), and typed schema/API contracts.

## Tests

Create automated positive and negative tests for guest, member, different business owner, editor, advertising manager and super admin. Specifically attempt:
- read drafts as guest;
- edit a different owner's business;
- grant oneself admin;
- read private upload or personally identifying information;
- alter ad network configuration as editor;
- restore/delete another person's private data.

**Gate:** migrations work from a clean database; RLS negative tests pass; there are no open public write policies; app still builds and the Phase 1 data flow works. Record evidence and commit.
