/**
 * UK Income Tax (England, Wales and NI) on self-employed profit. Pure, so it can be tested
 * without the app. Bands are frozen from 2021/22 through 2027/28.
 */
const BASIC_RATE = 0.2;
const HIGHER_RATE = 0.4;
const ADDITIONAL_RATE = 0.45;
const BASIC_RATE_BAND = 37_700; // taxable income taxed at 20%
const ADDITIONAL_RATE_THRESHOLD = 125_140; // taxable income above this taxed at 45%
const ALLOWANCE_TAPER_THRESHOLD = 100_000; // allowance reduced £1 for every £2 of income above this

/** Personal Allowance after the £100k taper. */
function allowanceFor(totalIncome: number, personalAllowance: number): number {
  return Math.max(0, personalAllowance - Math.max(0, (totalIncome - ALLOWANCE_TAPER_THRESHOLD) / 2));
}

/** Income Tax on a year's total income. */
function taxOn(totalIncome: number, personalAllowance: number): number {
  const taxable = Math.max(0, totalIncome - allowanceFor(totalIncome, personalAllowance));
  const basic = Math.min(taxable, BASIC_RATE_BAND);
  const higher = Math.max(0, Math.min(taxable, ADDITIONAL_RATE_THRESHOLD) - BASIC_RATE_BAND);
  const additional = Math.max(0, taxable - ADDITIONAL_RATE_THRESHOLD);
  return basic * BASIC_RATE + higher * HIGHER_RATE + additional * ADDITIONAL_RATE;
}

export interface UKIncomeTax {
  /** Part of the Personal Allowance left for the business profit. */
  personalAllowance: number;
  incomeAfterAllowance: number;
  /** Extra Income Tax the business profit adds. */
  incomeTax: number;
}

/**
 * Income Tax due because of the business profit. Other income (salary, pension, rent)
 * uses up the Personal Allowance and the basic-rate band first, so profit is taxed at the
 * rate it actually falls into: tax on everything minus tax on the other income alone.
 */
export function ukIncomeTaxOnProfit(profit: number, otherIncome: number, personalAllowance: number): UKIncomeTax {
  const allowanceLeft = Math.max(0, allowanceFor(profit + otherIncome, personalAllowance) - otherIncome);
  const allowanceUsed = Math.min(allowanceLeft, profit);
  return {
    personalAllowance: allowanceUsed,
    incomeAfterAllowance: Math.max(0, profit - allowanceUsed),
    incomeTax: Math.max(0, taxOn(profit + otherIncome, personalAllowance) - taxOn(otherIncome, personalAllowance)),
  };
}
