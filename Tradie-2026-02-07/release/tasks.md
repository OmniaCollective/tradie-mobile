# Tasks

## To do

### Logo on quotes and invoices (free)
First-user request. Upload, change or remove a logo in Account / Business details, using
`expo-image-picker` (already used for receipts). Copy it into the app's own storage, like
`src/lib/receipts.ts`. It shows top-left on both PDFs. Embed it in the HTML as base64,
because `expo-print` can't load files from app storage. Free for everyone.

### Invoice and quote extras (free)
- No brand colour option. All PDF text is black, including the business name and
  total, which are teal today (`PDF_STYLE` in `invoiceExport.ts`).
- Footer note or terms, written separately for quotes and invoices.
- Quote validity ("Valid for 30 days"), set by the tradie.
- Extra business details, such as company number and website.
- Files: `src/lib/invoiceExport.ts`, plus new fields in `BusinessSettings`.

### PDF layout
- Page margins on every page.
- `break-inside: avoid` on rows, totals and the payment box.
- Column headings repeated on each page, and "Page X of Y".
- A4 for the UK and Letter for the US: `printToFileAsync` currently always uses Letter.

### Line items
Full plan: `line-items-plan.md`. Itemised lines are free. The price list and parts
markup are Pro. The markup is edited in Account → Prices (next to hourly rate and
minimum charge), and can be changed on each line.

Quotes stay free and unlimited (decided 2026-10-15).

### Profit box is Pro
On the job screen (`src/app/job/[id].tsx`, "Profit"). Free users see a locked version
that opens `UpgradePrompt`. The parts list itself stays free.

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
