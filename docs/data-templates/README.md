# Data templates (fill in, then we load them)

Open each `.csv` in Excel or Google Sheets. Keep the header row. One row per item. **Only enter what you have
actually seen or confirmed. Leave a cell blank rather than guess.**

## 1-shops-and-businesses.csv
| Column | What to put |
|---|---|
| name | Shop/restaurant name as written on the sign |
| category | restaurant, grocery, or services |
| area / city | e.g. Cariari / Heredia |
| address | optional |
| website | only if it starts with `https://` |
| sells_groceries | yes / no |
| source_of_info | how you know it exists: "I shop there", "saw it on 2026-11-08", "their Instagram" |
| date_checked | YYYY-MM-DD |
| owner_allows_public_phone | **yes only if the owner told you we may show their number**; otherwise no |
| phone / whatsapp | fill ONLY if the line above is yes (include +506) |

## 2-grocery-sightings.csv (milk, curd/dahi, paneer, spices...)
One row per product **per shop per visit**. Availability changes, so the **date is required**.
how_you_know: `I bought it`, `I saw it on the shelf`, `shop told me`. Price is optional; skip if unsure.

## 3-guide-steps-driving-license.csv
Write each step in your own words. For every step say where it comes from:
- `official` — you read it on a government/licensing page: fill official_source_title, **official_source_url (https)** and date_you_read_it.
- `experience` — you did it yourself. It will be shown as a **community tip**, not as a rule.
- `told_by_someone` — a clerk or friend said so. It stays a draft until confirmed from an official page.

The site will not publish this guide until it has an official source and an editor has reviewed it.

## 4-events.csv
Title, date and time, place, organizer and a link. Events start as pending until an editor approves them.

## Privacy
Do not put in private WhatsApp group messages, names or screenshots, or anyone's phone number without their permission.
