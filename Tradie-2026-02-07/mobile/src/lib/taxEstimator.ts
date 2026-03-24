import { Invoice, Expense, BusinessSettings } from './store';

// UK 2024/25 tax bands (apply to 2025/26 until updated)
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;
const BASIC_RATE_THRESHOLD = 50270;

// Class 4 NI rates
const CLASS4_LOWER_RATE = 0.06; // 6% on profits £12,570–£50,270
const CLASS4_UPPER_RATE = 0.02; // 2% above £50,270
const CLASS4_LOWER_THRESHOLD = 12570;
const CLASS4_UPPER_THRESHOLD = 50270;

/**
 * Get the UK tax year boundaries for a given date.
 * UK tax year runs 6 April to 5 April.
 */
export function getTaxYearBounds(date: Date = new Date()): { start: Date; end: Date } {
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  const year = (month > 3) || (month === 3 && day >= 6)
    ? date.getFullYear()
    : date.getFullYear() - 1;

  return {
    start: new Date(year, 3, 6), // April 6
    end: new Date(year + 1, 3, 5), // April 5
  };
}

/**
 * Filter invoices/expenses to the current tax year.
 */
function filterToTaxYear<T extends { date?: string; paidAt?: string; createdAt: string }>(
  items: T[],
  dateField: keyof T,
): T[] {
  const { start, end } = getTaxYearBounds();
  return items.filter((item) => {
    const dateStr = item[dateField] as string | undefined;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= start && d <= end;
  });
}

export interface TaxEstimate {
  // Income
  grossIncome: number;
  totalExpenses: number;
  taxableProfit: number;

  // Tax breakdown
  personalAllowance: number;
  incomeAfterAllowance: number;
  incomeTax: number;
  class4NI: number;
  totalTax: number;

  // CIS credit
  cisDeductions: number;
  taxOwed: number; // totalTax minus CIS deductions

  // VAT
  vatCollected: number; // Total VAT charged to customers
  vatInputTax: number; // VAT paid on expenses (reclaimable under standard scheme)
  vatOwedToHMRC: number; // What you owe HMRC (differs by scheme)
  vatScheme: 'standard' | 'flat_rate' | 'none';

  // Set aside
  monthlySetAside: number;
  monthsRemaining: number;
}

/**
 * Calculate estimated tax for the current UK tax year.
 */
