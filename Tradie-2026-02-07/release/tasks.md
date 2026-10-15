# Tasks

## To do

### Fix the invoice loopholes (free plan: 3 invoices a month)
Found 2026-10-15. Free users can send more than 3 invoices a month in two ways:

1. **"Not yet" on "Did you send it?"** An invoice only counts toward the 3 when the tradie
   confirms "Yes, mark as sent" (`sentAt`, counted in `src/lib/useProAccess.ts`). If they
   tap "Not yet", the customer still has the PDF, but it never counts.
2. **Money tab "Send invoice" has no limit check.** `handleSendInvoice` in
   `src/app/(tabs)/finances.tsx` shares the PDF without checking `canCreateInvoice`. Only
   the preview's Send button (`src/app/preview.tsx`) and creating an invoice from the job
   screen are checked. A free user can create several invoices while under the limit,
   then send them all from the Money tab.

**Fix:**
- Count a free invoice the first time its PDF leaves the app, by any route:
  - preview Send
  - Money tab Send
  - Send again / Share PDF
  - Chase (the SMS attaches the PDF, `src/lib/chase.ts`)
- Record that as its own date (e.g. `firstSharedAt`), separate from "marked as sent", and
  count by it in `useProAccess`.
- Run the same limit check before every one of those routes, so it lives in one shared
  helper, not repeated on each screen.
- "Did you send it?" then only sets the due date and status, not the free count.
- Receipts from Mark paid (`recordedOnly`, the PDF says "Paid") stay free.
