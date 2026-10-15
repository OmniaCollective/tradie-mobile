// Tests for src/lib/pricing.ts (line items) and the 1.7 data upgrade. Run: npm run test:pricing
const { priceLines, netOfTax, withMarkup, linesCost } = await import('../src/lib/pricing.ts');
const { migrateStore, quoteWithLines } = await import('../src/lib/storeMigrations.ts');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const NONE = { vatApplies: false, vatRate: 20, salesTaxRate: 0, salesTaxOn: 'materials' as const };
const VAT = { ...NONE, vatApplies: true };
let n = 0;
const line = (kind: string, quantity: number, unitPrice: number, extra: object = {}) => ({ id: String(++n), kind, description: kind, quantity, unitPrice, ...extra }) as any;

// 1. Quantities and pence: 2 × £7.50 + 1.5 hr × £45 = £82.50.
let p = priceLines(NONE, [line('materials', 2, 7.5), line('labour', 1.5, 45)]);
ok('quantities add up', p.total === 82.5 && p.labour === 67.5 && p.materials === 15, JSON.stringify(p));

// 2. VAT at 20%: £300 labour + £200 materials → £100 VAT, £600 total.
p = priceLines(VAT, [line('labour', 1, 300), line('materials', 1, 200)]);
ok('VAT 20%', p.vat === 100 && p.total === 600 && p.vatBands.length === 1);

// 3. Mixed rates: £1,000 boiler at 20% + £400 insulation at 0% → VAT £200, two bands.
p = priceLines(VAT, [line('materials', 1, 1000), line('materials', 1, 400, { vatRate: 0 })]);
ok('VAT by rate', p.vat === 200 && p.vatBands.length === 2 && p.vatBands[1].rate === 0 && p.vatBands[1].net === 400);

// 4. Fixed discount £50 on £300 labour + £200 materials: shared 3:2, VAT on £450.
p = priceLines(VAT, [line('labour', 1, 300), line('materials', 1, 200), line('discount', 1, 50)]);
ok('fixed discount', p.discount === 50 && p.subtotal === 450 && p.labour === 270 && p.materials === 180 && p.vat === 90 && p.total === 540, JSON.stringify(p));

// 5. 10% discount on £333.33: £33.33 off, shares add up to the penny.
p = priceLines(NONE, [line('labour', 1, 111.11), line('materials', 1, 222.22), line('discount', 1, 0, { percent: 10 })]);
ok('percent discount', p.discount === 33.33 && p.subtotal === 300 && Math.round((p.labour + p.materials) * 100) === 30000, JSON.stringify(p));

// 6. A discount can't take the price below zero.
p = priceLines(NONE, [line('labour', 1, 40), line('discount', 1, 100)]);
ok('discount capped', p.discount === 40 && p.total === 0);

// 7. Reverse charge: VAT shown (£40) but not charged; total is the net.
p = priceLines(VAT, [line('labour', 1, 200)], { reverseCharge: true });
ok('reverse charge', p.vat === 0 && p.reverseChargeVat === 40 && p.total === 200);

// 8. Reverse charge does nothing for a trader who isn't VAT registered.
p = priceLines(NONE, [line('labour', 1, 200)], { reverseCharge: true });
ok('reverse charge needs VAT', p.vat === 0 && p.reverseChargeVat === 0 && p.total === 200);

// 9. US sales tax 8.25% on materials only: $200 materials → $16.50; labour untaxed.
const US = { ...NONE, salesTaxRate: 8.25 };
p = priceLines(US, [line('labour', 1, 300), line('materials', 1, 200)]);
ok('sales tax on materials', p.salesTax === 16.5 && p.total === 516.5);
ok('sales tax is not income', netOfTax(p) === 500);

// 10. US sales tax on everything: 8.25% of $500 = $41.25.
p = priceLines({ ...US, salesTaxOn: 'all' }, [line('labour', 1, 300), line('materials', 1, 200)]);
ok('sales tax on all', p.salesTax === 41.25 && p.total === 541.25);

// 11. Markup and cost.
ok('markup 20%', withMarkup(65, 20) === 78);
ok('cost of parts', linesCost([line('materials', 2, 9, { unitCost: 7.5 }), line('labour', 1, 60)]) === 15);

// 12. Upgrade: an old quote keeps its VAT and total to the penny, with lines that add up.
const old = { id: 'q1', jobId: 'j1', labour: 180, materials: 94, travel: 12.5, emergencySurcharge: 20, vat: 61.3, total: 367.8, validUntil: '', createdAt: '' };
const q = quoteWithLines(old, { vatRate: 20 });
const sum = q.lines.reduce((s: number, l: any) => s + l.quantity * l.unitPrice, 0);
ok('upgrade keeps total', q.total === 367.8 && q.vat === 61.3);
ok('upgrade lines add up', Math.round(sum * 100) === Math.round(q.subtotal * 100) && q.subtotal === 306.5, String(sum));
ok('upgrade labour includes call-out', q.labour === 200 && q.materials === 94 && q.other === 12.5);
ok('upgrade marks labour line automatic', q.lines[0].auto === true && q.lines[0].unitPrice === 180);
ok('upgrade is idempotent', quoteWithLines(q, {}) === q);

// 13. Whole-store upgrade from version 9: jobs and invoices, CIS corrected only on unsent invoices.
const quote = { id: 'q2', jobId: 'j2', labour: 300, materials: 200, travel: 0, emergencySurcharge: 0, vat: 100, total: 600, validUntil: '', createdAt: '' };
const store = migrateStore({
  settings: { cisRate: 20, vatRate: 20 },
  jobs: [{ id: 'j2', quote }],
  invoices: [
    { id: 'i1', jobId: 'j2', status: 'pending', cisDeducted: true, cisDeductionAmount: 120, quote },
    { id: 'i2', jobId: 'j2', status: 'sent', sentAt: '2026-10-01', cisDeducted: true, cisDeductionAmount: 120, quote },
  ],
}, 9);
ok('store: job quote has lines', store.jobs[0].quote.lines.length === 2 && store.jobs[0].quote.total === 600);
ok('store: unsent CIS corrected', store.invoices[0].cisDeductionAmount === 60, String(store.invoices[0].cisDeductionAmount));
ok('store: sent CIS kept', store.invoices[1].cisDeductionAmount === 120);
ok('store: price list added', Array.isArray(store.priceList));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
