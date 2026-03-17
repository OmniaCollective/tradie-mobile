import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Invoice, Job, Customer, BusinessSettings } from './store';
import { getJobTypeLabel } from './trades';

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
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }

  if (preset === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), quarter * 3, 1);
    const to = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }

  if (preset === 'tax_year') {
    // UK tax year: Apr 6 - Apr 5
    const year = now.getMonth() >= 3 && now.getDate() >= 6
      ? now.getFullYear()
      : now.getFullYear() - 1;
    return {
      from: `${year}-04-06`,
      to: `${year + 1}-04-05`,
    };
  }

  return null;
};

export const getPresetLabel = (preset: DatePreset): string => {
  switch (preset) {
    case 'this_month': return 'This Month';
    case 'this_quarter': return 'This Quarter';
    case 'tax_year': return 'Tax Year';
    case 'all': return 'All Time';
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

// ── PDF Export (single invoice) ─────────────────────────────────────

interface PdfContext {
  invoice: Invoice;
  job: Job;
  customer: Customer;
  settings: BusinessSettings;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
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
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #334155;color:#CBD5E1">${label}</td><td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;color:#F8FAFC">£${amount.toFixed(2)}</td></tr>`
      : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:32px; font-family:-apple-system,Helvetica,Arial,sans-serif; background:#0F172A; color:#F8FAFC; }
  .header { display:flex; justify-content:space-between; margin-bottom:32px; }
  .title { font-size:28px; font-weight:800; color:#14B8A6; }
  .label { font-size:12px; color:#64748B; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .value { font-size:14px; color:#CBD5E1; line-height:1.5; }
  .card { background:#1E293B; border:1px solid #334155; border-radius:12px; padding:20px; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; }
  .total-row td { padding:12px 0; font-weight:700; font-size:18px; }
  .total-amount { color:#14B8A6; }
  .status { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
  .footer { margin-top:32px; text-align:center; color:#64748B; font-size:12px; }
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
      ${lineItem(`VAT (${settings.vatRate}%)`, q.vat)}
      <tr class="total-row">
        <td style="border-top:2px solid #14B8A6;padding-top:12px">Total</td>
        <td class="total-amount" style="text-align:right;border-top:2px solid #14B8A6;padding-top:12px">£${q.total.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  ${invoice.paidAt ? `<div style="text-align:center;margin-top:16px"><span class="status" style="background:#22C55E33;color:#22C55E">PAID — ${formatDate(invoice.paidAt)}</span></div>` : ''}

  <div class="footer">Generated by ${settings.businessName || 'TRADIE'}</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
};
