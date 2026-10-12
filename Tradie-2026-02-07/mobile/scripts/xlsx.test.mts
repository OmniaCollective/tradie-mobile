// Tests for src/lib/xlsx.ts (the accountant spreadsheet). Run: npm run test:xlsx
const { buildXlsx } = await import('../src/lib/xlsx.ts');
const { unzipSync, strFromU8 } = await import('fflate');
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const files = unzipSync(
  buildXlsx(
    [
      {
        name: 'Income',
        columns: [{ title: 'Date paid', width: 12 }, { title: 'Customer', width: 20 }, { title: 'Amount', width: 12 }],
        rows: [
          [{ date: '2025-11-03' }, 'Smith & Sons <Ltd> "A"', { money: 1234.5 }],
          [{ date: '2026-04-05' }, '=SUM(A1)\u0007', { money: 85 }],
        ],
        totals: { label: 'Total', columns: [2] },
      },
      { name: 'Expenses: 2025/26', columns: [{ title: 'Date', width: 12 }], rows: [], totals: { label: 'Total', columns: [0] } },
    ],
    'dd/mm/yyyy',
  ),
);
const sheet1 = strFromU8(files['xl/worksheets/sheet1.xml']);
const sheet2 = strFromU8(files['xl/worksheets/sheet2.xml']);
const book = strFromU8(files['xl/workbook.xml']);
const styles = strFromU8(files['xl/styles.xml']);

ok('has every part Excel needs', ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml'].every((f) => !!files[f]));
ok('dates are real Excel days (3 Nov 2025 = 45964)', sheet1.includes('<c r="A2" s="3"><v>45964</v>'));
ok('money is a number with 2 decimals', sheet1.includes('<c r="C2" s="2"><v>1234.50</v>'));
ok('text is escaped', sheet1.includes('Smith &amp; Sons &lt;Ltd&gt; &quot;A&quot;'));
ok('a typed formula stays text, control characters dropped', sheet1.includes('<t xml:space="preserve">=SUM(A1)</t>'));
ok('totals row: formula plus the value', sheet1.includes('<f>SUM(C2:C3)</f><v>1319.50</v>'), sheet1.match(/<row r="5">.*?<\/row>/)?.[0]);
ok('header row frozen', sheet1.includes('state="frozen"'));
ok('no totals row on an empty sheet', !sheet2.includes('Total'));
ok('sheet names cleaned for Excel', book.includes('name="Expenses  2025 26"'), book);
ok('date format used', styles.includes('formatCode="dd/mm/yyyy"'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
