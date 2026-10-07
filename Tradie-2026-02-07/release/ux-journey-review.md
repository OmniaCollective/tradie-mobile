# UX journey review: first run (build 28 code)

Walked natively (Release build, simulator, Maestro) as a brand-new UK plumber: Welcome → Not now → trade → details → Home → Add a job → saved job. Paul: "didn't feel right the way I landed and went in; needs to be more subtle, a better user journey."

## Paul's notes

- Keep the "Set up your business" task list up front on first-run Home.
- Job type needs an "Other" option.

## Findings (worst first)

1. **Job screen: main button contradicts the status.** New job says "Requested · Send the quote", but the pinned cyan button is "Customer approved the quote". Sending the quote is a small row halfway down.
2. **Job screen shows everything at once.** When (suggest/pick a time) sits above Quote; then Edit/Preview/Send, Parts, Notes, Photos, a Pro upsell for Expenses, Delete. Title and description both read "Leaking Tap".
3. **Welcome leads with Sign in with Apple** before the user has seen anything; "Not now" is the real path. Sign-in only matters for Pro on a new phone and drive times.
4. **Details step is a long form** (country, name, business, phone, postcode, hourly rate, minimum charge). Right-aligned grey placeholders ("07700 900000", "SE1 7TP") look like filled-in values. Disabled Continue (dull teal) looks broken.
5. **Add Job:** required fields not marked; Save stays grey with no reason given. Urgency duplicates the "Emergency Call-out" job type. Quote is only at the bottom, off screen. "£85.00" where "£85" reads cleaner. No "Something else" job type.
6. **Set-up checklist rows all open the Account tab**, not the thing they name.
7. **Job type sheet may be unreachable with VoiceOver** (Maestro couldn't see inside it). To verify.

## Proposed journey (for mockups, then Paul's approval)

- **Welcome:** logo, headline, three short benefits, one "Get started". Sign-in offered when it pays off (buying Pro, first Suggest times).
- **Setup, two light steps:** trade; then name, business, phone. Country from the phone region (changeable). Postcode and rates asked when first needed; trade rates shown and editable in the job type list.
- **Home first run:** "Add your first job" card + set-up list up front; each row opens its exact screen.
- **Add Job:** required fields marked; "Something else" with your own name and price; quote total always visible; one urgency control.
- **Job screen led by its stage:** one main button that matches the status (Send quote → Customer said yes → Book it → Mark done → Send invoice → Mark paid); only the sections relevant now; extras under "More"; no upsells on the first job.

## Still to walk natively

Quote send → approve → book → done → invoice → paid; Money; Account; paywall; returning-user Home with data.

## Agreed with Paul (2026-10-07), tested in the clickable prototype

Prototype: https://claude.ai/artifact/QXvzAs14oYerYAaEWkbxcz

- **Set-up list: option A.** First-job card up front, "Set up your business" list underneath; each row opens its own item.
- **Home count strip:** To send · Waiting · To invoice · Unpaid/Overdue (Paul: "love it").
- **Home groups jobs by where they are:** Quotes to send · Waiting for a yes · Coming up · To invoice · Waiting for payment · Paid · Didn't go ahead.
- **Reminders on Home rows:** "Remind" when a quote has had no reply for 3+ days; "Chase" when an invoice is overdue.
- **New job must be saved.** Save closes back to Home ("Job saved · quote not sent yet"). X with anything typed asks "Discard this job?".
- **A saved job opens and closes freely (X).** Nothing changes by opening it.
- **Job screen = checklist of every action:** Quote → Booked → Job done → Invoice → Paid. Any step, any order; done steps show a tick, date and Undo; the next one is highlighted, never forced. Each action saves and keeps you on the job.
- **Book = the customer said yes.** No separate "approved" step. Suggest 3 times or pick a time; offered times can be changed or cancelled.
- **"Didn't go ahead"** is the last checklist row; the job is kept and can be reopened.
- **Every job has Price (labour + parts), Parts and materials, Notes and Photos (one strip, add as many as you like).**
- **Everything that opens has an X to close it.**
- **Welcome copy (agreed, final):** UK headline "Quotes, jobs and invoices. Sorted." · US headline "Quotes, jobs and invoices. Handled." · "Built for solo traders." · five lines:
  - Quote in minutes · From your own prices, sent as a PDF
  - Know where every job is · Quoted, booked, invoiced or paid
  - Get paid on time · Due dates, reminders and one tap to chase
  - Your tax, worked out · What to set aside, as you go (Pro)
  - Never miss a renewal · Insurance and licences with reminders (US: licenses)
  One "Get started" button; sign-in as a small link.
- **Tabs:** Home (what needs me) · Diary/Schedule (when) · Money (how's the money) · Account.
- **Diary (UK) / Schedule (US):** week strip (dots = booked, hollow = times offered), tap the month to open the full month; the day's jobs in time order with offered times pencilled in; to-do list underneath (keyboard-mic tip). No statuses or money here.
- **Money:** two numbers (Owed to you with overdue count · Paid this month); Owed to you list, overdue first with Chase; one line "N finished jobs not invoiced · £X" (expands); Paid grouped by month with totals; Tax below the money (Pro card with set-aside, tax year, profit, UK VAT bar, export; Free = one row with a Pro lock); Expenses (Pro list + "lowers your tax"; Free = one locked row); export moves from the header into Tax; no "3 of 3" banner, only "1 free invoice left" or "used all 3"; friendly empty state. "Not invoiced yet" appears on both Home (as jobs to act on) and Money (as money not asked for).

## Account and paywall findings (to decide)

- Account leads with Sign in + Free plan upsell before the business details.
- Grey example text looks like real data: "Bank: Your Bank, Sort code 00-00-00, Account 12345678", "you@example.com", "12 High Street, London" (placeholders only, never saved or printed).
- Scrolled content slides under the status bar (clock overlaps text).
- Paywall mixes currencies when the App Store country differs: "$99.00" with "£8.25 a month" (per-month uses the app's currency, not the store price's). Big empty gap above the button; "Start Pro — …" uses a long dash.
