// Tests for src/lib/jobSteps.ts (where a job is) and src/lib/storeMigrations.ts (updating saved
// data from older versions). Run: npm run test:jobs
const { jobPosition, jobFacts, legacyStatus, stepsDone } = await import('../src/lib/jobSteps.ts');
const { migrateStore, STORE_VERSION } = await import('../src/lib/storeMigrations.ts');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const now = new Date(2026, 9, 7, 12, 0); // Wed 7 Oct 2026, noon
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const pos = (job: any, inv?: any) => jobPosition(job, inv, 14, now);

// ── Where a job is
let p = pos({});
ok('new job: quote to send', p.group === 'send' && p.next === 'quote', `${p.group}/${p.next}`);

p = pos({ quoteSentAt: daysAgo(1) });
ok('quote sent 1 day ago: waiting, no nudge yet', p.group === 'waiting' && p.nudge === null && p.quoteWaitingDays === 1, `${p.group} ${p.quoteWaitingDays} ${p.nudge}`);
ok('next step after sending is book', p.next === 'book', String(p.next));

p = pos({ quoteSentAt: daysAgo(4) });
ok('quote sent 4 days ago: Remind', p.nudge === 'remind' && p.quoteWaitingDays === 4, `${p.quoteWaitingDays} ${p.nudge}`);

p = pos({ quoteSentAt: daysAgo(6), quoteRemindedAt: [daysAgo(1)] });
ok('reminded yesterday: counts from the reminder', p.quoteWaitingDays === 1 && p.nudge === null, `${p.quoteWaitingDays} ${p.nudge}`);

p = pos({ quoteSentAt: daysAgo(5), offeredSlots: [{ date: '2026-10-08', time: '10:00' }] });
ok('times offered: waiting, no Remind', p.group === 'waiting' && p.nudge === null && p.facts.offered, `${p.group} ${p.nudge}`);

p = pos({ quoteSentAt: daysAgo(5), acceptedAt: daysAgo(1) });
ok('said yes, no time: to book', p.group === 'tobook' && p.next === 'book', `${p.group}/${p.next}`);

p = pos({ scheduledDate: '2026-10-09', scheduledTime: '11:00' });
ok('booked without a quote: coming up', p.group === 'booked', p.group);
ok('booked without a quote: quote step counts as done (agreed)', stepsDone(p.facts).quote === true);
ok('booking counts as yes', p.facts.accepted === true);
ok('next after booking is done', p.next === 'done', String(p.next));

p = pos({ quoteSentAt: daysAgo(9), scheduledDate: '2026-10-05', completedAt: daysAgo(2) });
ok('done, no invoice: to invoice', p.group === 'invoice' && p.next === 'invoice', `${p.group}/${p.next}`);

p = pos({ completedAt: daysAgo(2) }, { status: 'pending' });
ok('invoice made but not sent: still to invoice', p.group === 'invoice' && p.next === 'invoice', `${p.group}/${p.next}`);

p = pos({ completedAt: daysAgo(1) });
ok('finished but never quoted: suggests the invoice, not the quote', p.next === 'invoice', String(p.next));

p = pos({ completedAt: daysAgo(10) }, { status: 'sent', sentAt: daysAgo(4) });
ok('invoice sent 4 days ago: waiting for payment, not overdue', p.group === 'unpaid' && p.overdueDays === 0 && p.nudge === null, `${p.group} ${p.overdueDays}`);

p = pos({ completedAt: daysAgo(30) }, { status: 'sent', sentAt: daysAgo(21) });
ok('invoice 21 days ago on 14-day terms: 7 days overdue, Chase', p.overdueDays === 7 && p.nudge === 'chase', `${p.overdueDays} ${p.nudge}`);
ok('first chase is the polite one', p.chaseIsFollowUp === false);
p = pos({ completedAt: daysAgo(30) }, { status: 'sent', sentAt: daysAgo(21), chasedAt: [daysAgo(3)] });
ok('after one chase, the next is the follow-up', p.chaseIsFollowUp === true);

p = pos({ completedAt: daysAgo(3) }, { status: 'paid', sentAt: daysAgo(2) });
ok('paid: paid group, nothing next', p.group === 'paid' && p.next === null, `${p.group}/${p.next}`);

p = pos({ scheduledDate: '2026-10-07' }, { status: 'paid', recordedOnly: true });
ok('cash on the day (no invoice sent, not done): paid', p.group === 'paid' && p.next === null, `${p.group}/${p.next}`);

p = pos({ quoteSentAt: daysAgo(8), lostAt: daysAgo(1) });
ok("didn't go ahead: lost group, nothing next, no nudge", p.group === 'lost' && p.next === null && p.nudge === null, `${p.group}/${p.next}/${p.nudge}`);

p = pos({ completedAt: daysAgo(30), lostAt: daysAgo(1) }, { status: 'sent', sentAt: daysAgo(21) });
ok("didn't go ahead wins over everything", p.group === 'lost');

