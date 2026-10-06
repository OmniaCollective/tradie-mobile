/**
 * US federal figures for tax year 2026. Every number is from an official source
 * (checked 6 Oct 2026); update this file each year — nothing else changes.
 *
 * - Brackets, standard deduction, §199A thresholds: Rev. Proc. 2025-32, §4.01, §4.14, §4.26
 *   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
 * - Social Security wage base $184,500: SSA https://www.ssa.gov/oact/cola/cbb.html
 * - SE tax 15.3% (12.4% + 2.9%) on 92.35% of net earnings, $400 floor, half deductible:
 *   https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes
 * - Additional Medicare Tax 0.9% over $200k / $250k joint: https://www.irs.gov/taxtopics/tc560
 * - Mileage 72.5¢ (Notice 2026-10), 76¢ from 1 Jul 2026 (Announcement 2026-11, IRB 2026-29):
 *   https://www.irs.gov/irb/2026-29_irb
 * - Estimated tax due dates: 2026 Form 1040-ES https://www.irs.gov/pub/irs-pdf/f1040es.pdf
 */
import type { USFilingStatus } from '../store';

export const US_TAX_YEAR = 2026;

/** [upper limit of bracket, rate]; the last bracket has no upper limit. */
type Brackets = [number, number][];

export const BRACKETS: Record<USFilingStatus, Brackets> = {
  single: [
    [12_400, 0.1],
    [50_400, 0.12],
    [105_700, 0.22],
    [201_775, 0.24],
    [256_225, 0.32],
    [640_600, 0.35],
    [Infinity, 0.37],
  ],
  married_joint: [
    [24_800, 0.1],
    [100_800, 0.12],
    [211_400, 0.22],
    [403_550, 0.24],
    [512_450, 0.32],
    [768_700, 0.35],
    [Infinity, 0.37],
  ],
  head_of_household: [
    [17_700, 0.1],
    [67_450, 0.12],
    [105_700, 0.22],
    [201_750, 0.24],
    [256_200, 0.32],
    [640_600, 0.35],
    [Infinity, 0.37],
  ],
};

export const STANDARD_DEDUCTION: Record<USFilingStatus, number> = {
  single: 16_100,
  married_joint: 32_200,
  head_of_household: 24_150,
};

/** §199A: full 20% deduction below the threshold, phased out to zero by the end of the range. */
export const QBI_RATE = 0.2;
export const QBI_THRESHOLD: Record<USFilingStatus, { start: number; end: number }> = {
  single: { start: 201_750, end: 276_750 },
  married_joint: { start: 403_500, end: 553_500 },
  head_of_household: { start: 201_750, end: 276_750 },
};

export const SE_EARNINGS_FACTOR = 0.9235;
export const SE_MINIMUM_EARNINGS = 400;
export const SOCIAL_SECURITY_RATE = 0.124;
export const SOCIAL_SECURITY_WAGE_BASE = 184_500;
export const MEDICARE_RATE = 0.029;
export const ADDITIONAL_MEDICARE_RATE = 0.009;
export const ADDITIONAL_MEDICARE_THRESHOLD: Record<USFilingStatus, number> = {
  single: 200_000,
  married_joint: 250_000,
  head_of_household: 200_000,
};

/** Business standard mileage rate in dollars per mile, by date driven. */
export function mileageRate(date: Date): number {
  return date >= new Date(2026, 6, 1) ? 0.76 : 0.725;
}

/** 2026 estimated tax due dates (months are 0-based). */
export const ESTIMATED_TAX_DUE: Date[] = [
  new Date(2026, 3, 15),
  new Date(2026, 5, 15),
  new Date(2026, 8, 15),
  new Date(2027, 0, 15),
];
