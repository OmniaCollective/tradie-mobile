# TestFlight feedback: build 27

Collect everything first, fix in one pass, then one build. Nothing is built until this list is agreed.

| # | Where | What Paul found | Status |
|---|---|---|---|
| 1 | Install | Updating over 1.5 skipped the Welcome screens | Expected (existing users skip onboarding). Delete + reinstall to see them |
| 2 | Home (no jobs) | Copy says "type it in" but nothing is tappable; only the + New job button works | Fixed in code: "Say it" / "Type it in" buttons + set-up checklist (not built). Order changes per #16: Type it in first |
| 3 | Home (first run) | Should land on a choice (profile or job), not a single add-job button | Fixed in code with #2 (not built) |
| 4 | Voice | "leaking bathroom tap" → customer name "Li King" | Fixed in code: vocabulary hint + stricter name rules (server not deployed) |
| 5 | Check the job | No obvious way to correct what voice filled in | Partly fixed in code: "Record again" + hint. Still to do: fields don't look editable |
| 6 | Job screen | No way to edit job type, description or urgency after saving | To do |
| 7 | Add Job | App crashed on Back / Cancel | Fixed in code (not built) |
| 8 | Whole app | Opened in light mode; Paul prefers dark. Needs a light/dark switch in Account | To do: Appearance setting in Account (Automatic · Light · Dark) |
| 9 | Add Job | **Crash** on Save after adding a job (seen twice) | Same root cause as #7: leaving Add Job any way (Back, Cancel, Save) runs the recorder clean-up that crashes. Fixed in code with #7 (not built). The job is saved before the crash |
| 10 | Add expense | Amount cuts off / looks broken after typing the £ amount | Cause: box width is guessed per character (24pt), too narrow for large bold digits, so iOS scrolls the text sideways. Fix: measure the real text width. To do |
| 11 | Money / Expenses | Expense looked like it was taken off the invoice (it was the Tax card: income − expenses = profit). Also can't tell general from job expenses | Left as is for now (Paul) |
| 12 | Invoices / quotes | No way to see an invoice before sending, and no way to edit an invoice | Agreed: full-screen **Preview** (invoice and quote) with **Edit** and **Send**; edit an unpaid invoice's labour, materials, travel and description. Uses `react-native-webview` (Paul approved adding it) |
| 13 | Invoices | Opening Send marks the invoice "Sent" even if the share sheet is cancelled | Agreed: after the share sheet closes, ask "Did you send it?" → Yes, mark as sent / Not yet |
| 14 | Whole app | "How can we make it clearer what is on the screen and happening" | Agreed: (1) confirmation after every action, (3) statuses that say the next step, (4) helpful empty states. Dropped: permanent screen explainers (not best practice); instead a one-off dismissible tip on the Tax card |
| 15 | Home | After Welcome, the Home landing needs to be better; move the cyan **New job** button below "Evening, John" | To do: greeting first, then a full-width New job button under it; first-run Home as in #2/#3 |
| 16 | Add Job | Should open on the typing form, not the recorder. Voice is an option, not the lead: most people will type | To do: Add Job opens on the form with a "Say it instead 🎤" option at the top; first-run Home puts **Type it in** first and **Say it** second |
| 17 | Voice | Voice could irritate people when it's wrong. Use it only for notes and reminders | Decided: Tradie's own voice is off for 1.6 and out of the Pro offer; the iPhone keyboard's dictation is used for notes and to-dos (with a hint). Voice button saved for later. See plan section 3a |

## Still to test

- Welcome → trade → details (fresh install)
- ~~Paywall prices, buy Pro~~ ✅ worked (Paul, build 27); restore still to test
- Quote PDF, invoice PDF, Chase, Mark paid
- Suggest times, booking, reminders
- Money / tax / expenses / export
- Account: profile, insurance and licences, delete data
