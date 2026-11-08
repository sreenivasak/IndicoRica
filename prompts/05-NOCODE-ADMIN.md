# PROMPT 05 — No-code admin dashboard for nontechnical family operators

Apply `00-PROJECT-CONTRACT.md`. Continue the working repo and security policies.

## Goal

Build a **simple, complete, working admin CMS**. A nontechnical person should add/edit/delete content and configure placements without writing code or SQL.

## Main `/admin` navigation

Dashboard; Homepage; Pages; Articles/Guides; FAQs; Businesses; Food Finder; Community Moderation; Events; Advertising; Media; Menus; SEO; Users/Roles (super admin only); Settings; Audit History.

## Interfaces to implement

**Homepage builder** — controlled reusable section library, drag/reorder or simple arrows, edit hero headings/images/buttons, choose featured businesses and guides, display/hide sections, preview responsive page.

**Page and article editor** — safe WYSIWYG/block editor supporting headings, paragraphs, lists, tables, images, steps, FAQ, links, source citations, related content, ad-slot placeholders; content sanitization. Support Save Draft, Preview, Schedule, Publish, Unpublish, Archive, Trash, Restore Revision and duplicate.

**Business manager** — structured form: name, categories, description, province/city/address, map URL, website, hours, phone/WhatsApp (permission required), photos, items sold, verification evidence and date, owner claim status, publish status. Prevent duplicate slugs.

**Ingredient/source manager** — link ingredients to verified suppliers, Spanish names, last-known availability dates, substitutes, source, approval status. Do not advertise old stock data as current.

**WhatsApp tips inbox** — paste permitted messages/upload approved exports with privacy review and source date. Extract candidate structured facts manually; optional AI extraction only if a real affordable provider is approved. Nothing auto-publishes. Private names and numbers are redacted by default.

**Media library** — optimize photos, alt text, limit files, validate MIME, safe public/private storage, no executable uploads.

**Navigation/SEO** — edit menus/footer links and SEO titles/descriptions/social images in forms, no code.

**Users** — review membership, ownership verification, contributions; only super admin may grant elevated roles with auditable confirmation.

**Audit/revisions** — record actor/time/changed fields, allow rollback, recover deleted pages.

## UX principles

- Plain English, large action labels, inline help, field-level validation, clear success/failure messages, responsive desktop/tablet use.
- Never allow accidental irreversible deletion; show confirmation and undo/trash.
- Warn on unsaved changes and invalid URLs.
- Forms must actually send API requests, persist to DB and refresh public views; no decorative buttons.
- Operational content edits must not require a rebuild or redeploy.

## Acceptance — ask a genuine nontechnical tester

1. Sign into `/admin`.
2. Add grocery business with photo, city, products and authorized WhatsApp.
3. Save draft, preview, publish and see public listing.
4. Add paneer sourcing info linked to business.
5. Write guide with FAQ and official source, preview/publish.
6. Edit homepage hero and menu item.
7. Unpublish business, then restore it.
8. Restore earlier article revision and see audit log.
9. Confirm editor cannot manipulate role grants or ad scripts.

Document actual test outcomes, fix confusion and failures, then commit.
