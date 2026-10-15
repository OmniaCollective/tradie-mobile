# Line items: plan (not built)

Status: plan only, 2026-10-15. Prompted by first-user feedback on invoices.

## Goal

Replace the fixed price rows (Labour, Materials, Travel, Emergency surcharge) with itemised
lines the tradie writes, on quotes and invoices, without breaking a single existing quote,
invoice or total.

Best in class for a solo tradie means:
- Adding an item takes seconds: a saved price list, and parts already on the job.
- The customer sees a clear, professional breakdown, and the tradie can choose how much
  of it to show.
- Money stays right: VAT, CIS and profit work from the lines, not from guesses.

## 1. Data model (`src/lib/store.ts`)

```ts
type LineKind = 'labour' | 'materials' | 'other' | 'discount';

interface LineItem {
  id: string;
  kind: LineKind;          // drives CIS, profit and the accountant pack
  description: string;     // "Monobloc mixer tap"
  quantity: number;        // 2, 1.5 (hours)
  unit?: string;           // 'hr' | 'm' | 'm²' | 'day' | undefined (= each)
  unitPrice: number;       // what the customer pays, before VAT; discount lines are negative
  vatRate?: number;        // UK VAT-registered only; unset = settings.vatRate
  unitCost?: number;       // what the tradie paid (materials from parts), for profit and markup
  partId?: string;         // the job part it came from
  auto?: boolean;          // the labour line made from the job type and urgency
}

interface Quote {
  id; jobId; validUntil; createdAt;
  lines: LineItem[];
  showItemPrices?: boolean;  // false = PDF lists items but shows only the totals
  subtotal: number;          // derived, stored as a snapshot
  vat: number;               // derived, stored
  total: number;             // derived, stored
  /** Only on quotes from before line items. Kept, not used. */
  labour?; materials?; travel?; emergencySurcharge?;
}
```

- **One pricing function, `priceLines(settings, lines)`.** It replaces `priceQuote` and
  returns subtotal, VAT by rate, total, and the labour and materials subtotals. It's the
  only place money is added up. Pence are rounded per line, and VAT is rounded per rate
  group (which is how HMRC expects it).
- **`total` and `vat` stay on `Quote`.** Finances, the accountant pack, chasing and the tax
  estimates only read those two fields (checked), so they don't change.
- **Invoices stay snapshots.** `createInvoice` already copies the quote, and that doesn't
  change. Prices are never recalculated on a saved invoice unless the tradie edits it.

## 2. Migration (`storeMigrations.ts`, STORE_VERSION 9 → 10)

For every `job.quote` and `invoice.quote`, turn each non-zero old field into a line:
- `labour` becomes `{ kind: 'labour', description: <job name>, quantity: 1, auto: true }`
  on jobs, and the same without `auto` on invoices.
- `materials` becomes "Materials", `travel` becomes "Travel" with kind `other`, and
  `emergencySurcharge` becomes "Emergency call-out" with kind `labour`.
- Copy the stored `vat` and `total` exactly. Never recalculate them, because the VAT rate
  may have changed since the quote was made.
- Leave the old fields where they are, as earlier migrations do.

Test that every migrated quote's lines add up to its stored subtotal to the penny.

## 3. Entering items

### Price editor: one new screen, `src/app/price.tsx` (`/price?kind=quote|invoice&id=`)
Both the job screen (`job/[id].tsx`) and `preview.tsx` have their own copy of the Labour,
Materials and Travel sheet. Both copies are replaced by this one screen.
- **Lines:** a grouped list, each showing the description, "2 × £7.50", and the amount.
  Tapping a line opens its edit sheet, and the trash icon removes it.
- **Reorder:** an "Arrange" mode with drag handles (gesture-handler and reanimated are
  already installed).
- **Add item:** opens a sheet to search the price list, with recent items first, then:
  - "From this job's parts" (see below)
  - "New item": description, kind, quantity, unit, price, and "Save to price list"
- **Discount:** a fixed amount or a percentage, shown as its own line.
- **Totals at the bottom:** subtotal, discount, VAT (split by rate when there's more than
  one), total, with "Save" as the one primary button.
- **"Show item prices on the PDF"** toggle.
- **Keyboard:** use `react-native-keyboard-controller` so fields aren't hidden (CLAUDE.md
  warns this is fiddly).

### The job screen's Price section
It shows the lines in short form (first 5, then "and 3 more"), with Edit opening `/price`.
The "doesn't include £X of parts" prompt changes to "3 parts aren't on the price. Add them".

