import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import {
  Invoice,
  Quote,
  Job,
  Customer,
  BusinessSettings,
  getRegion,
  businessDisplayName,
  invoiceNumberLabel,
  invoiceDueDate,
  jobName,
} from './store';
import { formatMoney } from './money';
import { lineAmount, discountAmount, roundPence, type LineItem } from './pricing';
import { logoDataUri } from './logo';

// Footer on shared PDFs — every invoice/quote a customer sees links back to the app
const APP_STORE_URL = 'https://apps.apple.com/app/id6758908408';
export const POWERED_BY_HTML = `Powered by <a href="${APP_STORE_URL}">Tradie</a> · the free job &amp; invoice app for trades`;

// ── PDF documents (quote and invoice) ───────────────────────────────

/** Everything typed by the tradie or a customer is escaped, so "Smith & Sons" or "<" can't break the page. */
export const esc = (text: string | number | undefined | null) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Multi-line text (addresses, payment details) keeps its line breaks. */
export const escLines = (text: string | undefined) => esc(text?.trim()).replace(/\n/g, '<br>');

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(getRegion().locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** All text black (decided for 1.7); only rules and card backgrounds are grey. */
export const PDF_STYLE = `
  body { margin:0; padding:0; font-family:-apple-system,Helvetica,Arial,sans-serif; background:#FFFFFF; color:#000000; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:20px; }
  .brand { flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start; gap:8px; }
  .brand .title-small { font-size:18px; font-weight:800; color:#000000; }
  .header-right { text-align:right; white-space:nowrap; flex-shrink:0; }
  .logo { max-height:64px; max-width:180px; object-fit:contain; }
  .title { font-size:26px; font-weight:800; color:#000000; }
  .label { font-size:11px; color:#000000; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; font-weight:600; }
  .value { font-size:13px; color:#000000; line-height:1.5; }
  .muted { color:#000000; }
  .card { background:#F3F5F7; border:1px solid #D9DDE2; border-radius:12px; padding:14px 16px; margin-bottom:12px; break-inside:avoid; page-break-inside:avoid; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  th { font-size:11px; text-transform:uppercase; letter-spacing:1px; font-weight:600; text-align:left; padding:0 0 8px; border-bottom:1px solid #000000; }
  .line td { padding:8px 0; border-bottom:1px solid #D9DDE2; font-size:13px; vertical-align:top; }
  .num { text-align:right; white-space:nowrap; padding-left:12px !important; }
  .total-row td { padding:12px 0 0; font-weight:700; font-size:18px; border-top:2px solid #000000; }
  .total-amount { color:#000000; text-align:right; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid #000000; color:#000000; }
  .note { font-size:12px; line-height:1.5; margin-top:12px; }
  .closing { break-inside:avoid; page-break-inside:avoid; }
  .powered { margin-top:14px; text-align:center; color:#000000; font-size:9px; }
  .powered a { color:#000000; text-decoration:underline; }
`;

/** Paper for the tradie's country (A4 in the UK, Letter in the US), in points, with margins on every page. */
export const pageOptions = () => ({
  ...(getRegion().country === 'US' ? { width: 612, height: 792 } : { width: 595, height: 842 }),
  margins: { left: 36, right: 36, top: 36, bottom: 36 },
});

/** The tradie's details, from their Account profile. */
const fromBlock = (settings: BusinessSettings) => {
  const name = businessDisplayName(settings);
  const owner = settings.ownerName.trim();
  const vat = settings.vatRegistered && getRegion().country === 'GB' && settings.vatNumber.trim();
  const company = settings.companyNumber?.trim();
  const website = settings.website?.trim();
  return `
    <div class="label">From</div>
    ${name ? `<div class="value"><strong>${esc(name)}</strong></div>` : ''}
    ${owner && owner !== name ? `<div class="value">${esc(owner)}</div>` : ''}
    ${settings.address.trim() ? `<div class="value">${escLines(settings.address)}</div>` : ''}
    ${settings.postcode.trim() ? `<div class="value">${esc(settings.postcode)}</div>` : ''}
    ${settings.phone.trim() ? `<div class="value">${esc(settings.phone)}</div>` : ''}
    ${settings.email.trim() ? `<div class="value">${esc(settings.email)}</div>` : ''}
    ${website ? `<div class="value">${esc(website)}</div>` : ''}
    ${vat ? `<div class="value">VAT no. ${esc(vat)}</div>` : ''}
    ${company ? `<div class="value">Company no. ${esc(company)}</div>` : ''}`;
};

const toBlock = (customer: Customer) => `
    <div class="label">To</div>
    <div class="value"><strong>${esc(customer.name)}</strong></div>
    ${customer.address?.trim() ? `<div class="value">${escLines(customer.address)}</div>` : ''}
    ${customer.postcode?.trim() ? `<div class="value">${esc(customer.postcode)}</div>` : ''}
    ${customer.phone?.trim() ? `<div class="value">${esc(customer.phone)}</div>` : ''}
    ${customer.email?.trim() ? `<div class="value">${esc(customer.email)}</div>` : ''}`;

const qtyText = (l: LineItem) => `${Number.isInteger(l.quantity) ? l.quantity : l.quantity.toFixed(2).replace(/0$/, '')}${l.unit ? ` ${esc(l.unit)}` : ''}`;

/** HMRC's example wording for the domestic reverse charge (VAT reverse charge technical guide). */
export const REVERSE_CHARGE_NOTE = 'Reverse charge: Customer to pay the VAT to HMRC.';

/** The items and totals for a quote or invoice. */
const pricesBlock = (q: Quote, jobLabel: string, description?: string) => {
  const showPrices = q.showItemPrices !== false;
  const items = q.lines.filter((l) => l.kind !== 'discount');
  const discounts = q.lines.filter((l) => l.kind === 'discount');
  const row = (cells: string[]) => `<tr class="line">${cells.join('')}</tr>`;
  const body = items
    .map((l) =>
      row(
        showPrices
          ? [
              `<td>${esc(l.description)}</td>`,
              `<td class="num">${qtyText(l)}</td>`,
              `<td class="num">${formatMoney(l.unitPrice)}</td>`,
              `<td class="num">${formatMoney(lineAmount(l))}</td>`,
            ]
          : [`<td>${esc(l.description)}</td>`, `<td class="num">${qtyText(l)}</td>`],
      ),
    )
    .join('');
  const head = showPrices
    ? '<tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr>'
    : '<tr><th>Description</th><th class="num">Qty</th></tr>';
  const sum = (label: string, amount: string, cls = 'line') => `<tr class="${cls}"><td>${label}</td><td class="num">${amount}</td></tr>`;
  const reverse = !!q.reverseCharge && q.reverseChargeVat > 0;
  // Each discount with what it took off, in order (as priceLines works them out).
  const gross = roundPence(q.subtotal + q.discount);
  let left = gross;
  const discountRows = discounts.map((d) => {
    const off = discountAmount(d, left);
    left = roundPence(left - off);
    return sum(`${esc(d.description)}${d.percent ? ` (${esc(d.percent)}%)` : ''}`, `−${formatMoney(off)}`);
  });
  const totals = [
    discounts.length || q.vatBands.length || q.salesTax > 0 ? sum('Subtotal', formatMoney(gross)) : '',
    ...discountRows,
    ...q.vatBands.map((b) =>
      sum(
        `VAT ${esc(b.rate)}%${q.vatBands.length > 1 ? ` on ${formatMoney(b.net)}` : ''}${reverse ? ' (reverse charge, not charged)' : ''}`,
        reverse ? `(${formatMoney(b.vat)})` : formatMoney(b.vat),
      ),
    ),
    q.salesTax > 0 ? sum('Sales tax', formatMoney(q.salesTax)) : '',
    `<tr class="total-row"><td>Total</td><td class="total-amount">${formatMoney(q.total)}</td></tr>`,
  ]
    .filter(Boolean)
    .join('');
  return `
  <div class="card" style="break-inside:auto;page-break-inside:auto">
    <div class="label" style="margin-bottom:8px">Job: ${esc(jobLabel)}</div>
    ${description?.trim() ? `<div class="value" style="margin-bottom:14px">${escLines(description)}</div>` : ''}
    <table><thead>${head}</thead><tbody>${body}</tbody></table>
    <table style="margin-top:8px;break-inside:avoid;page-break-inside:avoid">${totals}</table>
    ${reverse ? `<div class="note"><strong>${REVERSE_CHARGE_NOTE}</strong></div>` : ''}
  </div>`;
};

/** The logo with the business name under it (or the name on its own), and the document details on the right. */
const headerBlock = (logo: string | undefined, name: string, fallback: string, right: string) => `
  <div class="header">
    <div class="brand">
      ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
      ${name || !logo ? `<div class="${logo ? 'title-small' : 'title'}">${esc(name) || fallback}</div>` : ''}
    </div>
    <div class="header-right">${right}</div>
  </div>`;

/**
 * A whole PDF. The closing part (payment details, the tradie's note and "Powered by Tradie")
 * stays together, so a line on its own never runs onto a page of its own.
 */
const pdfPage = (body: string, closing: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${PDF_STYLE}</style></head>
<body>
${body}
  <div class="closing">
  ${closing}
  <div class="powered">${POWERED_BY_HTML}</div>
  </div>
</body>
</html>`;

/** Renders the page to a PDF file, named e.g. "INV-0012.pdf" so it reads well as an attachment. */
export const makePdf = async (html: string, fileName?: string): Promise<string> => {
  const { uri } = await Print.printToFileAsync({ html, ...pageOptions() });
  if (!fileName || !FileSystem.cacheDirectory) return uri;
  const named = `${FileSystem.cacheDirectory}${fileName.replace(/[^\w-]+/g, '-')}.pdf`;
  await FileSystem.deleteAsync(named, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: named });
  return named;
};

/** Opens the share sheet for a PDF that's already been made. */
export const sharePdfFile = async (uri: string) => {
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
};

interface QuotePdfContext {
  job: Job;
  customer: Customer;
  settings: BusinessSettings;
}

/** Builds the quote PDF and returns its file (for the preview screen or sharing). */
export const createQuotePdf = async ({ job, customer, settings }: QuotePdfContext): Promise<string> => {
  const q = job.quote!;
  const name = businessDisplayName(settings);
  const logo = await logoDataUri(settings.logoFile);
  const footer = settings.quoteFooter?.trim();
  return makePdf(
    pdfPage(`
  ${headerBlock(
    logo,
    name,
    'Quote',
    `<div class="label">Quote</div>
      <div class="value">${formatDate(q.createdAt)}</div>
      ${q.validUntil ? `<div class="value" style="font-size:12px">Valid until ${formatDate(q.validUntil)}</div>` : ''}`,
  )}
  <div style="display:flex;gap:18px">
    <div class="card" style="flex:1">${fromBlock(settings)}</div>
    <div class="card" style="flex:1">${toBlock(customer)}</div>
  </div>
  ${pricesBlock(q, jobName(job, settings.trade), job.description)}`,
      `<div style="text-align:center;margin-top:4px"><span class="badge">Quote · reply to accept</span></div>
  ${footer ? `<div class="value" style="margin-top:14px">${escLines(footer)}</div>` : ''}`,
    ),
    `Quote-${customer.name}`,
  );
};

interface PdfContext {
  invoice: Invoice;
  job: Job;
  customer: Customer;
  settings: BusinessSettings;
}

/** Shares the invoice PDF through the share sheet. */
export const exportInvoicePdf = async (ctx: PdfContext): Promise<void> => {
  await sharePdfFile(await createInvoicePdf(ctx));
};

/** Builds the invoice PDF and returns its file, e.g. to attach to a payment reminder. */
export const createInvoicePdf = async ({ invoice, job, customer, settings }: PdfContext): Promise<string> => {
  const q = invoice.quote;
  const name = businessDisplayName(settings);
  const logo = await logoDataUri(settings.logoFile);
  const issued = invoice.sentAt ?? invoice.createdAt;
  const due = (invoiceDueDate({ sentAt: issued }, settings) ?? new Date(issued)).toISOString();
  const cis = invoice.cisDeducted && invoice.cisDeductionAmount ? invoice.cisDeductionAmount : 0;
  const footer = settings.invoiceFooter?.trim() || 'Thank you for your business.';
  return makePdf(
    pdfPage(`
  ${headerBlock(
    logo,
    name,
    'Invoice',
    `<div class="label">Invoice</div>
      <div class="value"><strong>${invoiceNumberLabel(invoice)}</strong></div>
      <div class="value">Issued ${formatDate(issued)}</div>
      ${invoice.paidAt ? '' : `<div class="value">Due ${formatDate(due)}</div>`}`,
  )}
  <div style="display:flex;gap:18px">
    <div class="card" style="flex:1">${fromBlock(settings)}</div>
    <div class="card" style="flex:1">${toBlock(customer)}</div>
  </div>
  ${pricesBlock(q, jobName(job, settings.trade), job.description)}
  ${cis ? `<div class="card"><table><tr class="line"><td>Less CIS deduction</td><td class="num">−${formatMoney(cis)}</td></tr><tr class="total-row"><td>To pay</td><td class="total-amount">${formatMoney(q.total - cis)}</td></tr></table></div>` : ''}`,
      `${
    invoice.paidAt
      ? `<div style="text-align:center;margin-top:8px"><span class="badge">Paid ${formatDate(invoice.paidAt)}</span></div>`
      : settings.paymentDetails.trim()
        ? `<div class="card"><div class="label">How to pay</div><div class="value">${escLines(settings.paymentDetails)}</div><div class="value" style="margin-top:8px">Please use ${invoiceNumberLabel(invoice)} as the reference.</div></div>`
        : ''
  }
  <div class="value" style="text-align:center;margin-top:12px">${escLines(footer)}</div>`,
    ),
    invoiceNumberLabel(invoice),
  );
};
