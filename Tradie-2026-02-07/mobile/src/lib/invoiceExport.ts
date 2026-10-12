import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import {
  Invoice,
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

export const PDF_STYLE = `
  body { margin:0; padding:32px; font-family:-apple-system,Helvetica,Arial,sans-serif; background:#FFFFFF; color:#0B1220; }
  .header { display:flex; justify-content:space-between; gap:24px; margin-bottom:32px; }
  .title { font-size:28px; font-weight:800; color:#0E7C86; }
  .label { font-size:12px; color:#5B6676; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .value { font-size:14px; color:#0B1220; line-height:1.5; }
  .muted { color:#5B6676; }
  .card { background:#F3F5F7; border:1px solid #E4E7EB; border-radius:12px; padding:20px; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; }
  .line td { padding:8px 0; border-bottom:1px solid #E4E7EB; }
  .total-row td { padding:12px 0 0; font-weight:700; font-size:18px; border-top:2px solid #0E7C86; }
  .total-amount { color:#0E7C86; text-align:right; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; background:#0E7C861A; color:#0E7C86; }
  .powered { margin-top:32px; text-align:center; color:#5B6676; font-size:10px; }
  .powered a { color:#0E7C86; text-decoration:none; }
`;

/** The tradie's details, from their Account profile. */
const fromBlock = (settings: BusinessSettings) => {
  const name = businessDisplayName(settings);
  const owner = settings.ownerName.trim();
  const vat = settings.vatRegistered && getRegion().country === 'GB' && settings.vatNumber.trim();
  return `
    <div class="label">From</div>
    ${name ? `<div class="value"><strong>${esc(name)}</strong></div>` : ''}
    ${owner && owner !== name ? `<div class="value">${esc(owner)}</div>` : ''}
    ${settings.address.trim() ? `<div class="value">${escLines(settings.address)}</div>` : ''}
    ${settings.postcode.trim() ? `<div class="value">${esc(settings.postcode)}</div>` : ''}
    ${settings.phone.trim() ? `<div class="value">${esc(settings.phone)}</div>` : ''}
    ${settings.email.trim() ? `<div class="value">${esc(settings.email)}</div>` : ''}
    ${vat ? `<div class="value muted">VAT no. ${esc(vat)}</div>` : ''}`;
};

const toBlock = (customer: Customer) => `
    <div class="label">To</div>
    <div class="value"><strong>${esc(customer.name)}</strong></div>
    ${customer.address?.trim() ? `<div class="value">${escLines(customer.address)}</div>` : ''}
    ${customer.postcode?.trim() ? `<div class="value">${esc(customer.postcode)}</div>` : ''}
    ${customer.phone?.trim() ? `<div class="value">${esc(customer.phone)}</div>` : ''}
    ${customer.email?.trim() ? `<div class="value">${esc(customer.email)}</div>` : ''}`;

/** Line items and total for a quote or invoice. */
const pricesBlock = (q: Job['quote'] & object, settings: BusinessSettings, jobLabel: string, description?: string) => {
  const line = (label: string, amount: number) =>
    amount > 0
      ? `<tr class="line"><td class="muted">${label}</td><td style="text-align:right">${formatMoney(amount)}</td></tr>`
      : '';
  return `
  <div class="card">
    <div class="label" style="margin-bottom:12px">Job: ${esc(jobLabel)}</div>
    ${description?.trim() ? `<div class="value muted" style="margin-bottom:12px">${escLines(description)}</div>` : ''}
    <table>
      ${line('Labour', q.labour)}
      ${line('Materials', q.materials)}
      ${line('Travel', q.travel)}
      ${line('Emergency surcharge', q.emergencySurcharge)}
      ${q.vat > 0 ? line(`VAT (${esc(settings.vatRate)}%)`, q.vat) : ''}
      <tr class="total-row"><td>Total</td><td class="total-amount">${formatMoney(q.total)}</td></tr>
    </table>
  </div>`;
};

const pdfPage = (body: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${PDF_STYLE}</style></head>
<body>
${body}
  <div class="powered">${POWERED_BY_HTML}</div>
</body>
</html>`;

/** Renders the page to a PDF file, named e.g. "INV-0012.pdf" so it reads well as an attachment. */
export const makePdf = async (html: string, fileName?: string): Promise<string> => {
  const { uri } = await Print.printToFileAsync({ html });
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
  return makePdf(
    pdfPage(`
  <div class="header">
    <div>
      <div class="title">${esc(name) || 'Quote'}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Quote</div>
      <div class="value">${formatDate(q.createdAt)}</div>
      ${q.validUntil ? `<div class="value muted" style="font-size:12px">Valid until ${formatDate(q.validUntil)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;gap:20px">
    <div class="card" style="flex:1">${fromBlock(settings)}</div>
    <div class="card" style="flex:1">${toBlock(customer)}</div>
  </div>
  ${pricesBlock(q, settings, jobName(job, settings.trade), job.description)}
  <div style="text-align:center;margin-top:8px"><span class="badge">Quote · reply to accept</span></div>`),
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
  const issued = invoice.sentAt ?? invoice.createdAt;
  const due = (invoiceDueDate({ sentAt: issued }, settings) ?? new Date(issued)).toISOString();
  const cis = invoice.cisDeducted && invoice.cisDeductionAmount ? invoice.cisDeductionAmount : 0;
  return makePdf(
    pdfPage(`
  <div class="header">
    <div>
      <div class="title">${esc(name) || 'Invoice'}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Invoice</div>
      <div class="value"><strong>${invoiceNumberLabel(invoice)}</strong></div>
      <div class="value">Issued ${formatDate(issued)}</div>
      ${invoice.paidAt ? '' : `<div class="value">Due ${formatDate(due)}</div>`}
    </div>
  </div>
  <div style="display:flex;gap:20px">
    <div class="card" style="flex:1">${fromBlock(settings)}</div>
    <div class="card" style="flex:1">${toBlock(customer)}</div>
  </div>
  ${pricesBlock(q, settings, jobName(job, settings.trade), job.description)}
  ${cis ? `<div class="card"><table><tr class="line"><td class="muted">Less CIS deduction</td><td style="text-align:right">−${formatMoney(cis)}</td></tr><tr class="total-row"><td>To pay</td><td class="total-amount">${formatMoney(q.total - cis)}</td></tr></table></div>` : ''}
  ${
    invoice.paidAt
      ? `<div style="text-align:center;margin-top:8px"><span class="badge">Paid ${formatDate(invoice.paidAt)}</span></div>`
      : settings.paymentDetails.trim()
        ? `<div class="card"><div class="label">How to pay</div><div class="value">${escLines(settings.paymentDetails)}</div><div class="value muted" style="margin-top:8px">Please use ${invoiceNumberLabel(invoice)} as the reference.</div></div>`
        : ''
  }
  <div class="value muted" style="text-align:center;margin-top:16px">Thank you for your business.</div>`),
    invoiceNumberLabel(invoice),
  );
};
