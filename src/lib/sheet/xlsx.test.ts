import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, type Sheet } from './model';
import { importXlsx, XlsxError } from './xlsx';
import { unzip } from './zip';
import { parseXml, textOf, find } from './xml';

// ── 시험용 .xlsx 만들기: 진짜 엑셀과 같은 ZIP 구조(일부 항목은 deflate 로 압축) ──
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zip(files: Record<string, string>, compress = true): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = compress ? await deflateRaw(raw) : raw;
    const nameBytes = enc.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, compress ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, compress ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function workbook(sheetXml: string, extra: Record<string, string> = {}, sheetNames = ['발주서']): Record<string, string> {
  return {
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook ${NS}><sheets>${sheetNames
      .map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet ${NS}>${sheetXml}</worksheet>`,
    ...extra,
  };
}

const STYLES = `<?xml version="1.0"?><styleSheet ${NS}>
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0&quot;원&quot;"/></numFmts>
<fonts count="2"><font><sz val="11"/><color theme="1"/></font><font><b/><sz val="14"/><color rgb="FFC00000"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/></border><border><left style="thin"/><right style="thin"/><top style="medium"/><bottom style="thin"/></border></borders>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="1"/>
</cellXfs></styleSheet>`;

const SHARED = `<?xml version="1.0"?><sst ${NS} count="4" uniqueCount="4"><si><t>발 주 서</t></si><si><t>품목</t></si><si><r><t>노트</t></r><r><rPr><b/></rPr><t>북</t></r></si><si><t xml:space="preserve">A&amp;B "견적"</t></si></sst>`;

const at = (s: Sheet, addr: string) => {
  const m = addr.match(/^([A-Z]+)(\d+)$/)!;
  const c = m[1].charCodeAt(0) - 65;
  return s.rows[Number(m[2]) - 1][s.cols[c]];
};
const styleAt = (s: Sheet, addr: string) => {
  const m = addr.match(/^([A-Z]+)(\d+)$/)!;
  return s.styles[cellKey(Number(m[2]) - 1, s.cols[m[1].charCodeAt(0) - 65])];
};
const formulaAt = (s: Sheet, addr: string) => {
  const m = addr.match(/^([A-Z]+)(\d+)$/)!;
  return s.formulas[cellKey(Number(m[2]) - 1, s.cols[m[1].charCodeAt(0) - 65])];
};

const SHEET = `<sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="3" width="10" customWidth="1"/></cols>
<sheetData>
<row r="1" ht="30" customHeight="1"><c r="A1" s="1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="inlineStr"><is><t>수량</t></is></c><c r="C2"><v>0</v></c></row>
<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>2</v></c><c r="C3" s="2"><v>1500000</v></c><c r="D3" s="2"><f t="shared" ref="D3:D4" si="0">B3*C3</f><v>3000000</v></c></row>
<row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4"><v>1</v></c><c r="C4" s="2"><v>500000</v></c><c r="D4" s="2"><f t="shared" si="0"/><v>500000</v></c></row>
<row r="5"><c r="A5" s="3"><v>46329</v></c><c r="B5" t="b"><v>1</v></c><c r="C5" s="4"><v>0.1</v></c><c r="D5" s="2"><f>SUM(D3:D4)</f><v>3500000</v></c></row>
<row r="6"><c r="A6"><f>VLOOKUP(1,A1:B2,2,0)</f><v>42</v></c><c r="B6" s="2"/><c r="C6" s="2"/></row>
<row r="40"><c r="H40" s="0"/></row>
</sheetData>
<mergeCells count="1"><mergeCell ref="A1:D1"/></mergeCells>`;

test('ZIP 풀기 — 저장·deflate 둘 다', async () => {
  for (const compress of [false, true]) {
    const files = await unzip(await zip({ 'a.txt': '가나다', 'b/c.xml': '<x>1</x>' }, compress));
    assert.equal(new TextDecoder().decode(files.get('a.txt')), '가나다');
    assert.equal(new TextDecoder().decode(files.get('b/c.xml')), '<x>1</x>');
  }
});

test('XML 읽기 — 이름공간 접두사·엔티티·주석·CDATA', () => {
  const root = parseXml('<?xml version="1.0"?><!-- 주석 --><x:a k="1&amp;2"><x:b>A &lt; B &#44608;</x:b><c><![CDATA[<raw>]]></c></x:a>');
  const a = find(root, 'a')!;
  assert.equal(a.attrs.k, '1&2');
  assert.equal(textOf(find(root, 'b')), 'A < B 김');
  assert.equal(textOf(find(root, 'c')), '<raw>');
});

test('엑셀 불러오기 — 값·글자·병합·너비·높이', async () => {
  const { sheet, warnings } = await importXlsx(await zip(workbook(SHEET, { 'xl/styles.xml': STYLES, 'xl/sharedStrings.xml': SHARED })));
  assert.equal(at(sheet, 'A1'), '발 주 서');
  assert.equal(at(sheet, 'B2'), '수량'); // inlineStr
  assert.equal(at(sheet, 'A3'), '노트북'); // 서식 있는 글
  assert.equal(at(sheet, 'A4'), 'A&B "견적"');
  assert.equal(at(sheet, 'B5'), 'TRUE');
  assert.equal(at(sheet, 'A5'), '2026-11-03'); // 날짜 서식(14) → 글자
  assert.deepEqual(sheet.merges, [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 4 }]);
  assert.equal(sheet.colWidths[sheet.cols[0]], 145); // 20글자
  assert.equal(sheet.colWidths[sheet.cols[1]], 75);
  assert.equal(sheet.colWidths[sheet.cols[3]], 64); // 지정 없음 → 엑셀 기본
  assert.equal(sheet.rowHeights['0'], 40); // 30pt
  assert.equal(sheet.rowHeights['1'], undefined); // 기본 높이
  // 서식만 있는 먼 칸(H40)은 버리고, 테두리만 있는 빈 칸(B6·C6)은 남긴다
  assert.equal(sheet.rows.length, 6);
  assert.equal(sheet.cols.length, 4);
  assert.ok(warnings.length >= 1);
});

test('엑셀 불러오기 — 서식', async () => {
  const { sheet } = await importXlsx(await zip(workbook(SHEET, { 'xl/styles.xml': STYLES, 'xl/sharedStrings.xml': SHARED })));
  assert.deepEqual(styleAt(sheet, 'A1'), {
    bold: true,
    fontSize: 14,
    color: '#c00000',
    bg: '#ddebf7',
    border: { t: 'thick', r: 'thin', b: 'thin', l: 'thin' },
    align: 'center',
    valign: 'middle',
  });
  assert.equal(styleAt(sheet, 'C3')?.numFmt, 'currency'); // '#,##0"원"'
  assert.equal(styleAt(sheet, 'C5')?.numFmt, 'percent');
  assert.equal(styleAt(sheet, 'A2'), undefined); // 기본 서식은 저장 안 함
});

test('엑셀 불러오기 — 수식: 공유 수식 풀기, 계산, 못 푸는 수식은 값만', async () => {
  const { sheet, warnings } = await importXlsx(await zip(workbook(SHEET, { 'xl/styles.xml': STYLES, 'xl/sharedStrings.xml': SHARED })));
  assert.equal(formulaAt(sheet, 'D3'), '=B3*C3');
  assert.equal(formulaAt(sheet, 'D4'), '=B4*C4');
  assert.equal(at(sheet, 'D4'), '500000');
  assert.equal(at(sheet, 'D5'), '3500000');
  assert.equal(formulaAt(sheet, 'A6'), undefined);
  assert.equal(at(sheet, 'A6'), '42');
  assert.ok(warnings.some((w) => w.includes('A6')));
});

test('엑셀 불러오기 — 시트가 여럿이면 첫 시트만, 크기 제한', async () => {
  const { sheet, warnings } = await importXlsx(await zip(workbook(SHEET, { 'xl/styles.xml': STYLES, 'xl/sharedStrings.xml': SHARED }, ['발주서', '단가표'])), {
    maxRows: 3,
    maxCols: 2,
  });
  assert.equal(sheet.rows.length, 3);
  assert.equal(sheet.cols.length, 2);
  assert.ok(warnings.some((w) => w.includes('첫 번째 시트')));
  assert.ok(warnings.some((w) => w.includes('3행까지')));
  assert.ok(warnings.some((w) => w.includes('B열까지')));
  assert.deepEqual(sheet.merges, [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 2 }]);
});

test('엑셀이 아닌 파일·빈 시트는 알기 쉬운 오류', async () => {
  await assert.rejects(importXlsx(new TextEncoder().encode('그냥 글')), (e) => e instanceof XlsxError && e.message.includes('.xlsx'));
  await assert.rejects(importXlsx(await zip({ 'a.txt': 'x' })), XlsxError);
  await assert.rejects(importXlsx(await zip(workbook('<sheetData/>'))), (e) => e instanceof XlsxError && e.message.includes('내용이 없습니다'));
});

// ── 색인 색·테마 색(밝기)·자릿수·인쇄 영역 ──
const STYLES2 = `<?xml version="1.0"?><styleSheet ${NS}>
<numFmts count="1"><numFmt numFmtId="179" formatCode="0.0%"/></numFmts>
<fonts count="2"><font><sz val="11"/><color theme="1"/></font><font><color theme="4" tint="-0.249977111117893"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor indexed="13"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor theme="0"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor theme="4" tint="0.79998168889431442"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="0" fillId="2" borderId="0"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0"/>
<xf numFmtId="179" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment vertical="center" shrinkToFit="1"/></xf>
</cellXfs></styleSheet>`;

const THEME = `<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
</a:clrScheme></a:themeElements></a:theme>`;

const SHEET2 = `<sheetData>
<row r="1"><c r="A1" s="1" t="inlineStr"><is><t>노랑</t></is></c><c r="B1" s="2" t="inlineStr"><is><t>흰</t></is></c><c r="C1" s="3" t="inlineStr"><is><t>테마</t></is></c></row>
<row r="2"><c r="A2" s="4"><v>0.6133338785</v></c><c r="B2" s="5"><v>3.14159</v></c><c r="C2"><f>TODAY()</f><v>46000</v></c><c r="F2" t="inlineStr"><is><t>인쇄 밖</t></is></c></row>
<row r="3"><c r="A3" s="6" t="inlineStr"><is><t>맞춤</t></is></c></row>
<row r="5"><c r="A5" t="inlineStr"><is><t>인쇄 밖</t></is></c></row>
</sheetData>`;

const WB_PRINT = (sheetXml: string) => {
  const files = workbook(sheetXml, { 'xl/styles.xml': STYLES2, 'xl/theme/theme1.xml': THEME });
  files['xl/workbook.xml'] = files['xl/workbook.xml'].replace(
    '</workbook>',
    `<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'발주서'!$A$1:$C$3</definedName></definedNames></workbook>`
  );
  return files;
};

test('엑셀 불러오기 — 옛 색인 색·테마 색(밝기 조절)·흰 배경 생략', async () => {
  const { sheet, warnings } = await importXlsx(await zip(WB_PRINT(SHEET2)));
  assert.equal(styleAt(sheet, 'A1')?.bg, '#ffff00'); // indexed 13
  assert.equal(styleAt(sheet, 'B1'), undefined); // theme 0(흰색) 배경은 문서 바탕과 같아 두지 않음
  assert.equal(styleAt(sheet, 'C1')?.bg, '#dce6f2'); // accent1 + 80% 밝게 (엑셀 #dce6f1 — 반올림 차이 1)
  assert.equal(styleAt(sheet, 'C1')?.color, '#376092'); // accent1 25% 어둡게
  assert.ok(!warnings.some((w) => w.includes('색')));
});

test('엑셀 불러오기 — 소수 자릿수, TODAY, 인쇄 영역 밖은 버림', async () => {
  const { sheet, warnings } = await importXlsx(await zip(WB_PRINT(SHEET2)));
  assert.deepEqual(
    [styleAt(sheet, 'A2')?.numFmt, styleAt(sheet, 'A2')?.decimals, styleAt(sheet, 'B2')?.numFmt, styleAt(sheet, 'B2')?.decimals],
    ['percent', 1, undefined, 2]
  );
  assert.equal(at(sheet, 'A2'), '0.6133338785'); // 값은 그대로, 표시만 61.3%
  assert.match(at(sheet, 'C2'), /^\d{4}-\d{2}-\d{2}$/); // TODAY() 계산됨
  assert.equal(formulaAt(sheet, 'C2'), '=TODAY()');
  assert.equal(sheet.rows.length, 3);
  assert.equal(sheet.cols.length, 3);
  assert.ok(warnings.some((w) => w.includes('인쇄 영역(A1:C3)')));
  assert.ok(!warnings.some((w) => w.includes('수식')));
});

test('엑셀 불러오기 — 셀에 맞춤(shrinkToFit)', async () => {
  const { sheet } = await importXlsx(await zip(WB_PRINT(SHEET2)));
  assert.equal(styleAt(sheet, 'A3')?.shrink, true);
  assert.equal(styleAt(sheet, 'A1')?.shrink, undefined);
});

test('여러 시트 — 시트 이름 목록, 고른 시트 읽기(안내 없음), 없으면 첫 시트', async () => {
  const sheetXml = (v: string) =>
    `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${v}</t></is></c></row></sheetData></worksheet>`;
  const bytes = await zip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="견적" r:id="rId1"/><sheet name="세부" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheetXml('첫 시트'),
    'xl/worksheets/sheet2.xml': sheetXml('둘째 시트'),
  });
  const first = await importXlsx(bytes);
  assert.deepEqual(first.sheetNames, ['견적', '세부']);
  assert.equal(first.sheet.rows[0][first.sheet.cols[0]], '첫 시트');
  assert.ok(first.warnings.some((w) => w.includes('첫 번째 시트')));
  const second = await importXlsx(bytes, { sheet: 1 });
  assert.equal(second.sheet.rows[0][second.sheet.cols[0]], '둘째 시트');
  assert.ok(!second.warnings.some((w) => w.includes('첫 번째 시트')));
});

test('인쇄 영역 — 기본은 그 안까지, ignorePrintArea 면 전부(파일 보기)', async () => {
  const cell = (ref: string, v: string) => `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const bytes = await zip({
    'xl/workbook.xml':
      '<workbook><sheets><sheet name="S" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">S!$A$1:$A$1</definedName></definedNames></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData><row r="1">${cell('A1', '안')}${cell('C1', '밖')}</row></sheetData></worksheet>`,
  });
  assert.equal((await importXlsx(bytes)).sheet.cols.length, 1);
  assert.equal((await importXlsx(bytes, { ignorePrintArea: true })).sheet.cols.length, 3);
});
