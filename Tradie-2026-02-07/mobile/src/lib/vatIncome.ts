import { netOfTax } from './pricing';
import type { BusinessSettings, Quote } from './store';

/**
 * What one paid invoice means for UK VAT and income tax: the VAT owed to HMRC on it, and the
 * income left after that. Kept free of the store so it can be tested (scripts/pricing.test.mts).
 *
 * - Flat Rate Scheme: a fixed % of the VAT-inclusive total goes to HMRC; the rest is income.
 * - Reverse charge: outside the flat rate scheme (HMRC VATREVCON35100). No VAT was charged and
 *   the customer pays it to HMRC, so nothing is owed and the whole total is income.
 * - Otherwise: the VAT charged is owed, and income is the total less VAT and sales tax.
 */
export function invoiceVatAndIncome(
  quote: Pick<Quote, 'total' | 'vat' | 'salesTax' | 'reverseChargeVat'>,
  settings: Pick<BusinessSettings, 'vatRegistered' | 'vatScheme' | 'vatFlatRatePercent'>,
): { vatOwed: number; income: number } {
  const reverseCharge = (quote.reverseChargeVat ?? 0) > 0;
  if (settings.vatRegistered && settings.vatScheme === 'flat_rate' && !reverseCharge) {
    const vatOwed = quote.total * (settings.vatFlatRatePercent / 100);
    return { vatOwed, income: quote.total - vatOwed };
  }
  return { vatOwed: quote.vat, income: netOfTax(quote) };
}