### Price list: Settings, then "Price list"
- New `priceList: SavedItem[]` in the store (description, kind, unit, price, plus last
  used for sorting).
- Seeded empty, with a few examples for the tradie's trade shown as suggestions, not
  saved.
- Edit and delete it in Settings. Add to it from the "New item" sheet.

### Parts become materials lines
The job's "Parts and materials" list stays the record of what was bought, at cost.
"Add from parts" turns each part into a materials line with
`unitPrice = unitCost × (1 + markup)`, keeping `partId` and `unitCost`.
- A new `materialsMarkupPercent` setting, default 0, with the markup editable per line.
- Profit uses each line's `unitCost`, so the profit box stays right even with a markup.

### Job type and urgency
`calculateQuote` and `calculateCustomQuote` make a single `auto` labour line. Changing the
job type or urgency only updates the `auto` line, which matches today's "Labour changes
to £X. Materials and travel stay as they are". Once the tradie edits that line by hand,
it's no longer `auto`.

## 4. Money rules

- **VAT:** only for UK VAT-registered traders, as now. Lines can have their own rate
  (20 / 5 / 0) for things like energy-saving materials. The PDF shows a VAT line for each
  rate in use.
- **CIS (fixes an existing bug):** HMRC's CIS deduction is taken from the labour part
  only, excluding materials and VAT. Today `createInvoice` and `updateInvoicePrices` take
  `total × cisRate`, which includes materials and VAT. That deducts too much, so the
  invoice's "To pay" figure is too low. With lines, the deduction becomes
  `labourSubtotal × cisRate`. Also worth fixing in 1.6.x on its own:
  `(total − VAT − materials) × cisRate`. Done 2026-10-15, see `src/lib/cis.ts`.
- **Discounts** reduce the subtotal before VAT. A discount can't take the total below
  zero.
- **Out of scope:** the domestic reverse charge (construction VAT) and US sales tax. Note
  them for later.

## 5. PDF (`src/lib/invoiceExport.ts`)

- **Table:** Description · Qty · Unit price · Amount. Unit prices are hidden when
  `showItemPrices` is false.
- **Totals block:** subtotal, discount, VAT per rate, total. The CIS block uses the labour
  subtotal.
- **Multi-page:**
  - `break-inside: avoid` on rows, totals and the payment box (as `accountantPack.ts`
    already does)
  - `<thead>` repeated on each page
  - page margins passed to `printToFileAsync`
  - "Page X of Y" in the footer
- **Paper size:** A4 for UK and Letter for US (from `getRegion()`). At the moment it's
  always Letter.

## 6. Pro or free

- **Free:** itemised lines, so the core invoice is good for everyone.
- **Pro:** the price list and the parts markup. These save time, which is a good reason
  to upgrade.

## 7. Tests (`scripts/*.test.mts`, same pattern as `ukTax.test.mts`)

- `lineItems.test.mts`:
  - rounding
  - VAT grouping by rate
  - discount (amount and percentage)
  - CIS on labour only
  - quantities like 1.5 hours
- Migration test using `sampleData.ts` quotes and invoices. Totals must be unchanged and
  lines must be correct.
- Gate (CLAUDE.md): `npx tsc --noEmit`, `npx expo-doctor`, `npx eslint . --quiet`.

## 8. Phases and estimate

| # | Work | Days |
|---|------|------|
| 1 | Model, `priceLines`, migration, tests | 1 |
| 2 | `/price` editor (replaces both old sheets), job screen summary | 1.5 |
| 3 | PDF table, multi-page, A4/Letter | 0.5–1 |
| 4 | Price list, parts to materials with markup, profit | 1 |
| 5 | CIS on labour, per-line VAT | 0.5 |
| 6 | Device QA, upgrading from 1.6.1 data | 0.5–1 |
|   | **Total** | **5–6** |

This ships as the next version after 1.6.1.

## Decisions (2026-10-15)

1. Parts: keep as the cost record, pulled into the price with a markup. **Agreed.**
2. Free / Pro: itemised lines are free on every quote and invoice (free users keep their
   3 invoices a month). Price list and parts markup are Pro. **Proposed, to confirm.**
3. Per-line VAT rates: in the first release, but only shown to VAT-registered UK traders,
   inside a line's edit sheet (default = their usual rate). **Recommended.**
4. CIS: fixed now, ahead of line items (`src/lib/cis.ts`, deduction on total less VAT and
   materials). **Done.**
