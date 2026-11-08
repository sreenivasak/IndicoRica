# PROMPT 09 — Owner handover, editor manual and maintenance

Apply `00-PROJECT-CONTRACT.md`. Produce final operating documentation for IndicoRica. Do not change working code unnecessarily.

## Task 1: Nontechnical admin user manual

Write a friendly, screenshot-supported (using *actual* application screens where available) guide for an operator who has never written code. Include precise clicks for:
- login / MFA / logout;
- adding an Indian grocery business with WhatsApp, location, photo and verified source;
- writing a guide and linking official references;
- adding a food ingredient and supplier observation;
- changing hero/homepage cards;
- editing navigation and SEO titles;
- scheduling direct ads and disabling a campaign;
- reviewing community submissions and protecting private WhatsApp content;
- restoring page revisions, archiving items and handling corrections.

No coding, SQL or command line steps in the routine user guide.

## Task 2: Technical owner manual

Create `docs/OPERATIONS.md` with:
- Architecture and deployed environment inventory (no secrets).
- GitHub workflow and rollback.
- Cloudflare deploy process and staging/prod distinctions.
- Supabase migrations and authorized admin bootstrap.
- OAuth and email sender troubleshooting.
- Backup schedule and tested restore instructions.
- Free-tier quota checking, escalation triggers and costs.
- Security updates and maintenance checklist.
- Incident response (suspicious login, data leak, hacked ad, failed backup).
- Privacy requests, ownership disputes, misleading supplier claims and moderation.

## Task 3: Real onboarding rehearsal

Guide an owner-controlled editor through adding a mock private draft, publishing a verified example, modifying it, making an ad request and restoring the previous version. Record actual observations and correct confusing labels. Do not upload private personal data to test.

## Task 4: Final report

Create a matrix of required features vs actual statuses: working, configured but not activated, deferred with cost, or blocked. Explicitly list phone OTP, ad network approval, production email delivery, custom domain, backup automation and future AI-assistant expenses.

Provide a final short launch/handover checklist with verified evidence and Git commit. Never claim the user manual includes screenshots unless screenshots were created from the real app.
