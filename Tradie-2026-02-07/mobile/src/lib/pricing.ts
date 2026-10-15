/**
 * Line items and how a price is added up. The one place money on a quote or invoice is
 * worked out: line amounts, discount, VAT (by rate, or reverse charge), US sales tax and the
 * total. Kept free of the store and the phone so it can be tested on its own
 * (scripts/pricing.test.mts).
 */

/** What a line is. Decides CIS (labour only), profit and the accountant pack split. */
export type LineKind = 'labour' | 'materials' | 'other' | 'discount';

/** What each kind is called: "Labour" in the UK, "Labor" in the US. */
export const lineKindLabels = (country: 'GB' | 'US'): Record<Exclude<LineKind, 'discount'>, string> => ({
  labour: country === 'US' ? 'Labor' : 'Labour',
  materials: 'Materials',
  other: 'Other',
});

export interface LineItem {
  id: string;
  kind: LineKind;
  /** "Monobloc mixer tap" */
  description: string;
  /** 2, or 1.5 for hours. Always 1 on a discount. */
  quantity: number;
  /** 'hr', 'm', 'm²', 'day'. Unset = each. */
  unit?: string;
  /** Price each, before VAT or sales tax. On a discount: the amount off (positive). */
  unitPrice: number;
  /** Discount only: a percentage of everything else, instead of a fixed amount. */
  percent?: number;
  /** UK VAT-registered only. Unset = the tradie's usual rate. */
  vatRate?: number;
  /** What the tradie paid each (a part brought in from the job), for profit. */
  unitCost?: number;
  /** The job part this line came from. */
  partId?: string;
  /** The labour line made from the job type and urgency; follows them until edited by hand. */
  auto?: boolean;
}

/** Units offered when adding a line. */
export const LINE_UNITS = ['hr', 'day', 'm', 'm²'] as const;

/** What applies to this tradie's prices, from their settings and country. */
export interface PricingRules {
  /** UK and VAT registered. */
  vatApplies: boolean;
  /** The tradie's usual VAT rate, e.g. 20. */
  vatRate: number;
  /** US only: the tradie's sales tax rate, 0 = none. */
  salesTaxRate: number;
  /** US only: sales tax on materials only, or on everything. */
  salesTaxOn: 'materials' | 'all';
}

export interface VatBand {
  rate: number;
  /** The amount VAT is worked out on, after any discount. */
  net: number;
  vat: number;
}

/** Everything a price adds up to. Stored on the quote as a snapshot. */
export interface Priced {
  /** Line totals by kind, after any discount (so CIS and the accountant pack see what's charged). */
  labour: number;
  materials: number;
  other: number;
  /** Total taken off, as a positive amount. */
  discount: number;
  /** Before VAT and sales tax, after discount. */
  subtotal: number;
  vatBands: VatBand[];
  /** VAT charged to the customer. 0 under the reverse charge. */
  vat: number;
  /** Reverse charge: VAT the customer accounts for to HMRC, shown but not charged. */
  reverseChargeVat: number;
  salesTax: number;
  /** What the customer pays. */
  total: number;
}

export const roundPence = (n: number) => Math.round(n * 100) / 100;

/** A line's amount before discount, VAT and sales tax. */
export const lineAmount = (line: Pick<LineItem, 'quantity' | 'unitPrice'>) => roundPence(line.quantity * line.unitPrice);

/** The amount a discount line takes off, given what everything else adds up to. */
export const discountAmount = (line: LineItem, before: number) =>
  Math.min(before, roundPence(line.percent ? before * (line.percent / 100) : line.unitPrice));

/**
 * Adds up a list of lines. Pence are rounded per line, then VAT is worked out per rate on
 * each rate's total (as HMRC expects). A discount is shared across the lines in proportion
 * to their amounts, so VAT, CIS and sales tax are all worked out on what's really charged.
 */
export function priceLines(rules: PricingRules, lines: LineItem[], opts: { reverseCharge?: boolean } = {}): Priced {
  const charged = lines.filter((l) => l.kind !== 'discount');
  const amounts = charged.map(lineAmount);
  const gross = roundPence(amounts.reduce((s, a) => s + a, 0));

  // Discounts apply one after another to what's left, and never take the price below zero.
  let discount = 0;
  for (const d of lines.filter((l) => l.kind === 'discount'))
    discount = roundPence(discount + discountAmount(d, gross - discount));

  // Each line's share of the discount, with any rounding pence put on the largest line.
  const shares = amounts.map((a) => (gross > 0 ? roundPence((a / gross) * discount) : 0));
  const drift = roundPence(discount - shares.reduce((s, x) => s + x, 0));
  if (drift !== 0 && shares.length) {
    const largest = amounts.indexOf(Math.max(...amounts));
    shares[largest] = roundPence(shares[largest] + drift);
  }
  const nets = amounts.map((a, i) => roundPence(a - shares[i]));

  const byKind = { labour: 0, materials: 0, other: 0 };
  charged.forEach((l, i) => {
    const kind = l.kind as keyof typeof byKind;
    byKind[kind] = roundPence(byKind[kind] + nets[i]);
  });
  const subtotal = roundPence(gross - discount);

  const vatBands: VatBand[] = [];
  if (rules.vatApplies) {
    const byRate = new Map<number, number>();
    charged.forEach((l, i) => {
      const rate = l.vatRate ?? rules.vatRate;
      byRate.set(rate, roundPence((byRate.get(rate) ?? 0) + nets[i]));
    });
    for (const [rate, net] of [...byRate.entries()].sort((a, b) => b[0] - a[0])) {
      if (net !== 0 || byRate.size === 1) vatBands.push({ rate, net, vat: roundPence(net * (rate / 100)) });
    }
  }
  const vatTotal = roundPence(vatBands.reduce((s, b) => s + b.vat, 0));
  const reverseCharge = !!opts.reverseCharge && rules.vatApplies;

  const salesTaxBase = rules.salesTaxOn === 'all' ? subtotal : byKind.materials;
  const salesTax = !rules.vatApplies && rules.salesTaxRate > 0 ? roundPence(salesTaxBase * (rules.salesTaxRate / 100)) : 0;

  const vat = reverseCharge ? 0 : vatTotal;
  return {
    ...byKind,
    discount,
    subtotal,
    vatBands,
    vat,
    reverseChargeVat: reverseCharge ? vatTotal : 0,
    salesTax,
    total: roundPence(subtotal + vat + salesTax),
  };
}

/** What the tradie keeps as income: the total less VAT and sales tax collected for the government. */
export const netOfTax = (q: { total: number; vat: number; salesTax?: number }) => roundPence(q.total - q.vat - (q.salesTax ?? 0));

/** Sell price for a part at a markup, e.g. £65 at 20% → £78. */
export const withMarkup = (cost: number, markupPercent: number) => roundPence(cost * (1 + markupPercent / 100));

/** What lines cost the tradie, where known (parts brought in). */
export const linesCost = (lines: LineItem[]) =>
  roundPence(lines.reduce((s, l) => s + (l.kind !== 'discount' && l.unitCost !== undefined ? l.unitCost * l.quantity : 0), 0));

/**
 * What a job is charged: its invoice once there is one (which can be corrected on its own),
 * otherwise its quote. Use it wherever a job's price, total or profit is shown.
 */
export const chargedQuote = <Q>(job: { quote?: Q }, invoice?: { quote: Q }): Q | undefined => invoice?.quote ?? job.quote;
