import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, recalculate, type Sheet } from './model';
import { applyBorder, applyStyle, mergeRange, setCellValue } from './ops';
import { importXlsx } from './xlsx';
import { exportXlsx } from './xlsxWrite';
import { unzip } from './zip';

function sample(): Sheet {
  let s = createSheet(5, 4);
  const put = (r: number, c: number, v: string) => (s = setCellValue(s, r, c, v));
  put(0, 0, '견적서');
  s = mergeRange(s, { r1: 0, c1: 0, r2: 0, c2: 3 });
  s = applyStyle(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { bold: true, fontSize: 16, align: 'center' });
  put(1, 0, '품목');
  put(1, 1, '수량');
  put(1, 2, '단가');
  put(1, 3, '금액');
  put(2, 0, '모니터 <27">');
  put(2, 1, '2');
  put(2, 2, '230,000');
  put(2, 3, '=B3*C3');
  put(3, 0, '사번');
  put(3, 1, '0123');
  put(4, 0, '메모');
  put(4, 1, '첫 줄\n둘째 줄');
  s = applyStyle(s, { r1: 2, c1: 2, r2: 2, c2: 3 }, { numFmt: 'currency' });
  s = applyStyle(s, { r1: 1, c1: 0, r2: 1, c2: 3 }, { bg: '#e3edfb', color: '#c62828' });
  s = applyBorder(s, { r1: 1, c1: 0, r2: 2, c2: 3 }, 'all');
  s = { ...s, colWidths: { [s.cols[0]]: 150 }, rowHeights: { '0': 40 } };
  return recalculate(s);
}

test('내보낸 엑셀을 다시 불러오면 값·병합·서식·크기가 그대로', async () => {
  const s = sample();
  const back = (await importXlsx(await exportXlsx(s, { sheetName: '견적' }), { ignorePrintArea: true })).sheet;
  const at = (x: Sheet, r: number, c: number) => String(x.rows[r]?.[x.cols[c]] ?? '');
  assert.equal(at(back, 0, 0), '견적서');
  assert.equal(at(back, 2, 0), '모니터 <27">'); // 특수 문자
  assert.equal(at(back, 2, 3), '460000'); // 수식은 계산된 값으로(기본)
  assert.equal(back.formulas[cellKey(2, back.cols[3])], undefined);
  assert.equal(at(back, 3, 1), '0123'); // 앞 0은 글자로 남는다
  assert.equal(at(back, 4, 1), '첫 줄\n둘째 줄');
  assert.deepEqual(back.merges, [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 4 }]);
  const title = back.styles[cellKey(0, back.cols[0])];
  assert.equal(title?.bold, true);
  assert.equal(title?.fontSize, 16);
  assert.equal(title?.align, 'center');
  const head = back.styles[cellKey(1, back.cols[0])];
  assert.equal(head?.bg?.toLowerCase(), '#e3edfb');
  assert.equal(head?.color?.toLowerCase(), '#c62828');
  assert.equal(head?.border?.t, 'thin');
  assert.equal(back.styles[cellKey(2, back.cols[3])]?.numFmt, 'currency');
  assert.ok(Math.abs((back.colWidths[back.cols[0]] ?? 0) - 150) <= 2);
  assert.ok(Math.abs((back.rowHeights['0'] ?? 0) - 40) <= 2);
});

test('수식 담기 — 행을 빼지 않을 때만, 계산된 값과 함께', async () => {
  const s = sample();
  const files = await unzip(await exportXlsx(s, { formulas: true }));
  const xml = new TextDecoder().decode(files.get('xl/worksheets/sheet1.xml'));
  assert.match(xml, /<c r="D3"[^>]*><f>B3\*C3<\/f><v>460000<\/v><\/c>/);
  const back = (await importXlsx(await exportXlsx(s, { formulas: true }), { ignorePrintArea: true })).sheet;
  assert.equal(back.formulas[cellKey(2, back.cols[3])], '=B3*C3');
});

test('행 빼기·칸 글자 바꾸기 — 아래 행이 올라오고 병합도 맞춘다, 수식은 값으로', async () => {
  const s = sample();
  const bytes = await exportXlsx(s, { skipRow: (r) => r === 1, cellText: (r, c) => (r === 3 && c === 1 ? '비공개' : undefined), formulas: true });
  const back = (await importXlsx(bytes, { ignorePrintArea: true })).sheet;
  const at = (r: number, c: number) => String(back.rows[r]?.[back.cols[c]] ?? '');
  assert.equal(at(1, 0), '모니터 <27">');
  assert.equal(at(2, 1), '비공개');
  assert.equal(back.formulas[cellKey(1, back.cols[3])], undefined);
  assert.equal(back.rows.length, 4);
});

test('파일 구조 — 시트 탭 이름은 엑셀 규칙대로', async () => {
  const files = await unzip(await exportXlsx(createSheet(1, 1), { sheetName: '발주/2026:11 [사본]' }));
  assert.deepEqual([...files.keys()].sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  assert.match(new TextDecoder().decode(files.get('xl/workbook.xml')), /name="발주 2026 11  사본"/);
});

test('그림 — 칸 자리에 띄우고, 넘친 자리는 옆·아래 칸으로, 빼는 행의 그림은 뺀다', async () => {
  const { xlsxSheetImages } = await import('./xlsx');
  const s = sample(); // 열 A=150px, 나머지 96px, 0행 40px
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const bytes = await exportXlsx(s, {
    skipRow: (r) => r === 3,
    pictures: [
      { r: 2, c: 0, x: 160, y: 2, width: 56, height: 56, data: png, type: 'png' }, // A열(150px)을 넘어 B열로
      { r: 3, c: 1, x: 0, y: 0, width: 10, height: 10, data: png, type: 'png' }, // 빼는 행 → 없음
    ],
  });
  const files = await unzip(bytes);
  assert.ok(files.has('xl/media/image1.png'));
  assert.ok(!files.has('xl/media/image2.png'));
  const drawing = new TextDecoder().decode(files.get('xl/drawings/drawing1.xml'));
  assert.match(drawing, /<xdr:col>1<\/xdr:col><xdr:colOff>95250<\/xdr:colOff><xdr:row>2<\/xdr:row>/); // B3, 10px 안쪽
  const imgs = await xlsxSheetImages(bytes);
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].row, 2);
  assert.equal(imgs[0].col, 1);
  assert.equal(Math.round(imgs[0].width), 56);
});
