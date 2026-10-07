import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import {
  Invoice,
  Job,
  Customer,
  BusinessSettings,
  Expense,
  EXPENSE_CATEGORY_LABELS,
  getRegion,
  getJobTypeLabel,
  businessDisplayName,
  invoiceNumberLabel,
  invoiceDueDate,
} from './store';
import { getTaxYearBounds } from './taxEstimator';
import { parseDate, toDateKey } from './dates';
import type { USTaxEstimate } from './usTaxEstimator';
import { formatMoney } from './money';

// Footer on shared PDFs — every invoice/quote a customer sees links back to the app
const APP_STORE_URL = 'https://apps.apple.com/app/id6758908408';
const POWERED_BY_HTML = `Powered by <a href="${APP_STORE_URL}">Tradie</a> · the free job &amp; invoice app for trades`;

// ── Date range presets ──────────────────────────────────────────────

export type DatePreset = 'this_month' | 'this_quarter' | 'tax_year' | 'all';

export interface DateRange {
  from: string; // ISO date
  to: string;   // ISO date
}

export const getDateRange = (preset: DatePreset): DateRange | null => {
  if (preset === 'all') return null;

  const now = new Date();

  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: toDateKey(from),
      to: toDateKey(to),
    };
  }

  if (preset === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), quarter * 3, 1);
    const to = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    return {
      from: toDateKey(from),
      to: toDateKey(to),
    };
  }

  if (preset === 'tax_year') {
    // UK tax year runs 6 April – 5 April; the US tax year is the calendar year.
    const { start, end } =
      getRegion().country === 'US'
        ? { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) }
        : getTaxYearBounds(now);
    return {
      from: toDateKey(start),
      to: toDateKey(end),
    };
  }

  return null;
};

export const getPresetLabel = (preset: DatePreset): string => {
  switch (preset) {
    case 'this_month': return 'This month';
    case 'this_quarter': return 'This quarter';
    case 'tax_year': return getRegion().country === 'US' ? `Tax year ${new Date().getFullYear()}` : 'This tax year';
    case 'all': return 'All time';
  }
};

// ── CSV Export ───────────────────────────────────────────────────────

interface CsvContext {
  invoices: Invoice[];
  getJob: (id: string) => Job | undefined;
  getCustomer: (id: string) => Customer | undefined;
  settings: BusinessSettings;
}

