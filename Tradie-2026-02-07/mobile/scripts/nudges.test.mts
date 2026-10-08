// Tests for src/lib/nudgePlan.ts (which reminders the phone should hold). Run: npm run test:nudges
const { planNudges } = await import('../src/lib/nudgePlan.ts');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const now = new Date(2026, 9, 7, 12, 0); // Wed 7 Oct 2026, noon
const iso = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();
const customers = [{ id: 'c1', name: 'Sarah Jones' }, { id: 'c2', name: 'Tom Baker' }] as any[];
const q = (total: number) => ({ total }) as any;
const base = (over: any) => ({
  jobs: [] as any[], invoices: [] as any[], customers, renewals: [] as any[],
  settings: { paymentTermsDays: 14 }, nameOf: (j: any) => j.name ?? 'Leaking Tap', money: (n: number) => `£${n}`, ...over,
});
const plan = (over: any) => planNudges(base(over), now);

// Quote with no reply
let p = plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 6) }] });
ok('quote sent yesterday: one nudge', p.length === 1 && p[0].kind === 'quote', JSON.stringify(p.map((x: any) => x.id)));
ok('…at 9am, 3 days after sending', p[0]?.at.getDate() === 9 && p[0]?.at.getHours() === 9, p[0]?.at.toString());
ok('…named and worded', p[0]?.title === 'No reply from Sarah yet' && p[0]?.body.includes('leaking tap'), p[0]?.title);
ok('…opens the job', p[0]?.jobId === 'j1');
p = plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 1) }] });
ok('quote sent 6 days ago: the 3-day point has passed, nothing new', p.length === 0);
p = plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 1), quoteRemindedAt: [iso(2026, 10, 6)] }] });
ok('reminded yesterday: next nudge 3 days after the reminder', p.length === 1 && p[0].at.getDate() === 9);
ok('booked quote: no nudge', plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 6), scheduledDate: '2026-10-09' }] }).length === 0);
ok('times offered: no nudge', plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 6), offeredSlots: [{ date: '2026-10-09', time: '10:00' }] }] }).length === 0);
ok("didn't go ahead: no nudge", plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 6), lostAt: iso(2026, 10, 7) }] }).length === 0);
ok('switched off: no nudge', plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 6) }], settings: { paymentTermsDays: 14, reminders: { quoteNoReply: false } } }).length === 0);

// Invoice overdue
p = plan({ jobs: [{ id: 'j2', customerId: 'c2' }], invoices: [{ id: 'i1', number: 41, jobId: 'j2', customerId: 'c2', status: 'sent', sentAt: iso(2026, 10, 1), quote: q(85) }] });
ok('sent invoice: nudge the morning after it is due', p.length === 1 && p[0].kind === 'invoice' && p[0].at.getDate() === 16 && p[0].at.getHours() === 9, p[0]?.at.toString());
ok('…worded with number and amount', p[0]?.title === 'Tom’s invoice is overdue' && p[0]?.body.startsWith('INV-0041 for £85'), p[0]?.body);
ok('paid invoice: none', plan({ invoices: [{ id: 'i1', jobId: 'j2', customerId: 'c2', status: 'paid', sentAt: iso(2026, 10, 1), quote: q(85) }] }).length === 0);
ok('not sent yet: none', plan({ invoices: [{ id: 'i1', jobId: 'j2', customerId: 'c2', status: 'pending', quote: q(85) }] }).length === 0);
ok('already overdue (date passed): none new', plan({ invoices: [{ id: 'i1', jobId: 'j2', customerId: 'c2', status: 'sent', sentAt: iso(2026, 9, 1), quote: q(85) }] }).length === 0);
ok('switched off: none', plan({ invoices: [{ id: 'i1', jobId: 'j2', customerId: 'c2', status: 'sent', sentAt: iso(2026, 10, 1), quote: q(85) }], settings: { paymentTermsDays: 14, reminders: { invoiceOverdue: false } } }).length === 0);

// Renewals
p = plan({ renewals: [{ id: 'r1', name: 'Public liability insurance', expires: '2026-12-01' }] });
ok('renewal: 30 days, 7 days and the day', p.length === 3 && p.map((x: any) => x.title.split(' expires ')[1]).join('|') === 'in 30 days|in 7 days|today', p.map((x: any) => x.title).join(' | '));
p = plan({ renewals: [{ id: 'r1', name: 'Gas Safe', expires: '2026-10-10' }] });
ok('renewal in 3 days: only the day itself is still ahead', p.length === 1 && p[0].title === 'Gas Safe expires today');
ok('renewals switched off: none', plan({ renewals: [{ id: 'r1', name: 'X', expires: '2026-12-01' }], settings: { paymentTermsDays: 14, reminders: { renewals: false } } }).length === 0);

// Order and limit
const many = Array.from({ length: 80 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, expires: '2027-06-01' }));
ok('never more than 50 planned', plan({ renewals: many }).length === 50);
p = plan({ jobs: [{ id: 'j1', customerId: 'c1', quoteSentAt: iso(2026, 10, 6) }], renewals: [{ id: 'r1', name: 'X', expires: '2026-12-01' }] });
ok('soonest first', p[0].kind === 'quote');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
