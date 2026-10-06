import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Invoice, Job, Customer, BusinessSettings, Expense, EXPENSE_CATEGORY_LABELS, getRegion, getJobTypeLabel } from './store';
import { getTaxYearBounds } from './taxEstimator';
import { toDateKey } from './dates';
import type { USTaxEstimate } from './usTaxEstimator';
import { formatMoney } from './money';

// Footer on shared PDFs — every invoice/quote a customer sees links back to the app
const APP_STORE_URL = 'https://apps.apple.com/gb/app/id6758908408';
const POWERED_BY_HTML = `Powered by <a href="${APP_STORE_URL}">Tradie</a> · free job &amp; invoice app for UK trades`;

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

const escCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

export const exportCsv = async (
  ctx: CsvContext,
  dateRange: DateRange | null,
): Promise<void> => {
  let filtered = ctx.invoices;

  if (dateRange) {
    filtered = filtered.filter((inv) => {
      const d = inv.createdAt.split('T')[0];
      return d >= dateRange.from && d <= dateRange.to;
    });
  }

  const header = [
    'Invoice #', 'Date', 'Customer', 'Address', 'Job Type',
    'Labour', 'Materials', 'Travel', 'Emergency', 'VAT', 'Total',
    'Status', 'Paid Date',
  ].join(',');

  const rows = filtered.map((inv) => {
    const job = ctx.getJob(inv.jobId);
    const customer = ctx.getCustomer(inv.customerId);
    const jobLabel = job
      ? getJobTypeLabel(ctx.settings.trade, job.type)
      : '';

    return [
      escCsv(inv.id),
      escCsv(inv.createdAt.split('T')[0]),
      escCsv(customer?.name ?? ''),
      escCsv(customer ? `${customer.address}, ${customer.postcode}` : ''),
      escCsv(jobLabel),
      inv.quote.labour.toFixed(2),
      inv.quote.materials.toFixed(2),
      inv.quote.travel.toFixed(2),
      inv.quote.emergencySurcharge.toFixed(2),
      inv.quote.vat.toFixed(2),
      inv.quote.total.toFixed(2),
      escCsv(inv.status),
      escCsv(inv.paidAt?.split('T')[0] ?? ''),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const path = `${FileSystem.cacheDirectory}tradie-invoices.csv`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, { mimeType: 'text/csv' });
};

// ── Expenses CSV Export ──────────────────────────────────────────────

interface ExpenseCsvContext {
  expenses: Expense[];
  dateRange: DateRange | null;
}

export const exportExpensesCsv = async (ctx: ExpenseCsvContext): Promise<void> => {
  let filtered = ctx.expenses;

  if (ctx.dateRange) {
    filtered = filtered.filter((exp) => {
      return exp.date >= ctx.dateRange!.from && exp.date <= ctx.dateRange!.to;
    });
  }

  const header = [
    'Date', 'Category', 'Description', 'Amount', 'Miles', 'Business Use %', 'Receipt',
  ].join(',');

  const rows = filtered
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((exp) => [
      escCsv(exp.date),
      escCsv(EXPENSE_CATEGORY_LABELS[exp.category]),
      escCsv(exp.description),
      exp.amount.toFixed(2),
      exp.miles?.toString() ?? '',
      exp.businessUsePercent?.toString() ?? '',
      exp.receiptUri ? 'Yes' : 'No',
    ].join(','));

  const totalRow = `,,Total,${filtered.reduce((s, e) => s + e.amount, 0).toFixed(2)},,,`;
  const csv = [header, ...rows, '', totalRow].join('\n');
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
        `Tax Summary (${currency})`,
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
      const d = (inv.paidAt || inv.createdAt).split('T')[0];
      return d >= ctx.dateRange!.from && d <= ctx.dateRange!.to;
    });
  }

  const incomeHeader = 'INCOME';
  const incomeColumns = 'Date,Customer,Job Type,Labour,Materials,Travel,Emergency,VAT,Total,CIS Deducted';
  const incomeRows = filteredInvoices.map((inv) => {
    const job = ctx.getJob(inv.jobId);
    const customer = ctx.getCustomer(inv.customerId);
    return [
      escCsv((inv.paidAt || inv.createdAt).split('T')[0]),
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
      return exp.date >= ctx.dateRange!.from && exp.date <= ctx.dateRange!.to;
    });
  }

  const expenseHeader = 'EXPENSES';
  const expenseColumns = 'Date,Category,Description,Amount';
  const expenseRows = filteredExpenses
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((exp) => [
      escCsv(exp.date),
      escCsv(EXPENSE_CATEGORY_LABELS[exp.category]),
      escCsv(exp.description),
      exp.amount.toFixed(2),
    ].join(','));

  const csv = [
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

// ── PDF Export (quote) ──────────────────────────────────────────────

interface QuotePdfContext {
  job: Job;
  customer: Customer;
  settings: BusinessSettings;
}

export const exportQuotePdf = async (ctx: QuotePdfContext): Promise<void> => {
  const { job, customer, settings } = ctx;
  const q = job.quote!;
  const jobLabel = getJobTypeLabel(settings.trade, job.type);

  const lineItem = (label: string, amount: number) =>
    amount > 0
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #E4E7EB;color:#5B6676">${label}</td><td style="padding:8px 0;border-bottom:1px solid #E4E7EB;text-align:right;color:#0B1220">${formatMoney(amount)}</td></tr>`
      : '';

  const validUntil = q.validUntil
    ? `Valid until ${formatDate(q.validUntil)}`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:32px; font-family:-apple-system,Helvetica,Arial,sans-serif; background:#FFFFFF; color:#0B1220; }
  .header { display:flex; justify-content:space-between; margin-bottom:32px; }
  .title { font-size:28px; font-weight:800; color:#0E7C86; }
  .label { font-size:12px; color:#5B6676; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .value { font-size:14px; color:#0B1220; line-height:1.5; }
  .card { background:#F3F5F7; border:1px solid #E4E7EB; border-radius:12px; padding:20px; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; }
  .total-row td { padding:12px 0; font-weight:700; font-size:18px; }
  .total-amount { color:#0E7C86; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; background:#0E7C861A; color:#0E7C86; }
  .footer { margin-top:32px; text-align:center; color:#5B6676; font-size:12px; }
  .powered { margin-top:6px; text-align:center; color:#5B6676; font-size:10px; }
  .powered a { color:#0E7C86; text-decoration:none; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${settings.businessName || 'TRADIE'}</div>
      <div class="value" style="margin-top:4px">${settings.ownerName || ''}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Quote</div>
      <div class="value">${formatDate(q.createdAt)}</div>
      ${validUntil ? `<div class="value" style="color:#5B6676;font-size:12px">${validUntil}</div>` : ''}
    </div>
  </div>

  <div style="display:flex;gap:20px;margin-bottom:24px">
    <div class="card" style="flex:1">
      <div class="label">From</div>
      <div class="value">${settings.businessName || 'TRADIE'}</div>
      ${settings.address ? `<div class="value">${settings.address}</div>` : ''}
      ${settings.postcode ? `<div class="value">${settings.postcode}</div>` : ''}
      ${settings.phone ? `<div class="value">${settings.phone}</div>` : ''}
      ${settings.email ? `<div class="value">${settings.email}</div>` : ''}
    </div>
    <div class="card" style="flex:1">
      <div class="label">To</div>
      <div class="value">${customer.name}</div>
      <div class="value">${customer.address}</div>
      <div class="value">${customer.postcode}</div>
      ${customer.phone ? `<div class="value">${customer.phone}</div>` : ''}
      ${customer.email ? `<div class="value">${customer.email}</div>` : ''}
    </div>
  </div>

  <div class="card">
    <div class="label" style="margin-bottom:12px">Job: ${jobLabel}</div>
    ${job.description ? `<div class="value" style="margin-bottom:12px;color:#5B6676">${job.description}</div>` : ''}
    <table>
      ${lineItem('Labour', q.labour)}
      ${lineItem('Materials', q.materials)}
      ${lineItem('Travel', q.travel)}
      ${lineItem('Emergency Surcharge', q.emergencySurcharge)}
      ${q.vat > 0 ? lineItem(`VAT (${settings.vatRate}%)`, q.vat) : ''}
      <tr class="total-row">
        <td style="border-top:2px solid #0E7C86;padding-top:12px">Total</td>
        <td class="total-amount" style="text-align:right;border-top:2px solid #0E7C86;padding-top:12px">${formatMoney(q.total)}</td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;margin-top:8px">
    <span class="badge">QUOTE — Awaiting Approval</span>
  </div>

  <div class="footer">Generated by ${settings.businessName || 'TRADIE'}</div>
  <div class="powered">${POWERED_BY_HTML}</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
};

// ── PDF Export (single invoice) ─────────────────────────────────────

interface PdfContext {
  invoice: Invoice;
  job: Job;
  customer: Customer;
  settings: BusinessSettings;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(getRegion().locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const exportInvoicePdf = async (ctx: PdfContext): Promise<void> => {
  const { invoice, job, customer, settings } = ctx;
  const q = invoice.quote;
  const jobLabel = getJobTypeLabel(settings.trade, job.type);

  const lineItem = (label: string, amount: number) =>
    amount > 0
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #E4E7EB;color:#5B6676">${label}</td><td style="padding:8px 0;border-bottom:1px solid #E4E7EB;text-align:right;color:#0B1220">${formatMoney(amount)}</td></tr>`
      : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:32px; font-family:-apple-system,Helvetica,Arial,sans-serif; background:#FFFFFF; color:#0B1220; }
  .header { display:flex; justify-content:space-between; margin-bottom:32px; }
  .title { font-size:28px; font-weight:800; color:#0E7C86; }
  .label { font-size:12px; color:#5B6676; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .value { font-size:14px; color:#0B1220; line-height:1.5; }
  .card { background:#F3F5F7; border:1px solid #E4E7EB; border-radius:12px; padding:20px; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; }
  .total-row td { padding:12px 0; font-weight:700; font-size:18px; }
  .total-amount { color:#0E7C86; }
  .status { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
  .footer { margin-top:32px; text-align:center; color:#5B6676; font-size:12px; }
  .powered { margin-top:6px; text-align:center; color:#5B6676; font-size:10px; }
  .powered a { color:#0E7C86; text-decoration:none; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${settings.businessName || 'TRADIE'}</div>
      <div class="value" style="margin-top:4px">${settings.ownerName || ''}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Invoice</div>
      <div class="value">#${invoice.id.slice(0, 8).toUpperCase()}</div>
      <div class="value">${formatDate(invoice.createdAt)}</div>
    </div>
  </div>

  <div style="display:flex;gap:20px;margin-bottom:24px">
    <div class="card" style="flex:1">
      <div class="label">From</div>
      <div class="value">${settings.businessName || 'TRADIE'}</div>
      ${settings.address ? `<div class="value">${settings.address}</div>` : ''}
      ${settings.postcode ? `<div class="value">${settings.postcode}</div>` : ''}
      ${settings.phone ? `<div class="value">${settings.phone}</div>` : ''}
      ${settings.email ? `<div class="value">${settings.email}</div>` : ''}
    </div>
    <div class="card" style="flex:1">
      <div class="label">To</div>
      <div class="value">${customer.name}</div>
      <div class="value">${customer.address}</div>
      <div class="value">${customer.postcode}</div>
      ${customer.phone ? `<div class="value">${customer.phone}</div>` : ''}
      ${customer.email ? `<div class="value">${customer.email}</div>` : ''}
    </div>
  </div>

  <div class="card">
    <div class="label" style="margin-bottom:12px">Job: ${jobLabel}</div>
    <table>
      ${lineItem('Labour', q.labour)}
      ${lineItem('Materials', q.materials)}
      ${lineItem('Travel', q.travel)}
      ${lineItem('Emergency Surcharge', q.emergencySurcharge)}
      ${q.vat > 0 ? lineItem(`VAT (${settings.vatRate}%)`, q.vat) : ''}
      <tr class="total-row">
        <td style="border-top:2px solid #0E7C86;padding-top:12px">Total</td>
        <td class="total-amount" style="text-align:right;border-top:2px solid #0E7C86;padding-top:12px">${formatMoney(q.total)}</td>
      </tr>
    </table>
  </div>

  ${invoice.paidAt ? `<div style="text-align:center;margin-top:16px"><span class="status" style="background:#0E7C861A;color:#0E7C86">PAID — ${formatDate(invoice.paidAt)}</span></div>` : ''}

  <div class="footer">Generated by ${settings.businessName || 'TRADIE'}</div>
  <div class="powered">${POWERED_BY_HTML}</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
};
