// Tests for src/lib/search.ts. Run: npm run test:search
const { search, recentCustomers } = await import('../src/lib/search.ts');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const customers = [
  { id: 'c1', name: 'Sarah Williams', email: 'sarah@example.com', phone: '07700 900456', address: '5 Kings Ave', postcode: 'SE15 3PL' },
  { id: 'c2', name: 'Tom Baker', email: '', phone: '07700 900321', address: '3 Park Row', postcode: 'SE10 8RT' },
  { id: 'c3', name: 'Emma Davis', email: '', phone: '', address: '8 Elm Close', postcode: 'SE5 9LB' },
];
const q = (total: number) => ({ total, labour: total, materials: 0, travel: 0, vat: 0, emergencySurcharge: 0 });
const jobs = [
  { id: 'j1', customerId: 'c1', type: 'service_1', description: 'Kitchen sink backing up', createdAt: '2026-09-01', quote: q(85) },
  { id: 'j2', customerId: 'c2', type: 'service_6', description: '', createdAt: '2026-10-01', quote: q(80) },
  { id: 'j3', customerId: 'c3', type: 'custom', customName: 'Fit outside tap', description: '', createdAt: '2026-10-05', quote: q(1250) },
];
const names: Record<string, string> = { service_1: 'Blocked Drain', service_6: 'Radiator Issue' };
const nameOf = (j: any) => j.customName || names[j.type] || j.type;
const invoices = [
  { id: 'i1', number: 41, jobId: 'j1', customerId: 'c1', quote: q(85), status: 'sent', createdAt: '2026-09-10' },
  { id: 'i2', number: 42, jobId: 'j3', customerId: 'c3', quote: q(1250), status: 'paid', createdAt: '2026-10-06' },
];
const input = { customers, jobs, invoices, nameOf } as any;
const s = (text: string) => search(text, input);
const ids = (xs: any[]) => xs.map((x) => x.id).join(',');

ok('empty query finds nothing', ids(s('  ').customers) === '' && ids(s('').jobs) === '');
let r = s('sar');
ok('name part finds the customer', ids(r.customers) === 'c1', ids(r.customers));
ok('…and their jobs and invoices', ids(r.jobs) === 'j1' && ids(r.invoices) === 'i1', `${ids(r.jobs)} / ${ids(r.invoices)}`);
ok('case does not matter', ids(s('SARAH').customers) === 'c1');
ok('INV-0042 finds invoice 42', ids(s('INV-0042').invoices) === 'i2', ids(s('INV-0042').invoices));
ok('inv 42 and #42 too', ids(s('inv 42').invoices) === 'i2' && ids(s('#42').invoices) === 'i2');
ok('job name finds the job', ids(s('radiator').jobs) === 'j2', ids(s('radiator').jobs));
ok('"Something else" name finds the job', ids(s('outside tap').jobs) === 'j3');
ok('description finds the job', ids(s('sink').jobs) === 'j1');
ok('postcode finds the customer', ids(s('SE15').customers) === 'c1', ids(s('SE15').customers));
ok('postcode without the space', ids(s('se153pl').customers) === 'c1');
ok('street finds the customer', ids(s('elm close').customers) === 'c3');
ok('phone digits find the customer', ids(s('900321').customers) === 'c2', ids(s('900321').customers));
ok('£85 finds the job and invoice', ids(s('£85').jobs) === 'j1' && ids(s('£85').invoices) === 'i1');
ok('1,250 finds the big job', ids(s('1,250').jobs) === 'j3' && ids(s('1250').invoices) === 'i2');
ok('nothing matches nonsense', !s('zzzz').customers.length && !s('zzzz').jobs.length && !s('zzzz').invoices.length);
ok('recent customers: newest job first', ids(recentCustomers(input)) === 'c3,c2,c1', ids(recentCustomers(input)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
