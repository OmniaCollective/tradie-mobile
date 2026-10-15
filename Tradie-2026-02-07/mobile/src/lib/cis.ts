import type { Quote } from './store';

/**
 * The CIS deduction a contractor takes from an invoice. HMRC applies it to the labour part
 * only: the total less VAT and the cost of materials. Travel and any emergency call-out are
 * part of the labour payment, so they stay in.
 */
export const cisDeduction = (quote: Pick<Quote, 'total' | 'vat' | 'materials'>, ratePercent: number): number => {
  const labour = Math.max(0, quote.total - quote.vat - quote.materials);
  return Math.round(labour * (ratePercent / 100) * 100) / 100;
};