export function calculateTaxEstimate(
  invoices: Invoice[],
  expenses: Expense[],
  settings: BusinessSettings,
): TaxEstimate {
  const { start, end } = getTaxYearBounds();

  // Gross income = total of paid invoices in tax year (ex-VAT)
  const taxYearInvoices = invoices.filter((inv) => {
    if (inv.status !== 'paid' || !inv.paidAt) return false;
    const d = new Date(inv.paidAt);
    return d >= start && d <= end;
  });

  // VAT tracking
  const vatCollected = taxYearInvoices.reduce((sum, inv) => sum + inv.quote.vat, 0);
  const vatScheme: TaxEstimate['vatScheme'] = settings.vatRegistered
    ? settings.vatScheme
    : 'none';

  // Under flat rate VAT, you pay HMRC a fixed % of gross turnover (VAT-inclusive).
  // The difference between VAT collected and flat rate amount is extra income.
  // Under standard VAT, you owe HMRC: VAT collected minus input VAT on expenses.
  let vatOwedToHMRC = 0;
  const grossIncome = taxYearInvoices.reduce((sum, inv) => {
    if (settings.vatRegistered && settings.vatScheme === 'flat_rate') {
      // Flat rate: you owe HMRC flat_rate% of gross (VAT-inclusive) turnover
      const flatRateVAT = inv.quote.total * (settings.vatFlatRatePercent / 100);
      vatOwedToHMRC += flatRateVAT;
      // Your taxable income = gross total minus what you pay HMRC
      return sum + (inv.quote.total - flatRateVAT);
    }
    // Standard VAT or not registered: income = total minus VAT
    vatOwedToHMRC += inv.quote.vat;
    return sum + (inv.quote.total - inv.quote.vat);
  }, 0);

  // Total expenses in tax year
  const taxYearExpenses = expenses.filter((exp) => {
    const d = new Date(exp.date);
    return d >= start && d <= end;
  });

  // Input VAT from expenses (reclaimable under standard VAT scheme)
  const vatInputTax = taxYearExpenses
    .filter((exp) => exp.vatAmount && exp.vatAmount > 0)
    .reduce((sum, exp) => sum + (exp.vatAmount || 0), 0);

  // Deduct input VAT under standard scheme
  if (settings.vatRegistered && settings.vatScheme === 'standard') {
    vatOwedToHMRC = Math.max(0, vatOwedToHMRC - vatInputTax);
  }
  const totalExpenses = taxYearExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Taxable profit
  const taxableProfit = Math.max(0, grossIncome - totalExpenses);

  // Personal allowance — reduced by other income
  const otherIncome = settings.onlyIncomeSource ? 0 : settings.otherAnnualIncome;
  const availableAllowance = Math.max(0, settings.personalAllowance - otherIncome);
  const personalAllowance = Math.min(availableAllowance, taxableProfit);
  const incomeAfterAllowance = Math.max(0, taxableProfit - availableAllowance);

  // Income tax
  const basicRateIncome = Math.min(incomeAfterAllowance, BASIC_RATE_THRESHOLD - settings.personalAllowance);
  const higherRateIncome = Math.max(0, incomeAfterAllowance - basicRateIncome);
  const incomeTax = (basicRateIncome * BASIC_RATE) + (higherRateIncome * HIGHER_RATE);

  // Class 4 NI on profits
  const class4Band1 = Math.max(0, Math.min(taxableProfit, CLASS4_UPPER_THRESHOLD) - CLASS4_LOWER_THRESHOLD);
  const class4Band2 = Math.max(0, taxableProfit - CLASS4_UPPER_THRESHOLD);
  const class4NI = (class4Band1 * CLASS4_LOWER_RATE) + (class4Band2 * CLASS4_UPPER_RATE);

  const totalTax = incomeTax + class4NI;

  // CIS deductions (tax already paid via CIS)
  const cisDeductions = taxYearInvoices
    .filter((inv) => inv.cisDeducted && inv.cisDeductionAmount)
    .reduce((sum, inv) => sum + (inv.cisDeductionAmount || 0), 0);

  const taxOwed = Math.max(0, totalTax - cisDeductions);

  // Monthly set-aside calculation
  const now = new Date();
  const monthsElapsed = Math.max(1,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
  );
  const monthsInYear = 12;
  const monthsRemaining = Math.max(1, monthsInYear - monthsElapsed + 1);

  // Project annual tax based on current trajectory, then calculate monthly set-aside
  const projectedAnnualProfit = (taxableProfit / monthsElapsed) * monthsInYear;
  const projectedOtherIncome = settings.onlyIncomeSource ? 0 : settings.otherAnnualIncome;
  const projectedAllowance = Math.max(0, settings.personalAllowance - projectedOtherIncome);
  const projectedAfterAllowance = Math.max(0, projectedAnnualProfit - projectedAllowance);

  const projectedBasic = Math.min(projectedAfterAllowance, BASIC_RATE_THRESHOLD - settings.personalAllowance);
  const projectedHigher = Math.max(0, projectedAfterAllowance - projectedBasic);
  const projectedIncomeTax = (projectedBasic * BASIC_RATE) + (projectedHigher * HIGHER_RATE);

  const projectedNIBand1 = Math.max(0, Math.min(projectedAnnualProfit, CLASS4_UPPER_THRESHOLD) - CLASS4_LOWER_THRESHOLD);
  const projectedNIBand2 = Math.max(0, projectedAnnualProfit - CLASS4_UPPER_THRESHOLD);
  const projectedNI = (projectedNIBand1 * CLASS4_LOWER_RATE) + (projectedNIBand2 * CLASS4_UPPER_RATE);

  const projectedTotalTax = projectedIncomeTax + projectedNI;
  const projectedCIS = (cisDeductions / monthsElapsed) * monthsInYear;
  const projectedOwed = Math.max(0, projectedTotalTax - projectedCIS);

  // What they should set aside each remaining month (accounting for what they've already saved)
  const monthlySetAside = Math.max(0, projectedOwed / monthsRemaining);

  return {
    grossIncome: Math.round(grossIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    taxableProfit: Math.round(taxableProfit * 100) / 100,
    personalAllowance: Math.round(personalAllowance * 100) / 100,
    incomeAfterAllowance: Math.round(incomeAfterAllowance * 100) / 100,
    incomeTax: Math.round(incomeTax * 100) / 100,
    class4NI: Math.round(class4NI * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    cisDeductions: Math.round(cisDeductions * 100) / 100,
    taxOwed: Math.round(taxOwed * 100) / 100,
    vatCollected: Math.round(vatCollected * 100) / 100,
    vatInputTax: Math.round(vatInputTax * 100) / 100,
    vatOwedToHMRC: Math.round(vatOwedToHMRC * 100) / 100,
    vatScheme,
    monthlySetAside: Math.round(monthlySetAside * 100) / 100,
    monthsRemaining,
  };
}

/**
 * Calculate rolling 12-month turnover for VAT threshold tracking.
 * HMRC checks any rolling 12-month period, not just tax year.
 */
export function calculateRolling12MonthTurnover(invoices: Invoice[]): number {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  return invoices
    .filter((inv) => {
      if (inv.status !== 'paid' || !inv.paidAt) return false;
      return new Date(inv.paidAt) >= twelveMonthsAgo;
    })
    .reduce((sum, inv) => sum + (inv.quote.total - inv.quote.vat), 0);
}
