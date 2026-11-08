# IndicoRica launch gate checklist

Fill in evidence (URL, screenshot, test output, commit SHA) before marking complete.

| Gate | Pass? | Evidence |
|---|---|---|
| Browser → API → database POC deployed | ☐ | |
| Frontend / backend source separated | ☐ | |
| RLS + negative authorization tests | ☐ | |
| Google sign-in and logout on deployed domain | ☐ | |
| Production email sender configured and tested | ☐ | |
| Admin MFA and safe role assignment | ☐ | |
| Business owner restricted to owned listings | ☐ | |
| Nontechnical editor end-to-end CRUD | ☐ | |
| Ad allowlist, disclosures, global kill switch | ☐ | |
| Rich-text, URL and file upload hardening | ☐ | |
| Cross-origin auth, CORS/CSRF strategy tested | ☐ | |
| Backups encrypted and restore tested | ☐ | |
| SEO SSR HTML, canonical, sitemap validated | ☐ | |
| Public legal/privacy/editorial policies | ☐ | |
| Responsive mobile screens tested | ☐ | |
| Free tier usage and paid triggers documented | ☐ | |
| No secrets or demo content in production | ☐ | |
| Operator handover walkthrough completed | ☐ | |

**Block launch if any authentication, authorization, secret-handling, backup, or untrusted script security gate fails.**
