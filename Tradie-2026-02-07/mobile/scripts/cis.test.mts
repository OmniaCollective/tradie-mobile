// Tests for src/lib/cis.ts: CIS comes off labour only, not materials or VAT. Run: npm run test:cis
const { cisDeduction } = await import('../src/lib/cis.ts');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// 1. Labour only, no VAT: £500 × 20% = £100.
ok('labour only', cisDeduction({ total: 500, vat: 0, materials: 0 }, 20) === 100);

// 2. £300 labour + £200 materials, no VAT: 20% of £300 = £60 (was £100 on the total).
ok('materials left out', cisDeduction({ total: 500, vat: 0, materials: 200 }, 20) === 60);

// 3. £300 labour + £200 materials + 20% VAT (£100) = £600 total: still £60.
ok('VAT left out', cisDeduction({ total: 600, vat: 100, materials: 200 }, 20) === 60);

// 4. Travel stays in the labour part: £300 labour + £20 travel + £50 materials = £370 → 20% of £320 = £64.
ok('travel counts as labour', cisDeduction({ total: 370, vat: 0, materials: 50 }, 20) === 64);

// 5. Unregistered subcontractor rate 30%: £333.33 labour → £100.00 (rounded to the penny).
ok('30% rate, rounded', cisDeduction({ total: 333.33, vat: 0, materials: 0 }, 30) === 100);

// 6. All materials: nothing to deduct.
ok('materials only', cisDeduction({ total: 80, vat: 0, materials: 80 }, 20) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
