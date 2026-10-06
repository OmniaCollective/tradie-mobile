// Tests for src/lib/ukIncomeTax.ts against hand-worked 2026/27 HMRC examples. Run: npm run test:uktax
const { ukIncomeTaxOnProfit } = await import('../src/lib/ukIncomeTax.ts');
let pass = 0, fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const PA = 12_570;

// 1. £30,000 profit, no other income: (30,000 − 12,570) × 20% = 3,486.
let r = ukIncomeTaxOnProfit(30_000, 0, PA);
ok('profit only, basic rate', near(r.incomeTax, 3486), r.incomeTax.toFixed(2));
ok('profit only, full allowance', r.personalAllowance === PA);

// 2. £40,000 salary + £20,000 profit. All income 60,000 → taxable 47,430 → 7,540 + 9,730 × 40% = 11,432.
//    Salary alone 27,430 × 20% = 5,486. Profit adds 5,946 (not 4,000 at a flat 20%).
r = ukIncomeTaxOnProfit(20_000, 40_000, PA);
ok('salary pushes profit into higher rate', near(r.incomeTax, 5946), r.incomeTax.toFixed(2));
ok('salary uses the whole allowance', r.personalAllowance === 0);

// 3. £110,000 profit: allowance tapered by 5,000 to 7,570. Taxable 102,430 → 7,540 + 64,730 × 40% = 33,432.
r = ukIncomeTaxOnProfit(110_000, 0, PA);
ok('allowance taper above £100k', near(r.incomeTax, 33432), r.incomeTax.toFixed(2));
ok('tapered allowance', near(r.personalAllowance, 7570), String(r.personalAllowance));

// 4. £10,000 salary + £10,000 profit: 2,570 allowance left for the profit. 7,430 × 20% = 1,486.
r = ukIncomeTaxOnProfit(10_000, 10_000, PA);
ok('part of allowance left', near(r.incomeTax, 1486), r.incomeTax.toFixed(2));
ok('allowance left for profit', r.personalAllowance === 2570, String(r.personalAllowance));

// 5. £150,000 profit: no allowance. 7,540 + 87,440 × 40% + 24,860 × 45% = 53,703.
r = ukIncomeTaxOnProfit(150_000, 0, PA);
ok('additional rate', near(r.incomeTax, 53703), r.incomeTax.toFixed(2));

// 6. Profit under the allowance: no tax.
r = ukIncomeTaxOnProfit(8_000, 0, PA);
ok('under allowance', r.incomeTax === 0 && r.personalAllowance === 8000);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
