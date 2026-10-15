/**
 * "Export the tax year for your accountant": one zip with everything for one tax year.
 *
 *   Tradie 2025-26 Smith Plumbing/
 *     Summary.pdf          income, expenses by category, profit, Tradie's tax estimate
 *     Income and expenses.xlsx   an Income tab and an Expenses tab, with totals
 *     Receipts/            every receipt photo, named to match its row in Expenses
 *
 * Income counts invoices on the day they were paid (the cash basis).
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { zipSync, type Zippable } from 'fflate';
import {
  type Invoice,
  type Expense,
  type Job,
  type Customer,
  type BusinessSettings,
  EXPENSE_CATEGORY_LABELS,
  businessDisplayName,
  invoiceNumberLabel,
  jobName,
} from './store';
import { regionFor, type Country } from './region';
import { receiptFileUri } from './receipts';
import { netOfTax } from './pricing';
import { calculateTaxEstimate, getTaxYearBounds } from './taxEstimator';
import { calculateUSTax } from './usTaxEstimator';
import { US_TAX_YEAR } from './data/usTax2026';
import { toDateKey, parseDate } from './dates';
import { buildXlsx, type Sheet, type Cell } from './xlsx';
import { esc, escLines, PDF_STYLE, POWERED_BY_HTML, pageOptions } from './invoiceExport';

export type PackYear = 'this' | 'last';

export interface PackPeriod {
  /** "2025/26" (UK) or "2025" (US). */
  label: string;
  /** "6 April 2025 to 5 April 2026" or "1 January to 31 December 2025". */
  span: string;
  /** First and last day, YYYY-MM-DD. */
  from: string;
  to: string;
}

const longDate = (d: Date, locale: string) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

/** The tax year to export: the current one or the one before. */
export function packPeriod(country: Country, which: PackYear, now: Date = new Date()): PackPeriod {
  const locale = regionFor(country).locale;
  if (country === 'US') {
    const year = now.getFullYear() - (which === 'last' ? 1 : 0);
    return {
      label: String(year),
      span: `January 1 to December 31, ${year}`,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    };
  }
  const current = getTaxYearBounds(now);
  const { start, end } =
    which === 'this' ? current : getTaxYearBounds(new Date(current.start.getFullYear() - 1, 5, 1));
  return {
    label: `${start.getFullYear()}/${String(end.getFullYear()).slice(2)}`,
    span: `${longDate(start, locale)} to ${longDate(end, locale)}`,
    from: toDateKey(start),
    to: toDateKey(end),
  };
}

const dayOf = (iso: string) => toDateKey(parseDate(iso));

