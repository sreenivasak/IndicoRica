# PROMPT 03 — Premium public web experience, directory and search

Apply `00-PROJECT-CONTRACT.md`. Build on the existing code and secured database.

## Goal

Deliver a stunning, actually working, accessible, mobile-first Indian community and Costa Rica discovery site — not just screenshots or disconnected mockups.

## Brand/design

Working name: **IndicoRica**; tagline: **The Indian Guide to Costa Rica**. Brand palette deep forest green, soft ivory, emerald, warm saffron, charcoal. Refined typography, authentic/licensed imagery, fast loading, restrained motion, intuitive navigation. Avoid excessive flag motifs and visual clutter.

## Public pages

- `/`: compelling hero "Your India Connection in Costa Rica", site-wide search, popular searches, topic tiles, latest verified guides, featured genuine businesses, community/events, ad placements and newsletter interest CTA.
- `/guides` and `/guides/[slug]`: categories for visas, driving, banking, housing, healthcare, schools, everyday life, entrepreneurship; related guides, source links, fact-check date and editor corrections.
- `/businesses`, `/businesses/[slug]`: Indian restaurants, groceries, caterers, legal/professional services, transport, community groups; category/city filters, search, pagination, maps only where valid coordinates/address data is present, safe phone/WhatsApp and external links; sponsored disclosure.
- `/food`, `/food/[ingredient]`: paneer, dahi/yogurt, milk, ghee, basmati, atta, dal, curry leaves, spices; Spanish names where verified, dated sourcing tips, suppliers and substitutes.
- `/community`, `/events`, `/advertise`, `/about`, `/contact`, `/privacy`, `/terms`, `/editorial-policy`.
- Consistent search results across article/business/food/FAQ types.

## Real integration

- All directory/guides/ingredient content comes from published database records read via the API; no live UI counters or "recommended" businesses fabricated.
- If using demo content, mark it in UI and exclude from public production indexing; better use curated fixtures in development.
- Server-render meaningful text and metadata for SEO; no client-only blank shell for key landing pages.
- Ensure responsive visuals, keyboard access, contrast, clear loading/empty/error states and touch-friendly navigation.
- Add WhatsApp sharing for public pages and sensible internal linking; safeguard private contact information.
- Make public information accessible without login. Never put critical newcomer guides behind signup.
- English-first with translation-ready content structures. Do not pretend Spanish translations have been reviewed when not.

## Tests / acceptance gate

- Real database-published business appears after API read.
- Search and city/category filters return correct results.
- Draft and private material never leaks.
- SEO HTML has public content when inspected without JS.
- Responsive and accessible on common mobile widths.
- No dead buttons, fake listings, fabricated source links or empty demo metrics.
- Build, type and integration tests pass; commit result.
