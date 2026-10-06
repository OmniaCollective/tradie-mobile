// Tests for src/lib/scheduling.ts ("Suggest times"). Run: npm run test:scheduling
const { suggestTimes, rankTimes } = await import('../src/lib/scheduling.ts');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const fmt = (s: any) => `${s.start.toDateString().slice(0, 10)} ${s.start.getHours()}:${String(s.start.getMinutes()).padStart(2, '0')} (${s.reason})`;
const friday = at(2026, 10, 9, 15, 0); // Fri 9 Oct 2026, 3pm
const base = { now: friday, workStart: '08:00', workEnd: '18:00', workingDays: [1, 2, 3, 4, 5], durationMinutes: 60, basePostcode: 'SW1A 1AA' };
const drives: Record<string, number> = { 'SW1A 1AA': 20, 'SE1 7TP': 10, 'N1 9GU': 35, 'E1 6AN': 25 };
const driveFrom = (p: string) => drives[p] ?? null;

// 1. Empty diary → next 3 working days (skips the weekend, never same day)
let r = suggestTimes({ ...base, busy: [], driveFrom });
ok('empty diary gives 3', r.length === 3, r.map(fmt).join(' | '));
ok('skips weekend and today', r[0].start.getDay() === 1 && r[0].start.getDate() === 12);
ok('different days', new Set(r.map((s: any) => s.start.toDateString())).size === 3);
ok('free-day reason with base drive', r[0].reason === 'Free day · 20 min from your base', r[0].reason);

// 2. A job nearby on Thursday is preferred and the drive is respected
const thuJob = { start: at(2026, 10, 15, 9), end: at(2026, 10, 15, 10), postcode: 'SE1 7TP', kind: 'job' as const };
r = suggestTimes({ ...base, busy: [thuJob], driveFrom });
const thu = r.find((s: any) => s.start.getDate() === 15);
ok('Thursday (near SE1 job) is suggested', !!thu, r.map(fmt).join(' | '));
ok('Thursday fits route', !!thu?.fitsRoute);
ok('starts after job + 10 min drive (10:30 on 30-min steps)', thu?.start.getHours() === 10 && thu?.start.getMinutes() === 30, thu && fmt(thu));
ok('reason names job and drive', thu?.reason === 'After your 9:00 job in SE1 · 10 min drive', thu?.reason);
const ranked = rankTimes({ ...base, busy: [thuJob], driveFrom });
ok('best overall is the route-fitting Thursday slot', ranked[0].start.getDate() === 15, fmt(ranked[0]));

// 3. Never overlaps and leaves drive time before the next job
const tue = { start: at(2026, 10, 13, 11), end: at(2026, 10, 13, 12), postcode: 'N1 9GU', kind: 'job' as const };
const all = rankTimes({ ...base, busy: [tue], driveFrom }).filter((s: any) => s.start.getDate() === 13);
ok('no Tuesday slot overlaps 11-12', all.every((s: any) => s.end <= tue.start || s.start >= tue.end));
ok('slot before 11:00 leaves 35 min to drive to N1', all.filter((s: any) => s.end <= tue.start).every((s: any) => s.end.getTime() + 35 * 60000 <= tue.start.getTime()));
ok('latest morning slot is 9:00 (ends 10:00, +35 min < 11:00)', Math.max(...all.filter((s: any) => s.end <= tue.start).map((s: any) => s.start.getHours())) === 9);

// 4. Job longer than the working day → nothing
r = suggestTimes({ ...base, durationMinutes: 11 * 60, busy: [], driveFrom });
ok('11-hour job never fits a 10-hour day', r.length === 0);

// 5. All-day busy calendar event blocks the whole day
const holiday = { start: at(2026, 10, 12, 0), end: at(2026, 10, 13, 0), kind: 'calendar' as const };
r = suggestTimes({ ...base, busy: [holiday], driveFrom });
ok('Monday holiday skipped', r.every((s: any) => s.start.getDate() !== 12), r.map(fmt).join(' | '));

// 6. Saturday worker gets Saturday
r = suggestTimes({ ...base, workingDays: [6], busy: [], driveFrom });
ok('Saturday-only tradie gets Saturdays', r.every((s: any) => s.start.getDay() === 6) && r[0].start.getDate() === 10, r.map(fmt).join(' | '));

// 7. A pencilled-in offer is treated as busy
const offer = { start: at(2026, 10, 12, 8), end: at(2026, 10, 12, 18), postcode: 'E1 6AN', kind: 'offer' as const };
const mon = rankTimes({ ...base, busy: [offer], driveFrom }).filter((s: any) => s.start.getDate() === 12);
ok('no Monday times while offer holds the day', mon.length === 0);

// 8. Unknown drive times fall back to 30 min
const unknown = { start: at(2026, 10, 14, 9), end: at(2026, 10, 14, 10), postcode: 'ZZ1 1ZZ', kind: 'job' as const };
const wed = rankTimes({ ...base, busy: [unknown], driveFrom }).filter((s: any) => s.start.getDate() === 14 && s.start >= unknown.end);
ok('unknown postcode uses 30 min buffer (first slot 10:30)', wed.length > 0 && Math.min(...wed.map((s: any) => s.start.getTime())) === at(2026, 10, 14, 10, 30).getTime());

// 9. Ends within working hours
r = rankTimes({ ...base, durationMinutes: 90, busy: [], driveFrom });
ok('every slot ends by 18:00', r.every((s: any) => s.end.getHours() < 18 || (s.end.getHours() === 18 && s.end.getMinutes() === 0)));


// 10. Variety across the day on an empty diary
r = suggestTimes({ ...base, busy: [], driveFrom });
ok('empty diary spreads morning / midday / afternoon', new Set(r.map((s: any) => (s.start.getHours() < 11 ? 0 : s.start.getHours() < 14 ? 1 : 2))).size === 3, r.map(fmt).join(' | '));
// 11. Route fit still wins over variety
r = suggestTimes({ ...base, busy: [thuJob], driveFrom });
ok('route-fitting Thursday still included', r.some((s: any) => s.start.getDate() === 15 && s.fitsRoute), r.map(fmt).join(' | '));
console.log(`\n${pass} passed, ${fail} failed (with variety)`);
if (fail > 0) process.exit(1);
