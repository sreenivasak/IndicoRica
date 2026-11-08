# PROMPT 06 — Safe advertising, Q&A, events and knowledge contributions

Apply `00-PROJECT-CONTRACT.md`. Build on existing deployed layers and working admin.

## Advertising (revenue foundation)

Implement `ad_placements`, `ad_campaigns`, `ad_creatives` and related entities with admin forms for:

- Uploaded image banners, direct sponsor links, featured business listings, sponsored category tiles and clearly labeled sponsored articles.
- Placement catalog: homepage hero-ad zone, homepage inline, guide inline, business category, business page, desktop sidebar, mobile inline and footer where nonintrusive.
- Advertiser, creative, safe click destination, device/category targeting, dates, priority, active/paused/expired status, disclosures and reporting.
- Basic impressions and clicks recorded with privacy-aware protections against bot/repeated inflation; avoid personal profiles or fabricated figures.
- Manual campaign approval and invoicing inquiry first; do not pretend a payment gateway exists.

## Third-party ad scripts — strict security

1. Maintain an **allowlist** of reviewed ad providers, starting with approved Google AdSense/Google Ad Manager integrations **only when accounts are available**.
2. Admin inputs publisher IDs/slot IDs via **structured validated forms**. Never store/execute raw arbitrary HTML/JS from members, advertisers or ordinary editors.
3. Super admin alone can enable a reviewed provider integration; separate provider review from campaign editing.
4. CSP and consent management must permit reviewed provider sources without blindly permitting all script origins or `unsafe-inline` unless assessed/documented.
5. Global kill switch disables all third-party ads immediately.
6. Sponsored labels are always visible, including search and featured results.
7. Ads may not interfere with editor controls, privacy, mobile accessibility or page performance.

## Community

- Member Q&A: submit, categorize, search, answer, save, report and moderator approve/reject.
- Guest correction form with server-verified Turnstile and rate limits.
- Community event submissions: name, date, organizer, venue, approval, automatic "past" state, optional sponsored flag.
- Business claim review workflow; moderation decisions tracked in audit log.
- WhatsApp-derived tips are reviewed/redacted before a public FAQ/article is created. Do not publish private chat exports or personal details automatically.

## Emails

Allow optional notification hooks for approval and important account notices. Clearly indicate if no sender has been configured; do not simulate delivery.

## Tests and gate

- Upload, schedule, display, pause and expire a direct banner on correct pages.
- Confirm other pages do not show wrong ad placements.
- Confirm a member/advertiser/editor cannot execute scripts or change provider allowlist.
- Confirm global kill switch and CSP behavior.
- Sponsored labels visible to all visitors.
- Community Q&A stays hidden before moderator approval.
- Cross-role and DB RLS negative tests pass.
- APIs and UI work and code is committed.