/** Paid invoices and expenses that fall in the period. */
export function packContents(invoices: Invoice[], expenses: Expense[], period: PackPeriod) {
  const inPeriod = (iso: string) => {
    const d = dayOf(iso);
    return d >= period.from && d <= period.to;
  };
  return {
    paid: invoices
      .filter((i) => i.status === 'paid' && !!i.paidAt && inPeriod(i.paidAt))
      .sort((a, b) => a.paidAt!.localeCompare(b.paidAt!)),
    spent: expenses.filter((e) => inPeriod(e.date)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** A name that's safe in a zip on Windows, Mac and iPhone alike. */
const safeName = (text: string) =>
  text
    .replace(/&/g, 'and')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, ' ')
    .replace(/[\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface PackInput {
  which: PackYear;
  invoices: Invoice[];
  expenses: Expense[];
  settings: BusinessSettings;
  getJob: (id: string) => Job | undefined;
  getCustomer: (id: string) => Customer | undefined;
  /** What the tradie has put aside this tax year (for the estimate's "still to put away"). */
  alreadySetAside: number;
  now?: Date;
}

// ── Base64 <-> bytes (no Buffer in React Native) ─────────────────────

const toBytes = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const toBase64 = (bytes: Uint8Array) => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
};

const readBytes = async (uri: string) =>
  toBytes(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));

// ── The pack ─────────────────────────────────────────────────────────

/** Builds the zip and opens the share sheet. */
export async function shareAccountantPack(input: PackInput): Promise<void> {
  const { settings, which } = input;
  const now = input.now ?? new Date();
  const region = regionFor(settings.country);
  const country = region.country;
  const isUS = country === 'US';
  const period = packPeriod(country, which, now);
  const { paid, spent } = packContents(input.invoices, input.expenses, period);

  const money = (n: number) => {
    const [whole, pence] = Math.abs(n).toFixed(2).split('.');
    return `${n < 0 ? '−' : ''}${region.currencySymbol}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${pence}`;
  };
  const name = businessDisplayName(settings);
  const folder = safeName(`Tradie ${period.label.replace('/', '-')} ${name}`) || 'Tradie tax year';

  // Receipts: a readable, unique name per photo, matching the Expenses tab.
  const receiptNames = new Map<string, string>();
  const used = new Set<string>();
  for (const e of spent) {
    if (!e.receiptUri) continue;
    const base = safeName(`${e.date} ${EXPENSE_CATEGORY_LABELS[e.category]} ${e.amount.toFixed(2)}`);
    let file = `${base}.jpg`;
    for (let n = 2; used.has(file.toLowerCase()); n++) file = `${base} (${n}).jpg`;
    used.add(file.toLowerCase());
    receiptNames.set(e.id, file);
  }
  const receiptFiles: Zippable = {};
  const missing = new Set<string>();
  for (const e of spent) {
    const file = receiptNames.get(e.id);
    if (!file || !e.receiptUri) continue;
    try {
      receiptFiles[file] = [await readBytes(receiptFileUri(e.receiptUri)), { level: 0 }];
    } catch {
      missing.add(e.id);
    }
  }

  // ── Spreadsheet ──
  const hasVat = paid.some((i) => i.quote.vat > 0);
  const hasCis = paid.some((i) => i.cisDeducted && (i.cisDeductionAmount ?? 0) > 0);
  const cis = (i: Invoice) => (i.cisDeducted ? (i.cisDeductionAmount ?? 0) : 0);
  const incomeCols: Sheet['columns'] = [
    { title: 'Date paid', width: 12 },
    { title: 'Invoice', width: 11 },
    { title: 'Customer', width: 26 },
    { title: 'Job', width: 28 },
    ...(hasVat
      ? [
          { title: 'Before VAT', width: 13 },
          { title: 'VAT', width: 11 },
          { title: 'Total', width: 13 },
        ]
      : [{ title: 'Amount', width: 13 }]),
    ...(hasCis
      ? [
          { title: 'CIS deducted', width: 13 },
          { title: 'Received', width: 13 },
        ]
      : []),
  ];
  const incomeRows: Cell[][] = paid.map((i) => {
    const job = input.getJob(i.jobId);
    return [
      { date: dayOf(i.paidAt!) },
      invoiceNumberLabel(i),
      input.getCustomer(i.customerId)?.name ?? '',
      job ? jobName(job, settings.trade) : '',
      ...(hasVat
        ? [{ money: i.quote.total - i.quote.vat }, { money: i.quote.vat }, { money: i.quote.total }]
        : [{ money: i.quote.total }]),
      ...(hasCis ? [{ money: cis(i) }, { money: i.quote.total - cis(i) }] : []),
    ];
  });

  // VAT on expenses only matters to a VAT-registered UK trader.
  const hasExpVat = !isUS && settings.vatRegistered && spent.some((e) => (e.vatAmount ?? 0) > 0);
  const hasMiles = spent.some((e) => (e.miles ?? 0) > 0);
  const hasShare = spent.some((e) => e.businessUsePercent !== undefined && e.businessUsePercent < 100);
  const expenseCols: Sheet['columns'] = [
    { title: 'Date', width: 12 },
    { title: 'Category', width: 20 },
    { title: 'Description', width: 30 },
    { title: isUS ? 'Amount' : 'Amount claimed', width: 15 },
    ...(hasExpVat ? [{ title: 'VAT included', width: 13 }] : []),
    ...(hasMiles ? [{ title: 'Miles', width: 8 }] : []),
    ...(hasShare ? [{ title: 'Business use %', width: 14 }] : []),
    { title: 'Receipt', width: 40 },
  ];
  const expenseRows: Cell[][] = spent.map((e) => [
    { date: e.date },
    EXPENSE_CATEGORY_LABELS[e.category],
    e.description,
    { money: e.amount },
    ...(hasExpVat ? [e.vatAmount ? { money: e.vatAmount } : null] : []),
    ...(hasMiles ? [e.miles ? { number: e.miles } : null] : []),
    ...(hasShare ? [e.businessUsePercent !== undefined ? { number: e.businessUsePercent } : null] : []),
    missing.has(e.id) ? 'Photo missing' : (receiptNames.get(e.id) ?? ''),
  ]);
  const xlsx = buildXlsx(
    [
      {
        name: 'Income',
        columns: incomeCols,
        rows: incomeRows,
        totals: { label: 'Total', columns: incomeCols.map((_, i) => i).filter((i) => i >= 4) },
      },
      {
        name: 'Expenses',
        columns: expenseCols,
        rows: expenseRows,
        totals: {
          label: 'Total',
          columns: expenseCols
            .map((c, i) => (['Amount', 'Amount claimed', 'VAT included'].includes(c.title) ? i : -1))
            .filter((i) => i >= 0),
        },
      },
    ],
    isUS ? 'mm/dd/yyyy' : 'dd/mm/yyyy',
  );

  // ── Summary PDF ──
  const income = paid.reduce((s, i) => s + netOfTax(i.quote), 0);
  const vatCharged = paid.reduce((s, i) => s + i.quote.vat, 0);
  const cisTotal = paid.reduce((s, i) => s + cis(i), 0);
  const expenseTotal = spent.reduce((s, e) => s + e.amount, 0);
  const byCategory = Object.entries(
    spent.reduce<Record<string, number>>((acc, e) => {
      acc[EXPENSE_CATEGORY_LABELS[e.category]] = (acc[EXPENSE_CATEGORY_LABELS[e.category]] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const row = (label: string, value: string, strong = false) =>
    `<tr class="line"><td class="muted"${strong ? ' style="color:#0B1220;font-weight:700"' : ''}>${esc(label)}</td><td style="text-align:right${strong ? ';font-weight:700' : ''}">${value}</td></tr>`;

  // Tradie's estimate, using the same rules as the Money tab.
  let estimate = '';
  if (isUS) {
    if (Number(period.label) === US_TAX_YEAR) {
      const us = calculateUSTax({
        grossIncome: income,
        businessExpenses: expenseTotal,
        filingStatus: settings.usFilingStatus ?? 'single',
        otherIncome: settings.onlyIncomeSource ? 0 : settings.otherAnnualIncome,
        alreadySetAside: 0,
        now,
      });
      estimate = `
        ${row('Self-employment tax', money(us.selfEmploymentTax))}
        ${row('Federal income tax', money(us.incomeTax))}
        ${row('Estimated federal tax', money(us.totalTax), true)}
      </table>
      <div class="value muted" style="margin-top:12px;font-size:12px">Federal only; state and local tax aren’t included.`;
    }
  } else {
    const uk = calculateTaxEstimate(input.invoices, input.expenses, settings, {
      asOf: parseDate(period.from),
      alreadySetAside: which === 'this' ? input.alreadySetAside : 0,
    });
    estimate = `
        ${row('Taxable profit', money(uk.taxableProfit))}
        ${row('Income Tax', money(uk.incomeTax))}
        ${row('Class 4 National Insurance', money(uk.class4NI))}
        ${uk.cisDeductions > 0 ? row('Less CIS already deducted', `−${money(uk.cisDeductions)}`) : ''}
        ${
          uk.cisRefund > 0
            ? row('Estimated CIS refund from HMRC', money(uk.cisRefund), true)
            : row('Estimated tax to pay', money(uk.taxOwed), true)
        }
        ${uk.vatScheme !== 'none' ? row('VAT owed to HMRC', money(uk.vatOwedToHMRC)) : ''}
      </table>
      <div class="value muted" style="margin-top:12px;font-size:12px">${
        uk.vatScheme === 'flat_rate'
          ? `Income for tax is after the ${esc(settings.vatFlatRatePercent)}% flat-rate VAT paid to HMRC. `
          : ''
      }Uses ${esc(settings.onlyIncomeSource ? 'no other income' : `other income of ${money(settings.otherAnnualIncome).replace(/\.00$/, '')}`)} and a Personal Allowance of ${money(settings.personalAllowance).replace(/\.00$/, '')}, as set in Tradie.`;
  }

  const prepared = longDate(now, region.locale);
  const vatNo = !isUS && settings.vatRegistered && settings.vatNumber.trim();
  const receiptsCount = Object.keys(receiptFiles).length;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${PDF_STYLE}
  .card { break-inside:avoid; page-break-inside:avoid; }
  h2 { font-size:15px; margin:0 0 12px; color:#0B1220; }
  ul { margin:0; padding-left:18px; } li { font-size:13px; color:#5B6676; line-height:1.6; }
</style></head><body>
  <div class="header">
    <div>
      <div class="title">${esc(name) || 'Tax year summary'}</div>
      ${settings.ownerName.trim() && settings.ownerName.trim() !== name ? `<div class="value">${esc(settings.ownerName)}</div>` : ''}
      ${settings.address.trim() ? `<div class="value muted">${escLines(settings.address)}${settings.postcode.trim() ? `, ${esc(settings.postcode)}` : ''}</div>` : ''}
      ${vatNo ? `<div class="value muted">VAT no. ${esc(vatNo)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="label">Tax year ${esc(period.label)}</div>
      <div class="value">${esc(period.span)}</div>
      <div class="value muted" style="font-size:12px">Prepared ${esc(prepared)}</div>
    </div>
  </div>

  <div class="card"><h2>Income</h2><table>
    ${row(`Invoices paid (${paid.length})${hasVat ? ', before VAT' : ''}`, money(income))}
    ${hasVat ? row('VAT charged', money(vatCharged)) : ''}
    ${hasCis ? row('CIS deducted by contractors', money(cisTotal)) : ''}
  </table></div>

  <div class="card"><h2>Expenses</h2><table>
    ${byCategory.length ? byCategory.map(([label, amount]) => row(label, money(amount))).join('') : row('No expenses recorded', money(0))}
    ${row(`Total (${spent.length})`, money(expenseTotal), true)}
  </table></div>

  <div class="card"><table>
    ${row('Profit (income less expenses)', money(income - expenseTotal), true)}
  </table></div>

  ${
    estimate
      ? `<div class="card"><h2>Tradie’s tax estimate</h2><table>${estimate} It’s an estimate to help plan, not tax advice: your accountant’s figures are the ones to use.</div></div>`
      : ''
  }

  <div class="card"><h2>In this folder</h2><ul>
    <li><strong>Summary.pdf</strong>: this summary.</li>
    <li><strong>Income and expenses.xlsx</strong>: an Income tab (each invoice paid) and an Expenses tab (each expense), with totals.</li>
    ${
      receiptsCount
        ? `<li><strong>Receipts</strong>: ${receiptsCount} ${receiptsCount === 1 ? 'photo' : 'photos'}, named to match the Receipt column of the Expenses tab.</li>`
        : ''
    }
    ${
      missing.size
        ? `<li>${missing.size} receipt ${missing.size === 1 ? 'photo is' : 'photos are'} no longer on the phone, marked “Photo missing” in the Expenses tab.</li>`
        : ''
    }
    <li>Income counts each invoice on the day it was paid (cash basis).</li>
    ${
      spent.some((e) => e.category === 'vehicle_mileage')
        ? `<li>Mileage is claimed at ${isUS ? 'the IRS standard mileage rate for the date driven' : 'HMRC’s approved rates: 45p a mile, then 25p after 10,000 miles in the tax year'}.</li>`
        : ''
    }
    ${hasShare ? '<li>Phone and internet amounts are the business share only.</li>' : ''}
  </ul></div>

  <div class="powered">${POWERED_BY_HTML}</div>
</body></html>`;
  const { uri: pdfUri } = await Print.printToFileAsync({ html, ...pageOptions() });
  const pdf = await readBytes(pdfUri);
  void FileSystem.deleteAsync(pdfUri, { idempotent: true });

  // ── Zip and share ──
  const zip = zipSync(
    {
      [folder]: {
        'Summary.pdf': [pdf, { level: 0 }],
        'Income and expenses.xlsx': [xlsx, { level: 0 }],
        ...(receiptsCount ? { Receipts: receiptFiles } : {}),
      },
    },
    { level: 6 },
  );
  const zipUri = `${FileSystem.cacheDirectory}${folder}.zip`;
  await FileSystem.writeAsStringAsync(zipUri, toBase64(zip), { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(zipUri, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
    dialogTitle: `Tax year ${period.label} for your accountant`,
  });
}

/** For the year picker: how much each year holds. */
export function packCounts(invoices: Invoice[], expenses: Expense[], country: Country, which: PackYear, now = new Date()) {
  const period = packPeriod(country, which, now);
  const { paid, spent } = packContents(invoices, expenses, period);
  return { period, invoices: paid.length, expenses: spent.length };
}
