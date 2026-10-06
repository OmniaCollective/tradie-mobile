/**
 * US federal tax estimate for a self-employed tradesperson (Schedule C + SE).
 *
 * Federal only: state and local income tax vary and are not included. Uses the
 * cash method (invoices paid this calendar year) and the standard deduction.
 * Figures live in data/usTax2026.ts.
 */
import type { USFilingStatus } from './store';
import {
  BRACKETS,
  STANDARD_DEDUCTION,
  QBI_RATE,
  QBI_THRESHOLD,
  SE_EARNINGS_FACTOR,
  SE_MINIMUM_EARNINGS,
  SOCIAL_SECURITY_RATE,
  SOCIAL_SECURITY_WAGE_BASE,
  MEDICARE_RATE,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  ESTIMATED_TAX_DUE,
  US_TAX_YEAR,
} from './data/usTax2026';

export interface USTaxInput {
  /** Business income received this calendar year. */
  grossIncome: number;
  businessExpenses: number;
  filingStatus: USFilingStatus;
  /** Wages or other income for the year (assumed already taxed through withholding). */
  otherIncome: number;
  /** Already set aside or paid toward this year's estimated tax. */
  alreadySetAside: number;
  now?: Date;
}

export interface USTaxEstimate {
  taxYear: number;
  grossIncome: number;
  businessExpenses: number;
  netProfit: number;
  selfEmploymentTax: number;
  /** Extra federal income tax caused by the business profit. */
  incomeTax: number;
  standardDeduction: number;
  qbiDeduction: number;
  totalTax: number;
  /** What's still to put aside: total minus already set aside. */
  stillToPay: number;
  /** Next estimated-tax due date this year, or null once all have passed. */
  nextDue: Date | null;
  /** Suggested amount for each remaining quarterly payment. */
  perPayment: number;
  paymentsLeft: number;
}

function incomeTaxOn(taxable: number, status: USFilingStatus): number {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of BRACKETS[status]) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export function calculateUSTax({
  grossIncome,
  businessExpenses,
  filingStatus,
  otherIncome,
  alreadySetAside,
  now = new Date(),
}: USTaxInput): USTaxEstimate {
  const netProfit = Math.max(0, grossIncome - businessExpenses);

  // Self-employment tax (Schedule SE). Wages use up the Social Security base first.
  const seEarnings = netProfit * SE_EARNINGS_FACTOR;
  let selfEmploymentTax = 0;
  if (seEarnings >= SE_MINIMUM_EARNINGS) {
    const ssRoom = Math.max(0, SOCIAL_SECURITY_WAGE_BASE - otherIncome);
    const extraMedicareRoom = Math.max(0, ADDITIONAL_MEDICARE_THRESHOLD[filingStatus] - otherIncome);
    selfEmploymentTax =
      Math.min(seEarnings, ssRoom) * SOCIAL_SECURITY_RATE +
      seEarnings * MEDICARE_RATE +
      Math.max(0, seEarnings - extraMedicareRoom) * ADDITIONAL_MEDICARE_RATE;
  }
  // Only the regular SE tax (not the Additional Medicare part) gives the half deduction.
  const halfSE =
    (seEarnings >= SE_MINIMUM_EARNINGS
      ? Math.min(seEarnings, Math.max(0, SOCIAL_SECURITY_WAGE_BASE - otherIncome)) * SOCIAL_SECURITY_RATE +
        seEarnings * MEDICARE_RATE
      : 0) / 2;

  const standardDeduction = STANDARD_DEDUCTION[filingStatus];
  const incomeBeforeQBI = Math.max(0, otherIncome + netProfit - halfSE - standardDeduction);

  // §199A deduction: 20% of business income, capped at 20% of taxable income, phased out
  // across the range (a sole trader has no W-2 wages to keep it above the range).
  const qbiIncome = Math.max(0, netProfit - halfSE);
  const { start, end } = QBI_THRESHOLD[filingStatus];
  const phase = incomeBeforeQBI <= start ? 1 : incomeBeforeQBI >= end ? 0 : (end - incomeBeforeQBI) / (end - start);
  const qbiDeduction = Math.min(qbiIncome * QBI_RATE, incomeBeforeQBI * QBI_RATE) * phase;

  const taxableWithBusiness = Math.max(0, incomeBeforeQBI - qbiDeduction);
  const taxableWithout = Math.max(0, otherIncome - standardDeduction);
  const incomeTax = Math.max(0, incomeTaxOn(taxableWithBusiness, filingStatus) - incomeTaxOn(taxableWithout, filingStatus));

  const totalTax = selfEmploymentTax + incomeTax;
  const stillToPay = Math.max(0, totalTax - alreadySetAside);

  const remaining = ESTIMATED_TAX_DUE.filter((d) => d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const paymentsLeft = remaining.length;

  return {
    taxYear: US_TAX_YEAR,
    grossIncome,
    businessExpenses,
    netProfit,
    selfEmploymentTax,
    incomeTax,
    standardDeduction,
    qbiDeduction,
    totalTax,
    stillToPay,
    nextDue: remaining[0] ?? null,
    perPayment: paymentsLeft > 0 ? stillToPay / paymentsLeft : stillToPay,
    paymentsLeft,
  };
}
