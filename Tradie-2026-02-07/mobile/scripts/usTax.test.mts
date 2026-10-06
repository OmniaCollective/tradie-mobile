// Tests for src/lib/usTaxEstimator.ts against hand-worked 2026 IRS examples. Run: npm run test:ustax
const { calculateUSTax } = await import('../src/lib/usTaxEstimator.ts');
let pass = 0, fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const base = { businessExpenses: 0, otherIncome: 0, alreadySetAside: 0, now: new Date(2026, 9, 6) };

// 1. Single, $60,000 profit. SE: 60,000×0.9235=55,410 ×15.3% = 8,477.73. Half = 4,238.865.
//    Before QBI: 60,000−4,238.865−16,100 = 39,661.135. QBI = min(20%×55,761.135, 20%×39,661.135) = 7,932.227.
//    Taxable 31,728.908 → 1,240 + 12%×19,328.908 = 3,559.469. Total 12,037.20.
let r = calculateUSTax({ ...base, grossIncome: 60_000, filingStatus: 'single' });
ok('single 60k SE tax', near(r.selfEmploymentTax, 8477.73), r.selfEmploymentTax.toFixed(2));
ok('single 60k QBI', near(r.qbiDeduction, 7932.23), r.qbiDeduction.toFixed(2));
ok('single 60k income tax', near(r.incomeTax, 3559.47), r.incomeTax.toFixed(2));
ok('single 60k total', near(r.totalTax, 12037.20), r.totalTax.toFixed(2));

// 2. Expenses reduce profit; below $400 SE earnings no SE tax, below standard deduction no income tax.
r = calculateUSTax({ ...base, grossIncome: 800, businessExpenses: 500, filingStatus: 'single' });
ok('tiny profit: no SE tax (<$400 earnings)', r.selfEmploymentTax === 0 && r.incomeTax === 0);

// 3. Married joint, $120,000 profit. SE: 110,820 ×15.3% = 16,955.46. Half 8,477.73.
//    Before QBI: 120,000−8,477.73−32,200 = 79,322.27. QBI = min(20%×111,522.27=22,304.454, 20%×79,322.27=15,864.454) = 15,864.454.
//    Taxable 63,457.816 → 2,480 + 12%×38,657.816 = 7,118.938. Total 24,074.40.
r = calculateUSTax({ ...base, grossIncome: 120_000, filingStatus: 'married_joint' });
ok('MFJ 120k total', near(r.totalTax, 24074.40), r.totalTax.toFixed(2));

// 4. Wages above the Social Security base: SE pays Medicare only.
r = calculateUSTax({ ...base, grossIncome: 10_000, otherIncome: 190_000, filingStatus: 'single' });
ok('wages over SS base → SE = 2.9% Medicare (+0.9% over 200k)', near(r.selfEmploymentTax, 9235 * 0.029 + Math.max(0, 9235 - 10_000) * 0.009), r.selfEmploymentTax.toFixed(2));

// 5. Additional Medicare: single, $250,000 profit → 230,875 earnings, 30,875 over $200k.
r = calculateUSTax({ ...base, grossIncome: 250_000, filingStatus: 'single' });
const se = 184_500 * 0.124 + 230_875 * 0.029 + 30_875 * 0.009;
ok('additional Medicare above $200k', near(r.selfEmploymentTax, se), `${r.selfEmploymentTax.toFixed(2)} vs ${se.toFixed(2)}`);
ok('QBI partly phased out between 201,750 and 276,750', r.qbiDeduction > 0 && r.qbiDeduction < 0.2 * (250_000 - 21_600));

// 6. Quarterly: on 6 Oct 2026 two payments remain (15 Sep passed): 15 Jan 2027 only? → Sep 15 passed, so Jan 15 2027 left.
r = calculateUSTax({ ...base, grossIncome: 60_000, filingStatus: 'single', alreadySetAside: 2_037.20 });
ok('payments left after 15 Sep = 1 (15 Jan 2027)', r.paymentsLeft === 1 && r.nextDue?.getFullYear() === 2027, String(r.paymentsLeft));
ok('still to pay = total − set aside', near(r.stillToPay, 10_000));
r = calculateUSTax({ ...base, grossIncome: 60_000, filingStatus: 'single', now: new Date(2026, 4, 1) });
ok('in May: 3 payments left, next 15 Jun', r.paymentsLeft === 3 && r.nextDue?.getMonth() === 5);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
