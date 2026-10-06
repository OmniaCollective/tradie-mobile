# Tradie — brand brief for the brand guidelines document

Approved by Paul Vosloo (Omnia), 6 October 2026. This brief is the source of truth for a Tradie brand guidelines document. Everything below is decided; nothing here is a suggestion to reinterpret.

- Live design canvas (all screens, dark and light): https://claude.ai/artifact/U9rkFMrBcQQnCnRLvCzF4T
- `logo/tradie-logo.png` — mascot + TRADIE wordmark, 1774×1774, transparent
- `logo/tradie-app-icon-1024.png` — App Store icon, 1024×1024
- `screens-source/` — the source of every approved screen (`.dc.html`). `Main.dc.html` is the one-page system summary.

## 1. What Tradie is

An iPhone app for UK sole-trader trades (plumbers, electricians, gardeners, cleaners, handymen). It turns a job into a quote, an invoice and a live tax set-aside figure.

Positioning line: **Quotes, jobs and invoices. Sorted.**
Support line: Built for UK sole traders. Know what to set aside for tax as you go.

Audience: people working on site, often outdoors, phone in one hand. That is why contrast, large tap targets and short words matter more than decoration.

Markets: United Kingdom (primary) and United States. Currency in copy is £. Tax language is UK (HMRC, Income Tax, NI, VAT).

## 2. Logo

- The mascot (a winking tradesman in a teal cap) above the **TRADIE** wordmark.
- Wordmark colour: cyan `#00FFFF`. App icon background: cyan `#00F5F5`.
- In the app UI the wordmark is set as text: system font, weight 800, letter-spacing 0.14em, uppercase, in the accent text colour.
- Not yet defined (the guidelines doc should propose, then flag for approval): clear space, minimum size, a one-colour version, use on photography.

## 3. Colour — 8 tokens, two modes

Principle: **neutrals do the work.** One cyan accent means "do this" or "money in". One red means "needs attention now". Nothing else carries colour.

| Token | Use | Light | Dark |
|---|---|---|---|
| background | Screen behind everything | `#F3F5F7` | `#0F172A` |
| surface | Grouped lists, sheets, tab bar | `#FFFFFF` | `#1E293B` |
| divider | Lines inside lists, input borders | `#E4E7EB` | `#334155` |
| text | Titles, body, amounts | `#0B1220` (17.1:1) | `#F8FAFC` (14.0:1) |
| secondary | Supporting text, idle icons | `#5B6676` (5.8:1) | `#94A3B8` (5.7:1) |
| accent | Logo cyan: primary buttons, active marks | `#00F5F5` | `#00F5F5` |
| accent text | Links, active tab, "Paid" | `#0E7C86` (5.0:1) | `#00F5F5` (10.7:1) |
| alert | Overdue, emergency, delete | `#B91C1C` (6.5:1) | `#F87171` (5.3:1) |

- Text on the accent fill is always navy `#0F172A` (13:1), in both modes. Never white on cyan.
- In light mode, cyan text on white is unreadable (1.4:1), so links use **accent text** `#0E7C86`, a deepened version of the logo's cap teal (`#298B98`).
- Ratios are WCAG contrast against the surface colour. Every text colour passes AA (4.5:1).
- Retired: the old app turquoise `#14B8A6` and the multi-colour status palette (blue, purple, orange, amber, green). Do not use them.

## 4. Status

Status is shown as words with a line icon, not coloured badges.

| Status | Colour | Icon (Lucide) |
|---|---|---|
| Scheduled | secondary | calendar |
| Quoted | secondary | file |
| Done | secondary | check |
| Invoiced | secondary | send |
| **Paid** | accent text | circle-check |
| **Overdue** | alert | circle-alert |
| **Emergency** | alert | triangle-alert |

## 5. Icons

- Lucide, line only, stroke 2, round caps and joins.
- Never filled, never on a coloured tile or circle, never emoji.
- Sizes: 16 inline with small text · 20 in rows and buttons · 24 tab bar and header.
- Colour: secondary when idle, accent text when active or tappable, alert only beside an alert.
- Money is always the pound icon (`pound-sterling`), never a dollar sign.

## 6. Type

System font (SF Pro on iPhone).

| Style | Size / weight |
|---|---|
| Title | 28 bold, letter-spacing −0.01em |
| Heading | 17 semibold |
| Body | 16 regular |
| Secondary | 14 regular |
| Caption | 12 regular |

Section titles are sentence case ("Quotes waiting"), not uppercase labels.

## 7. Layout, spacing, shape

- 16 px from the screen edge on every screen; 16 px inside groups; 32 px between sections.
- Grouped lists: 16 px corners, no border; the surface colour separates them from the background. Thin dividers between rows.
- Buttons: 12 px corners, 48–52 px tall. Anything tappable is at least 44 px.
- One primary (cyan) button per screen. Secondary buttons are surface with a divider border. Destructive actions are alert-coloured text, not red fills.
- No gradients, no drop-shadowed cards, no floating action button.

## 8. App structure (approved)

- Tabs: **Home · Jobs · Money · Account** (icons: house, calendar, pound-sterling, user).
- "+ New job" is a cyan button in the Home header (replaces the floating + button).
- Home order: greeting + date → Unpaid / Paid this month → Next up (with Call, Directions) → Quotes waiting. The to-do list is not on Home.

## 9. Approved screens (on the canvas, dark and light)

1. **Welcome + sign in** — three benefits (voice jobs, quote and invoice, tax worked out), "Continue with Apple" (Apple's black/white button style), "Not now".
2. **Your trade** — step 2 of 3, list of trades with line icons, tick on the chosen one, Continue.
3. **Home** — as section 8.
4. **Tradie Pro** — four benefits with ticks, Yearly £99.99 ("£8.33 a month · 2 months free", preselected) or Monthly £9.99, "Start Pro", Restore purchase, Terms, Privacy, auto-renew line, "Free plan: 3 invoices a month".

## 10. Voice and copy

- Plain, short, British English ("organise", "colour", "£").
- Talk like a mate who's good with money, not a bank: "Sorted.", "Next up", "Quotes waiting".
- Numbers first; never vague ("£92.00 unpaid", "1 overdue").
- No claims the app can't back up (e.g. no "MTD-ready" until HMRC submission exists).

## 11. What the guidelines doc should contain

Logo (with proposed clear space and minimum size, flagged for approval), colour tokens for both modes with contrast, status system, icon rules, type scale, spacing and shape, buttons, the four approved screens in both modes, voice and copy, and do / don't examples (e.g. white on cyan, coloured status badges, filled icons, dollar icon).