/** Quoted CSV cell. A leading = + - @ is defused so a name can't run as a spreadsheet formula. */
const escCsv = (val: string) => {
  const safe = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** The calendar day in the tradie's own timezone (not UTC, which shifts evening times in BST). */
const dayKey = (date: string) => toDateKey(parseDate(date));

/** Who the file is for, at the top of every export. */
const csvHeaderLines = (settings: BusinessSettings, title: string): string[] => {
  const vat = settings.vatRegistered && getRegion().country === 'GB' ? settings.vatNumber.trim() : '';
  return [
    escCsv(title),
    escCsv(businessDisplayName(settings)),
    ...(settings.ownerName.trim() && settings.ownerName.trim() !== businessDisplayName(settings) ? [escCsv(settings.ownerName.trim())] : []),
    ...(settings.address.trim() || settings.postcode.trim()
      ? [escCsv([settings.address.trim().replace(/\n/g, ', '), settings.postcode.trim()].filter(Boolean).join(', '))]
      : []),
    ...(vat ? [escCsv(`VAT no. ${vat}`)] : []),
    escCsv(`Prepared ${toDateKey()} with Tradie`),
    '',
  ];
};

const rangeLabel = (range: DateRange | null) => (range ? `${range.from} to ${range.to}` : 'All dates');

export const exportCsv = async (
  ctx: CsvContext,
  dateRange: DateRange | null,
): Promise<void> => {
  let filtered = ctx.invoices;

  if (dateRange) {
    filtered = filtered.filter((inv) => {
      const d = dayKey(inv.createdAt);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }

  const header = [
    'Invoice #', 'Date', 'Customer', 'Address', 'Job Type',
    'Labour', 'Materials', 'Travel', 'Emergency', 'VAT', 'Total',
    'CIS Deducted', 'Status', 'Paid Date',
  ].join(',');

  const rows = filtered.map((inv) => {
    const job = ctx.getJob(inv.jobId);
    const customer = ctx.getCustomer(inv.customerId);
    const jobLabel = job
      ? getJobTypeLabel(ctx.settings.trade, job.type)
      : '';

    return [
      escCsv(invoiceNumberLabel(inv)),
      escCsv(dayKey(inv.createdAt)),
      escCsv(customer?.name ?? ''),
      escCsv(customer ? `${customer.address}, ${customer.postcode}` : ''),
      escCsv(jobLabel),
      inv.quote.labour.toFixed(2),
      inv.quote.materials.toFixed(2),
      inv.quote.travel.toFixed(2),
      inv.quote.emergencySurcharge.toFixed(2),
      inv.quote.vat.toFixed(2),
      inv.quote.total.toFixed(2),
      (inv.cisDeducted ? inv.cisDeductionAmount || 0 : 0).toFixed(2),
      escCsv(inv.status),
      escCsv(inv.paidAt ? dayKey(inv.paidAt) : ''),
    ].join(',');
  });

  const csv = [...csvHeaderLines(ctx.settings, `Invoices · ${rangeLabel(dateRange)}`), header, ...rows].join('\n');
  const path = `${FileSystem.cacheDirectory}tradie-invoices.csv`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, { mimeType: 'text/csv' });
};

// ── Expenses CSV Export ──────────────────────────────────────────────

interface ExpenseCsvContext {
  expenses: Expense[];
  settings: BusinessSettings;
  dateRange: DateRange | null;
}

export const exportExpensesCsv = async (ctx: ExpenseCsvContext): Promise<void> => {
  let filtered = ctx.expenses;

  if (ctx.dateRange) {
    filtered = filtered.filter((exp) => {
      const d = dayKey(exp.date);
      return d >= ctx.dateRange!.from && d <= ctx.dateRange!.to;
    });
  }

  const header = [
    'Date', 'Category', 'Description', 'Amount', 'Miles', 'Business Use %', 'Receipt',
  ].join(',');

  const rows = filtered
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((exp) => [
      escCsv(dayKey(exp.date)),
      escCsv(EXPENSE_CATEGORY_LABELS[exp.category]),
      escCsv(exp.description),
      exp.amount.toFixed(2),
      exp.miles?.toString() ?? '',
      exp.businessUsePercent?.toString() ?? '',
      exp.receiptUri ? 'Yes' : 'No',
    ].join(','));

  const totalRow = `,,Total,${filtered.reduce((s, e) => s + e.amount, 0).toFixed(2)},,,`;
  const csv = [...csvHeaderLines(ctx.settings, `Expenses · ${rangeLabel(ctx.dateRange)}`), header, ...rows, '', totalRow].join('\n');
  const path = `${FileSystem.cacheDirectory}tradie-expenses.csv`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, { mimeType: 'text/csv' });
};

// ── Full Tax Summary CSV ────────────────────────────────────────────

interface TaxSummaryCsvContext {
  invoices: Invoice[];
  expenses: Expense[];
  getJob: (id: string) => Job | undefined;
  getCustomer: (id: string) => Customer | undefined;
  settings: BusinessSettings;
  /** Set for US users; the summary then uses US federal figures. */
  usTax?: USTaxEstimate | null;
  taxEstimate: {
    grossIncome: number;
    totalExpenses: number;
    taxableProfit: number;
    incomeTax: number;
    class4NI: number;
    totalTax: number;
    cisDeductions: number;
    taxOwed: number;
  };
  dateRange: DateRange | null;
}

export const exportTaxSummaryCsv = async (ctx: TaxSummaryCsvContext): Promise<void> => {
  const { taxEstimate: t } = ctx;

  // Summary section — plain numbers (no thousands commas) so the CSV columns stay intact.
  const n = (x: number) => x.toFixed(2);
  const currency = getRegion().country === 'US' ? 'USD' : 'GBP';
  const us = ctx.usTax;
  const summary = us
    ? [
        `Tax Summary (${currency}) — federal estimate for tax year ${us.taxYear}; state tax not included`,
        `Income and expenses listed below: ${rangeLabel(ctx.dateRange)}`,
        '',
        `Gross Income,${n(us.grossIncome)}`,
        `Business Expenses,${n(us.businessExpenses)}`,
        `Net Profit,${n(us.netProfit)}`,
        '',
        `Self-Employment Tax,${n(us.selfEmploymentTax)}`,
        `Federal Income Tax,${n(us.incomeTax)}`,
        `Standard Deduction,${n(us.standardDeduction)}`,
        `Qualified Business Income Deduction,${n(us.qbiDeduction)}`,
        `Total Estimated Tax,${n(us.totalTax)}`,
        '',
        '',
      ]
    : [
        `Tax Summary (${currency}) — estimate for the current tax year (6 April to 5 April)`,
        `Income and expenses listed below: ${rangeLabel(ctx.dateRange)}`,
        '',
        `Gross Income,${n(t.grossIncome)}`,
        `Total Expenses,${n(t.totalExpenses)}`,
        `Taxable Profit,${n(t.taxableProfit)}`,
        '',
        `Income Tax,${n(t.incomeTax)}`,
        `Class 4 NI,${n(t.class4NI)}`,
        `Total Tax,${n(t.totalTax)}`,
        `CIS Deductions,${n(t.cisDeductions)}`,
        `Tax Owed,${n(t.taxOwed)}`,
        '',
        '',
      ];

  // Income section
  let filteredInvoices = ctx.invoices.filter((inv) => inv.status === 'paid');
  if (ctx.dateRange) {
    filteredInvoices = filteredInvoices.filter((inv) => {
      const d = dayKey(inv.paidAt || inv.createdAt);
      return d >= ctx.dateRange!.from && d <= ctx.dateRange!.to;
    });
  }

  const incomeHeader = 'INCOME';
  const incomeColumns = 'Date,Customer,Job Type,Labour,Materials,Travel,Emergency,VAT,Total,CIS Deducted';
  const incomeRows = filteredInvoices.map((inv) => {
    const job = ctx.getJob(inv.jobId);
    const customer = ctx.getCustomer(inv.customerId);
    return [
      escCsv(dayKey(inv.paidAt || inv.createdAt)),
      escCsv(customer?.name ?? ''),
      escCsv(job ? getJobTypeLabel(ctx.settings.trade, job.type) : ''),
      inv.quote.labour.toFixed(2),
      inv.quote.materials.toFixed(2),
      inv.quote.travel.toFixed(2),
      inv.quote.emergencySurcharge.toFixed(2),
      inv.quote.vat.toFixed(2),
      inv.quote.total.toFixed(2),
      (inv.cisDeductionAmount || 0).toFixed(2),
    ].join(',');
  });

  // Expenses section
  let filteredExpenses = ctx.expenses;
  if (ctx.dateRange) {
    filteredExpenses = filteredExpenses.filter((exp) => {
      const d = dayKey(exp.date);
      return d >= ctx.dateRange!.from && d <= ctx.dateRange!.to;
    });
  }

  const expenseHeader = 'EXPENSES';
  const expenseColumns = 'Date,Category,Description,Amount';
  const expenseRows = filteredExpenses
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((exp) => [
      escCsv(dayKey(exp.date)),
      escCsv(EXPENSE_CATEGORY_LABELS[exp.category]),
      escCsv(exp.description),
      exp.amount.toFixed(2),
    ].join(','));

  const csv = [
    ...csvHeaderLines(ctx.settings, 'Tax summary'),
    ...summary,
    incomeHeader,
    incomeColumns,
    ...incomeRows,
    '',
    '',
    expenseHeader,
    expenseColumns,
    ...expenseRows,
  ].join('\n');

  const path = `${FileSystem.cacheDirectory}tradie-tax-summary.csv`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, { mimeType: 'text/csv' });
};

// ── PDF documents (quote and invoice) ───────────────────────────────

/** Everything typed by the tradie or a customer is escaped, so "Smith & Sons" or "<" can't break the page. */
const esc = (text: string | number | undefined | null) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Multi-line text (addresses, payment details) keeps its line breaks. */
const escLines = (text: string | undefined) => esc(text?.trim()).replace(/\n/g, '<br>');

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(getRegion().locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const PDF_STYLE = `
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
const makePdf = async (html: string, fileName?: string): Promise<string> => {
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

/** Shares the quote PDF through the share sheet. */
export const exportQuotePdf = async (ctx: QuotePdfContext): Promise<void> => {
  await sharePdfFile(await createQuotePdf(ctx));
};

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
  ${pricesBlock(q, settings, getJobTypeLabel(settings.trade, job.type), job.description)}
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
  ${pricesBlock(q, settings, getJobTypeLabel(settings.trade, job.type), job.description)}
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
