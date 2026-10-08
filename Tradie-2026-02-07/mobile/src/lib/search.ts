/**
 * One search across customers, jobs and invoices, by whatever the tradie remembers: a name,
 * an INV number, the job, a postcode or street, a phone number or an amount. Kept free of
 * React and storage so it can be tested on its own.
 */
import type { Customer, Invoice, Job } from './store';

export interface SearchInput {
  customers: Customer[];
  jobs: Job[];
  invoices: Invoice[];
  /** What a job is called (lets the store decide: its own name, or the trade's). */
  nameOf: (job: Job) => string;
}

export interface SearchResult {
  customers: Customer[];
  jobs: Job[];
  invoices: Invoice[];
}

const MAX_EACH = 20;
const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = (s: string | undefined) => (s ?? '').replace(/\D/g, '');

/** INV-0042, inv 42, #42 and 42 all find invoice 42. */
function invoiceNumberFrom(q: string): number | null {
  const m = q.match(/^(?:inv[\s-]*|#)?0*(\d{1,6})$/i);
  return m ? Number(m[1]) : null;
}

/** £85, 85, 85.00 and 1,250 match those totals (whole pounds or exact pence). */
function amountFrom(q: string): number | null {
  const cleaned = q.replace(/[£$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

const amountMatches = (total: number, amount: number) =>
  Math.round(total * 100) === Math.round(amount * 100) || Math.round(total) === amount;

export function search(query: string, input: SearchInput): SearchResult {
  const q = norm(query);
  if (!q) return { customers: [], jobs: [], invoices: [] };
  const qDigits = digits(q);
  const number = invoiceNumberFrom(q);
  const amount = amountFrom(q);
  const looksLikePhone = qDigits.length >= 4 && /^[\d\s+()-]+$/.test(q);

  const customerHit = (c: Customer) =>
    norm(c.name).includes(q) ||
    norm(c.address).includes(q) ||
    norm(c.postcode).replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
    norm(c.email).includes(q) ||
    (looksLikePhone && digits(c.phone).includes(qDigits));

  const customers = input.customers.filter(customerHit);
  const hitIds = new Set(customers.map((c) => c.id));
  const invoiceFor = new Map(input.invoices.map((i) => [i.jobId, i]));

  const jobs = input.jobs.filter((j) => {
    const total = invoiceFor.get(j.id)?.quote.total ?? j.quote?.total;
    return (
      hitIds.has(j.customerId) ||
      norm(input.nameOf(j)).includes(q) ||
      norm(j.description).includes(q) ||
      (amount !== null && total !== undefined && amountMatches(total, amount))
    );
  });

  const invoices = input.invoices.filter(
    (i) =>
      (number !== null && i.number === number) ||
      hitIds.has(i.customerId) ||
      (amount !== null && amountMatches(i.quote.total, amount)),
  );

  const newest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  return {
    customers: customers.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_EACH),
    jobs: jobs.sort(newest).slice(0, MAX_EACH),
    invoices: invoices.sort((a, b) => (b.number ?? 0) - (a.number ?? 0)).slice(0, MAX_EACH),
  };
}

/** Recent customers for an empty search: those with the latest jobs first. */
export function recentCustomers(input: Pick<SearchInput, 'customers' | 'jobs'>, count = 6): Customer[] {
  const latest = new Map<string, string>();
  for (const j of input.jobs) if ((latest.get(j.customerId) ?? '') < j.createdAt) latest.set(j.customerId, j.createdAt);
  return [...input.customers]
    .filter((c) => latest.has(c.id))
    .sort((a, b) => (latest.get(b.id) ?? '').localeCompare(latest.get(a.id) ?? ''))
    .slice(0, count);
}