// ── Old status kept in step
ok('legacy: nothing → REQUESTED', legacyStatus(jobFacts({}), 'REQUESTED') === 'REQUESTED');
ok('legacy: quote sent → QUOTED', legacyStatus(jobFacts({ quoteSentAt: daysAgo(1) }), 'REQUESTED') === 'QUOTED');
ok('legacy: yes → APPROVED', legacyStatus(jobFacts({ acceptedAt: daysAgo(1) }), 'QUOTED') === 'APPROVED');
ok('legacy: booked → SCHEDULED', legacyStatus(jobFacts({ scheduledDate: '2026-10-09' }), 'APPROVED') === 'SCHEDULED');
ok('legacy: done → COMPLETED', legacyStatus(jobFacts({ completedAt: daysAgo(1) }), 'SCHEDULED') === 'COMPLETED');
ok('legacy: invoice → INVOICED', legacyStatus(jobFacts({}, { status: 'pending' }), 'COMPLETED') === 'INVOICED');
ok('legacy: paid → PAID', legacyStatus(jobFacts({}, { status: 'paid' }), 'INVOICED') === 'PAID');
ok('legacy: lost keeps what it had', legacyStatus(jobFacts({ lostAt: daysAgo(1) }), 'QUOTED') === 'QUOTED');

// ── Updating 1.5 data (version 8) to version 9
ok('store version is 9', STORE_VERSION === 9);
const v8 = () => ({
  hasCompletedOnboarding: true,
  settings: { businessName: 'Smith Plumbing', taxTipSeen: true, paymentTermsDays: 14 },
  customers: [{ id: 'c1', name: 'Sarah Jones' }],
  jobs: [
    { id: 'j-req', status: 'REQUESTED', createdAt: daysAgo(2), notes: 'gate code 4471' },
    { id: 'j-quoted-old', status: 'QUOTED', createdAt: daysAgo(10) },
    { id: 'j-quoted-new', status: 'QUOTED', createdAt: daysAgo(5), quoteSentAt: daysAgo(3) },
    { id: 'j-approved', status: 'APPROVED', createdAt: daysAgo(6) },
    { id: 'j-sched', status: 'SCHEDULED', createdAt: daysAgo(7), scheduledDate: '2026-10-09', scheduledTime: '11:00' },
    { id: 'j-prog', status: 'IN_PROGRESS', createdAt: daysAgo(3), scheduledDate: '2026-10-07', scheduledTime: '09:00' },
    { id: 'j-done', status: 'COMPLETED', createdAt: daysAgo(12) },
    { id: 'j-inv', status: 'INVOICED', createdAt: daysAgo(30) },
    { id: 'j-paid', status: 'PAID', createdAt: daysAgo(40), completedAt: daysAgo(35),
      photos: [{ id: 'p1', uri: 'a.jpg', type: 'before', createdAt: daysAgo(36) }, { id: 'p2', uri: 'b.jpg', type: 'after', createdAt: daysAgo(35) }] },
  ],
  invoices: [
    { id: 'i1', number: 1, jobId: 'j-inv', status: 'sent', sentAt: daysAgo(20), createdAt: daysAgo(21) },
    { id: 'i2', number: 2, jobId: 'j-paid', status: 'paid', sentAt: daysAgo(34), paidAt: daysAgo(30), createdAt: daysAgo(34) },
  ],
  renewals: [], expenses: [], todos: [],
});
const before = v8();
const after = migrateStore(JSON.parse(JSON.stringify(before)), 8);
const byId = (id: string) => after.jobs.find((j: any) => j.id === id);
const inv = (id: string) => after.invoices.find((i: any) => i.jobId === id);
const g = (id: string) => pos(byId(id), inv(id)).group;

ok('no jobs lost', after.jobs.length === before.jobs.length);
ok('no invoices lost', after.invoices.length === before.invoices.length);
ok('notes kept', byId('j-req').notes === 'gate code 4471');
ok('REQUESTED → quotes to send', g('j-req') === 'send', g('j-req'));
ok('old QUOTED (no send date) → waiting, not "to send"', g('j-quoted-old') === 'waiting' && !!byId('j-quoted-old').quoteSentAt, g('j-quoted-old'));
ok('QUOTED with send date keeps it', byId('j-quoted-new').quoteSentAt === before.jobs[2].quoteSentAt);
ok('APPROVED (yes, no time) → to book', g('j-approved') === 'tobook', g('j-approved'));
ok('SCHEDULED → coming up', g('j-sched') === 'booked', g('j-sched'));
ok('IN_PROGRESS → booked, not done', g('j-prog') === 'booked' && byId('j-prog').status === 'SCHEDULED' && !byId('j-prog').completedAt, g('j-prog'));
ok('COMPLETED → to invoice, with a finished date', g('j-done') === 'invoice' && !!byId('j-done').completedAt, g('j-done'));
ok('INVOICED (sent 20 days ago) → waiting for payment, 6 days overdue', g('j-inv') === 'unpaid' && pos(byId('j-inv'), inv('j-inv')).overdueDays === 6);
ok('INVOICED gets a finished date from its invoice', byId('j-inv').completedAt === before.invoices[0].createdAt);
ok('PAID → paid, keeps its own finished date', g('j-paid') === 'paid' && byId('j-paid').completedAt === before.jobs[8].completedAt);
ok('photos all kept (one list)', byId('j-paid').photos.length === 2);
ok('Tax tip already closed → Money tip counts as seen', JSON.stringify(after.settings.tipsSeen) === '["money"]');
const fresh = migrateStore({ settings: {}, jobs: [], invoices: [] }, 8);
ok('no Tax tip closed → no tips seen', Array.isArray(fresh.settings.tipsSeen) && fresh.settings.tipsSeen.length === 0);
const twice = migrateStore(JSON.parse(JSON.stringify(after)), 9);
ok('running on version 9 data changes nothing', JSON.stringify(twice) === JSON.stringify(after));
ok('a 1.0 save (version 0) still updates all the way', migrateStore({ jobs: [{ id: 'x', type: 'leaking_tap', status: 'QUOTED', createdAt: daysAgo(3) }], settings: {} }, 0).jobs[0].type === 'service_2');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
