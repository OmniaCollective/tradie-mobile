# Build plan: the agreed UX (before build 28)

**Progress (2026-10-08):** sections 1–11 built and committed, each checked natively on the simulator except section 11 (reminders), which still needs its phone check. Next: 12 analytics, 13 accessibility, 14 checks, 15 screenshots and listing.

Everything here was agreed with Paul in the clickable test (https://claude.ai/artifact/QXvzAs14oYerYAaEWkbxcz). Details and reasons: `ux-journey-review.md`. Built in this order, one section at a time, each checked in the simulator before the next.

## 1. Data and updating from 1.5

- Jobs gain: quote sent date, times offered, booked time, done, invoice sent date, paid (+ month), **didn't go ahead**, notes, parts, **one photo list** (no before/during/after), reminder count (for Chase A then B).
- Booking counts as the customer saying yes (no separate "approved" step).
- Account gains: **any number of insurance and licence entries**, reminder switches, which one-off tips have been seen, Appearance.
- **Done (2026-10-08):** `lib/jobSteps.ts` works out each job's place from its facts (one source for every screen); `lib/storeMigrations.ts` holds the update rules; store has checklist actions with undo; 49 tests (`npm run test:jobs`).
  - A job that said yes but has no time yet sits in a **"To book"** group (needed for jobs "Approved" in 1.5).
  - **Cash on the day:** "Mark paid" with no invoice records a paid invoice (so it counts in Money and tax) that doesn't use a free invoice; Undo removes it.
  - **Next step** = the first step after the furthest one reached (a finished job that was never quoted suggests the invoice, not the quote).
  - The old single status is kept in step in the background until every screen has moved over, then removed.
- **Existing users keep everything:** their jobs map onto the new steps and their before/during/after photos merge into one list. Tested with real 1.5 data before building.

## 2. App frame

- Tabs: **Home · Diary** (US: **Schedule**) **· Money · Account**.
- Everything that opens has an **X**. The tab bar never sits over an open page.
- Headers get a solid bar when you scroll (nothing slides under the clock).
- Money shown as "£85", not "£85.00".

## 3. Welcome and setup

- UK headline "Quotes, jobs and invoices. **Sorted.**", US "… **Handled.**", "Built for solo traders."
- Five lines: Quote in minutes · Know where every job is · Get paid on time · Your tax, worked out (Pro) · Never miss a renewal.
- One **Get started** button. Small link: **"Have Pro already? Restore"**.
- Two light steps: trade (5 + More trades + Something else), then About your business (labels above the fields, country from the phone, changeable).

## 4. Home (what needs me)

- First run: "Add your first job" card, then the **Set up your business** list (option A); each row opens its exact page.
- With jobs: **New job** button, count strip (To send · Waiting · To invoice · Unpaid/Overdue), jobs grouped: Quotes to send · Waiting for a yes · Coming up · To invoice · Waiting for payment · Paid · Didn't go ahead.
- **Remind** on quotes with no reply for 3+ days; **Chase** on overdue invoices.
- One-off tip (X): "Start here: add a job, send the quote, and Tradie tracks it to paid."

## 5. New job

- Customer (name, mobile, address optional), job type (trade list + **Something else** with your own name and price), urgency.
- Quote total and **Save job** pinned at the bottom; says what's missing if Save can't be used yet.
- X with anything typed asks "Discard this job?". Save closes to Home: "Job saved · quote not sent yet".

## 6. The job

- Opens and closes freely (X). Nothing changes by opening it.
- **Checklist:** Quote → Booked → Job done → Invoice → Paid, then **Didn't go ahead**. Any step, any order; done steps show tick, date and Undo; the next one highlighted, never forced. Each action saves and keeps you on the job.
- Quote and invoice: preview, Edit, Send, then "Did you send it?".
- Suggest times asks for **where your day starts** (base postcode) the first time it's missing; setup no longer asks for it.
- Booking: Suggest 3 times or pick a time; offered times can be changed or cancelled; tap the one the customer picked.
- **Paid on the day (cash):** the payment is recorded as a numbered invoice marked paid (counts for tax and exports, not a free invoice); the job offers **Send receipt**, a PDF stamped PAID.
- Price (labour + parts), Parts and materials, Notes (first line shows under the title), Photos (add as many as you like).
- One-off tip (X): "This is the job's checklist. Do any step, in any order. Everything saves."

## 7. Diary / Schedule (when)

- Week strip (dots = booked, hollow = offered), month on tap, the day's jobs in time order with offered times pencilled in, to-do list (keyboard-mic tip).

## 8. Money (how's the money)

- Owed to you (overdue count) · Paid this month.
- Owed list, overdue first, with Chase. "N finished jobs not invoiced · £X" (expands). Paid grouped by month.
- Tax below the money: Pro card (set-aside, tax year, profit, UK VAT bar, export); Free = one row with a Pro lock. Expenses the same.
- Upsells one at a time: only "1 free invoice left" or "used all 3".
- Empty state: "Send your first invoice and it shows here…"
- One-off tip (X): "What you're owed, what's come in, and what to put aside for tax."

## 8a. Search and customers (agreed 2026-10-08, for hundreds of jobs and invoices)

Approved by Paul in the clickable test (2026-10-08).

- **One search** (magnifier on Home and Money): finds customers, jobs and invoices by name, INV number, job type, postcode or amount; results grouped Customers · Jobs · Invoices.
- **Customer page:** everything for one customer (jobs, invoices, total paid, anything owed) plus "New job for Sarah".
- **Money stays short:** Paid shows this month open and older months as one line each ("September · £2,340 · 18 invoices"); a tax-year switch (this year / last year).

## 9. Account (me, my business, my settings)

- Short list of pages with summaries ("Not added" when empty): Your business · Getting paid · Prices and tax · Insurance and licences | Diary and reminders · **Reminders** · Appearance | Plan · Sign in · Help and legal | Delete all my data.
- Edit pages: X + Save (grey until something changes); examples only as hints under fields.
- **Reminders page:** switches for quote with no reply (3 days), invoice overdue, job tomorrow, insurance/licence running out. All on by default.
- **Sign in:** promise is "keeps Pro linked to you, and turns on drive times" (it does not bring jobs to a new phone; an iPhone backup does). Signed in: name/email, **Sign out**, **Delete account** (Apple's required one), clearly different from **Delete all my data** (this phone).
- Help and legal: support, privacy, terms, **Show tips again**.

## 10. Paywall fixes

- Per-month price in the App Store's own currency; no gap above the button; "Start Pro · £99.99 a year".

## 11. Reminder texts (editable before sending)

- **Remind (quote):** "Hi Emma, just checking you got my quote for the boiler service (£120). Happy to answer any questions. Dave, Smith Plumbing"
- **Chase, first:** "Hi Sarah, a quick reminder that invoice INV-0041 for £85 was due on 21 Sept. Payment details are on the invoice. Thanks, Dave"
- **Chase, second and after:** "Hi Sarah, invoice INV-0041 for £85 is now 7 days overdue. Could you settle it this week please? Thanks, Dave"

## 12. Anonymous journey analytics

- Privacy-friendly service (Aptabase recommended: official React Native SDK; TelemetryDeck the alternative). No personal data, no tracking prompt.
- Events: setup finished · job saved · quote sent · booked · invoice sent · marked paid · paywall opened · Pro started.
- **Paul:** create the account and send the app key. Update App Privacy ("Usage data, not linked to you") and add a line to the privacy policy.

## 13. Accessibility

- VoiceOver: every button and row has a spoken name; pop-up sheets read as one block (fixes the job type sheet).
- Larger Text: screens grow with the iPhone's text size without cutting words off.

## 14. Checks before build 28

- Typecheck, lint, expo-doctor, all unit tests (tax, scheduling) plus new ones: job steps, the 1.5 data update, reminders, Chase A/B.
- Maestro walks on the simulator: first run, a busy week (every job step), Money, Account, paywall. Light and dark, UK and US.
- Paul clicks through on the simulator.

## 15. After the build

- Re-shoot App Store screenshots and update the listing and review notes (current set shows the old design).
- Build 28 → TestFlight → Paul retests from a fresh install.
