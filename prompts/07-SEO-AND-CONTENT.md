# PROMPT 07 — Search engine optimization and verified editorial workflows

Apply `00-PROJECT-CONTRACT.md`; preserve application and URLs.

## Goal

Make IndicoRica technically SEO-ready for high-intent searches while making informational quality and freshness visible to users.

## SEO features

- Server-rendered or appropriately prerendered public content accessible without login and with meaningful initial HTML.
- Editable SEO title, description, language, canonical URL, robots directive, social image and Open Graph metadata.
- Auto-generated sitemap of only published public URLs; exclude `/admin`, `/account`, private API, drafts, archives, internal search duplicates and test fixtures.
- Breadcrumbs, category taxonomy, robust internal linking, unique clean slugs, correct 301 redirects for changed slugs, descriptive image alt text and a 404 page.
- Accurate JSON-LD where warranted: Organization, WebSite, Article, BreadcrumbList, LocalBusiness and Event. **No fake ratings, nonexistent offers, invented opening hours or guaranteed rich results.**
- English pages initially; proper architecture for reviewed Spanish translations, `hreflang` and translated URL mapping. Do not auto-publish unreviewed machine translations, especially legal guidance.
- Good mobile speed, image sizes, caching, Core Web Vitals and accessible navigation.
- Site search with useful ranking/filtering. Avoid indexing arbitrary search query pages.
- WhatsApp-friendly sharing previews.

## Search-target content plan

Build content templates, **not fabricated factual articles**, for:
- Indian groceries in Costa Rica and specific cities where real suppliers exist;
- Indian restaurants in San José/Heredia/Escazú where there is real data;
- sourcing paneer, dahi, fresh milk, spices, basmati and dal;
- moving from India to Costa Rica;
- Costa Rica entry/visa guidance for Indian citizens;
- driving/license requirements and conversion guidance;
- banking, housing, healthcare, entrepreneurship and events.

Avoid doorway pages with empty or duplicated city text. Each factual guide needs review status, sources, last-verified date, clear uncertainty notes and correction form. Revalidate official visa/driving information when rules change.

## Admin SEO/content-quality screen

Show orphan pages, missing source references, old last-review dates, duplicate titles, broken internal links, missing alt text, noindex status and unresolved corrections. Add scheduled review reminders as data flags; do not claim an external notification service exists unless configured.

## External tools

Provide owner instructions for Google Search Console ownership verification, sitemap submission and privacy-aware analytics configuration. Show actual setup status without fabricating visits.

## Acceptance

Inspect HTML without client JS; verify robots/sitemap/canonicals; validate JSON-LD; test public preview snippets, language mapping and changed-slug redirects; run lighthouse/accessibility checks where tooling permits. Commit passing changes.
