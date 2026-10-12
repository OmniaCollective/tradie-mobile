/**
 * A small Excel (.xlsx) writer: a few sheets of text, money and dates, a bold header
 * row that stays put when scrolling, and an optional bold totals row. Opens in Excel,
 * Numbers and Google Sheets. Pure JS so it also runs in tests.
 */
import { zipSync, strToU8 } from 'fflate';

export type Cell =
  | string
  | { money: number }
  | { date: string } // YYYY-MM-DD
  | { number: number }
  | null;

export interface Sheet {
  name: string;
  columns: { title: string; width: number }[];
  rows: Cell[][];
  /** Labels the totals row; money columns listed here are summed. */
  totals?: { label: string; columns: number[] };
}

const xml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Characters XML 1.0 can't hold (a pasted control character would corrupt the file).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + colName(i % 26));

/** Excel's day number: days since 30 December 1899. */
const excelDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};

// Styles (cellXfs order): 0 plain, 1 bold, 2 money, 3 date, 4 bold money.
const STYLE = { plain: 0, bold: 1, money: 2, date: 3, boldMoney: 4 };

const cellXml = (ref: string, cell: Cell, bold = false): string => {
  if (cell === null || cell === '') return '';
  if (typeof cell === 'string') {
    return `<c r="${ref}" t="inlineStr"${bold ? ` s="${STYLE.bold}"` : ''}><is><t xml:space="preserve">${xml(cell)}</t></is></c>`;
  }
  if ('money' in cell) return `<c r="${ref}" s="${bold ? STYLE.boldMoney : STYLE.money}"><v>${cell.money.toFixed(2)}</v></c>`;
  if ('date' in cell) return `<c r="${ref}" s="${STYLE.date}"><v>${excelDay(cell.date)}</v></c>`;
  return `<c r="${ref}"><v>${cell.number}</v></c>`;
};

const sheetXml = (sheet: Sheet): string => {
  const header = `<row r="1">${sheet.columns.map((c, i) => cellXml(`${colName(i)}1`, c.title, true)).join('')}</row>`;
  const body = sheet.rows
    .map((row, r) => `<row r="${r + 2}">${row.map((cell, i) => cellXml(`${colName(i)}${r + 2}`, cell)).join('')}</row>`)
    .join('');
  let totals = '';
  if (sheet.totals && sheet.rows.length > 0) {
    const r = sheet.rows.length + 3; // one blank row, then the totals
    const cells = sheet.columns.map((_, i) => {
      const ref = `${colName(i)}${r}`;
      if (i === 0) return cellXml(ref, sheet.totals!.label, true);
      if (!sheet.totals!.columns.includes(i)) return '';
      const sum = sheet.rows.reduce((s, row) => {
        const c = row[i];
        return s + (c && typeof c === 'object' && 'money' in c ? c.money : 0);
      }, 0);
      const col = colName(i);
      // The formula keeps the total right if the accountant edits a row; the value shows straight away.
      return `<c r="${ref}" s="${STYLE.boldMoney}"><f>SUM(${col}2:${col}${sheet.rows.length + 1})</f><v>${sum.toFixed(2)}</v></c>`;
    });
    totals = `<row r="${r}">${cells.join('')}</row>`;
  }
  const cols = sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${body}${totals}</sheetData>` +
    '</worksheet>'
  );
};

/** Builds the workbook. `dateFormat` is Excel's, e.g. "dd/mm/yyyy" (UK) or "mm/dd/yyyy" (US). */
export function buildXlsx(sheets: Sheet[], dateFormat: string): Uint8Array {
  const names = sheets.map((s) => xml(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<numFmts count="1"><numFmt numFmtId="164" formatCode="${xml(dateFormat)}"/></numFmts>` +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="5">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
        '</cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    ),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return zipSync(files, { level: 6 });
}
