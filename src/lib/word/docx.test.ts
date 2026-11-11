import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportDocx } from './docxWrite';
import { importDocx } from './docxRead';
import { halfPoints, hexColor } from './docxWrite';
import { imageSize, toDataUrl } from './image';
import { unzip, zip } from './zip';
import { TABLE_MAX_WIDTH, type WordNode } from './model';
import { CELL_MIN_WIDTH, TABLE_SNAP, fitWidths, snapColumnWidth } from './format';

const t = (text: string, ...marks: WordNode['marks'] & object): WordNode => (marks.length ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...content: WordNode[]): WordNode => ({ type: 'paragraph', content });
const doc = (...content: WordNode[]): WordNode => ({ type: 'doc', content });
const roundTrip = async (d: WordNode) => (await importDocx(await exportDocx(d))).doc;

// 1×1 PNG(빨강)
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

test('문단·제목·정렬·글자 모양이 저장했다 불러와도 그대로', async () => {
  const d = doc(
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [t('업무 보고서')] },
    { type: 'heading', attrs: { level: 2 }, content: [t('1. 개요')] },
    p(t('보통 '), t('굵게', { type: 'bold' }), t(' '), t('기울임', { type: 'italic' }), t(' '), t('밑줄', { type: 'underline' }), t(' '), t('취소', { type: 'strike' })),
    p(t('빨간 14pt', { type: 'textStyle', attrs: { color: '#c62828', fontSize: '14pt' } }), t(' '), t('형광펜', { type: 'highlight', attrs: { color: '#fff59d' } })),
    { type: 'paragraph', attrs: { textAlign: 'right' }, content: [t('오른쪽 <특수> & "문자"'), { type: 'hardBreak' }, t('둘째 줄\t탭')] },
    p(t('링크', { type: 'link', attrs: { href: 'https://workfit.kr' } })),
    { type: 'paragraph' }
  );
  const back = await roundTrip(d);
  assert.deepEqual(back.content![0], { type: 'heading', attrs: { textAlign: 'center', level: 1 }, content: [t('업무 보고서')] });
  assert.equal(back.content![1].attrs?.level, 2);
  assert.deepEqual(back.content![2].content, [t('보통 '), t('굵게', { type: 'bold' }), t(' '), t('기울임', { type: 'italic' }), t(' '), t('밑줄', { type: 'underline' }), t(' '), t('취소', { type: 'strike' })]);
  assert.deepEqual(back.content![3].content![0], t('빨간 14pt', { type: 'textStyle', attrs: { color: '#c62828', fontSize: '14pt' } }));
  assert.deepEqual(back.content![3].content![2], t('형광펜', { type: 'highlight', attrs: { color: '#fff59d' } }));
  assert.deepEqual(back.content![4], { type: 'paragraph', attrs: { textAlign: 'right' }, content: [t('오른쪽 <특수> & "문자"'), { type: 'hardBreak' }, t('둘째 줄\t탭')] });
  assert.deepEqual(back.content![5].content, [t('링크', { type: 'underline' }, { type: 'link', attrs: { href: 'https://workfit.kr' } })]);
  assert.deepEqual(back.content![6], { type: 'paragraph' });
});

test('여러 단계 목록 — 글머리·번호, 번호 목록은 목록마다 다시 1부터', async () => {
  const li = (...content: WordNode[]): WordNode => ({ type: 'listItem', content });
  const d = doc(
    { type: 'bulletList', content: [li(p(t('사과'))), li(p(t('배')), { type: 'orderedList', attrs: { start: 1 }, content: [li(p(t('배 1'))), li(p(t('배 2')))] })] },
    p(t('사이')),
    { type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('셋'))), li(p(t('넷')))] }
  );
  const back = await roundTrip(d);
  assert.equal(back.content![0].type, 'bulletList');
  assert.equal(back.content![0].content!.length, 2);
  const nested = back.content![0].content![1].content![1];
  assert.equal(nested.type, 'orderedList');
  assert.deepEqual(nested.content!.map((x) => x.content![0].content![0].text), ['배 1', '배 2']);
  assert.equal(back.content![1].content![0].text, '사이');
  assert.deepEqual(back.content![2].attrs, { start: 3 });
  assert.equal(back.content![2].content!.length, 2);
});

test('표 — 가로·세로로 합친 칸, 머리 칸, 열 너비', async () => {
  const cell = (text: string, attrs: Record<string, unknown> = {}, type = 'tableCell'): WordNode => ({ type, attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [p(t(text))] });
  const d = doc({
    type: 'table',
    content: [
      { type: 'tableRow', content: [cell('구분', { colwidth: [120] }, 'tableHeader'), cell('1분기', { colspan: 2 }, 'tableHeader')] },
      { type: 'tableRow', content: [cell('매출', { rowspan: 2 }), cell('100'), cell('200')] },
      { type: 'tableRow', content: [cell('300'), cell('400')] },
    ],
  });
  const files = await unzip(await exportDocx(d));
  const xml = new TextDecoder().decode(files.get('word/document.xml'));
  assert.match(xml, /<w:gridSpan w:val="2"\/>/);
  assert.match(xml, /<w:vMerge w:val="restart"\/>/);
  assert.match(xml, /<w:vMerge\/>/);
  const back = (await importDocx(await exportDocx(d))).doc.content![0];
  const rows = back.content!.map((r) => r.content!.map((c) => [c.content![0].content?.[0]?.text, c.attrs?.colspan, c.attrs?.rowspan]));
  assert.deepEqual(rows, [
    [['구분', 1, 1], ['1분기', 2, 1]],
    [['매출', 1, 2], ['100', 1, 1], ['200', 1, 1]],
    [['300', 1, 1], ['400', 1, 1]],
  ]);
  assert.deepEqual(back.content![0].content![0].attrs?.colwidth, [120]);
  // 머리 칸 글은 굵게
  assert.deepEqual(back.content![0].content![0].content![0].content![0].marks, [{ type: 'bold' }]);
});

test('표 칸 배경색·세로 맞춤 — 저장하고 다시 읽어도 그대로, 흰 글씨 제목 칸이 바탕과 함께 온다', async () => {
  const cell = (text: string, attrs: Record<string, unknown>): WordNode => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [p(t(text))] });
  const d = doc({
    type: 'table',
    content: [{ type: 'tableRow', content: [cell('제목', { background: '#1f2d50', verticalAlign: 'middle' }), cell('보통', {})] }],
  });
  const xml = new TextDecoder().decode((await unzip(await exportDocx(d))).get('word/document.xml'));
  // tcPr 안 순서: shd 다음 vAlign
  assert.match(xml, /<w:shd w:val="clear" w:color="auto" w:fill="1F2D50"\/><w:vAlign w:val="center"\/><\/w:tcPr>/);
  const cells = (await importDocx(await exportDocx(d))).doc.content![0].content![0].content!;
  assert.equal(cells[0].attrs?.background, '#1f2d50');
  assert.equal(cells[0].attrs?.verticalAlign, 'middle');
  assert.equal(cells[1].attrs?.background, undefined);
  assert.equal(cells[1].attrs?.verticalAlign, undefined);
});

test('표 행 높이 — 정한 줄만 워드 행 높이로 저장하고 다시 읽으면 같은 높이', async () => {
  const row = (text: string, height?: number): WordNode => ({
    type: 'tableRow',
    ...(height ? { attrs: { height } } : {}),
    content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [p(t(text))] }],
  });
  const d = doc({ type: 'table', content: [row('제목', 47), row('보통')] });
  const xml = new TextDecoder().decode((await unzip(await exportDocx(d))).get('word/document.xml'));
  assert.match(xml, /<w:tr><w:trPr><w:trHeight w:val="705"\/><\/w:trPr><w:tc>/);
  const rows = (await importDocx(await exportDocx(d))).doc.content![0].content!;
  assert.equal(rows[0].attrs?.height, 47);
  assert.equal(rows[1].attrs, undefined);
});

test('불러온 표는 바깥 테두리까지 본문 폭 안 — 종이보다 넓은 표에 가로 스크롤이 생기지 않게', async () => {
  const wide = doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: [900] }, content: [p(t('넓은 표'))] }] }] });
  const back = (await importDocx(await exportDocx(wide))).doc.content![0];
  const w = (back.content![0].content![0].attrs?.colwidth as number[])[0];
  assert.ok(w <= TABLE_MAX_WIDTH, `열 너비 ${w}`);
});

test('줄 간격·문단 간격·들여쓰기 — 저장했다 불러와도 그대로, 기본값인 문단엔 값이 붙지 않는다', async () => {
  const d = doc(
    { type: 'paragraph', attrs: { lineHeight: 2, spaceBefore: 12, spaceAfter: 0, indent: 20, firstLine: -10 }, content: [t('모양 있는 문단')] },
    p(t('기본 문단')),
    { type: 'heading', attrs: { level: 1 }, content: [t('제목')] },
  );
  const back = await roundTrip(d);
  assert.deepEqual(back.content![0].attrs, { lineHeight: 2, spaceBefore: 12, spaceAfter: 0, indent: 20, firstLine: -10 });
  assert.equal(back.content![1].attrs, undefined);
  assert.deepEqual(back.content![2].attrs, { level: 1 });
  // 표 칸 안 기본 문단도 값이 붙지 않는다
  const inCell = await roundTrip(doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [p(t('칸'))] }] }] }));
  assert.equal(inCell.content![0].content![0].content![0].content![0].attrs, undefined);
});

/** 워드가 만든 것 같은 최소 .docx — 본문과 스타일만 */
async function wordFile(body: string, styles: string): Promise<Uint8Array> {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return zip([
    ['word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`],
    ['word/styles.xml', `<?xml version="1.0"?><w:styles ${W}>${styles}</w:styles>`],
  ]);
}

test('워드 문서 불러오기 — 문서 기본 간격·스타일 간격·글자 단위 들여쓰기를 덮어 써서 읽는다', async () => {
  const styles =
    '<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Body"><w:name w:val="본문"/><w:basedOn w:val="a"/><w:pPr><w:spacing w:before="120"/></w:pPr></w:style>';
  const body =
    '<w:p><w:r><w:t>기본 스타일</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="Body"/><w:ind w:leftChars="200" w:firstLineChars="100"/></w:pPr><w:r><w:t>본문 스타일</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:spacing w:line="360" w:lineRule="exact"/></w:pPr><w:r><w:t>고정 18pt</w:t></w:r></w:p>';
  const { doc: d } = await importDocx(await wordFile(body, styles));
  // 문서 기본(뒤 8pt·1.08줄) → Normal(뒤 0) 순으로 덮어 씀
  assert.deepEqual(d.content![0].attrs, { lineHeight: 1.08, spaceAfter: 0 });
  // Body 는 Normal 위에 앞 6pt, 글자 단위 들여쓰기(2글자·첫 줄 1글자 = 20pt·10pt)
  assert.deepEqual(d.content![1].attrs, { lineHeight: 1.08, spaceBefore: 6, spaceAfter: 0, indent: 20, firstLine: 10 });
  // 고정 줄 간격은 기본 글자 한 줄 기준 배수로(18pt ÷ 17.28pt)
  assert.equal(d.content![2].attrs?.lineHeight, 1.04);
});

test('표 테두리 — 칸 테두리를 저장했다 불러와도 그대로', async () => {
  const line = { style: 'solid', width: 2, color: '#1f2d50' };
  const none = { style: 'none', width: 0, color: '#000000' };
  const borders = { top: line, right: none, bottom: { style: 'double', width: 3, color: '#000000' }, left: { style: 'dashed', width: 1, color: '#808080' } };
  const d = doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, borders }, content: [p(t('칸'))] }] }] });
  const xml = new TextDecoder().decode((await unzip(await exportDocx(d))).get('word/document.xml'));
  // tcPr 안 순서: tcBorders(top → left → bottom → right) 다음 shd
  assert.match(xml, /<w:tcBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="1F2D50"\/><w:left w:val="dashed"[^>]*\/><w:bottom w:val="double"[^>]*\/><w:right w:val="nil"\/><\/w:tcBorders>/);
  const cell = (await roundTrip(d)).content![0].content![0].content![0];
  assert.deepEqual(cell.attrs?.borders, borders);
});

test('워드 표 테두리 불러오기 — 표 스타일·표 테두리(바깥·안쪽)·칸 테두리 순으로 정한다, 아무것도 없으면 선 없음', async () => {
  const styles =
    '<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>' +
    '<w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/>' +
    '<w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders></w:tblPr></w:style>';
  const tc = (text: string, borders = '') => `<w:tc><w:tcPr>${borders}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const body =
    '<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblBorders><w:top w:val="single" w:sz="16" w:color="1F2D50"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>' +
    `<w:tr>${tc('가')}${tc('나', '<w:tcBorders><w:right w:val="dotted" w:sz="8" w:color="C62828"/></w:tcBorders>')}</w:tr>` +
    `<w:tr>${tc('다')}${tc('라')}</w:tr></w:tbl>` +
    '<w:tbl><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr>' + tc('선 없는 표') + '</w:tr></w:tbl>';
  const { doc: d } = await importDocx(await wordFile(body, styles));
  const cells = d.content![0].content!.map((r) => r.content!.map((c) => c.attrs?.borders as Record<string, { style: string; width: number; color: string }>));
  // 워드 0.5pt(sz=4) 선은 0.67px — 소수 그대로 들고 있어야 다시 저장해도 0.5pt
  const black = { style: 'solid', width: 0.67, color: '#000000' };
  // 위 변은 표 테두리(굵은 남색), 가운데 세로선은 표가 없앰, 오른쪽 위 칸 오른쪽은 칸 테두리(빨간 점선)
  assert.deepEqual(cells[0][0], { top: { style: 'solid', width: 2.67, color: '#1f2d50' }, right: { style: 'none', width: 0, color: '#000000' }, bottom: black, left: black });
  assert.deepEqual(cells[0][1].right, { style: 'dotted', width: 1.33, color: '#c62828' });
  assert.deepEqual(cells[1][1], { top: black, right: black, bottom: black, left: { style: 'none', width: 0, color: '#000000' } });
  const plain = d.content![1].content![0].content![0].attrs?.borders as Record<string, { style: string }>;
  assert.ok(['top', 'right', 'bottom', 'left'].every((s) => plain[s].style === 'none'));
});

test('그림 — 파일에 담고 다시 읽으면 같은 그림·크기', async () => {
  const src = toDataUrl(PNG, 'png');
  const d = doc(p(t('앞 '), { type: 'image', attrs: { src, alt: '로고', width: 40, height: 40 } }, t(' 뒤')));
  const files = await unzip(await exportDocx(d));
  assert.ok(files.has('word/media/image1.png'));
  const back = await roundTrip(d);
  const img = back.content![0].content![1];
  assert.equal(img.type, 'image');
  assert.equal(img.attrs?.src, src);
  assert.equal(img.attrs?.alt, '로고');
  assert.equal(img.attrs?.width, 40);
  assert.deepEqual(imageSize(PNG), { width: 1, height: 1 });
});

test('인용·구분선 — 인용은 Quote 스타일 문단, 구분선은 아래 테두리 문단', async () => {
  const files = await unzip(await exportDocx(doc({ type: 'blockquote', content: [p(t('인용'))] }, { type: 'horizontalRule' })));
  const xml = new TextDecoder().decode(files.get('word/document.xml'));
  assert.match(xml, /<w:pStyle w:val="Quote"\/>/);
  assert.match(xml, /<w:pBdr><w:bottom/);
});

test('문단 속성 순서는 워드 규칙대로(틀리면 워드가 손상 파일로 봄)', async () => {
  const li = (...content: WordNode[]): WordNode => ({ type: 'listItem', content });
  const files = await unzip(await exportDocx(doc({ type: 'bulletList', content: [li(p(t('첫')), { type: 'paragraph', attrs: { textAlign: 'center' }, content: [t('둘')] })] })));
  const xml = new TextDecoder().decode(files.get('word/document.xml'));
  assert.ok(xml.includes('<w:pPr><w:ind w:left="720"/><w:contextualSpacing/><w:jc w:val="center"/></w:pPr>'));
  assert.match(xml, /<w:pPr><w:numPr>.*?<\/w:numPr><w:contextualSpacing\/><\/w:pPr>/);
});

test('표 선 굵기는 저장→불러오기→저장을 오가도 그대로(0.5pt 선이 0.75pt 로 바뀌지 않게)', async () => {
  const tbl = doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [p(t('칸'))] }] }] });
  const once = await roundTrip(tbl);
  const xml = new TextDecoder().decode((await unzip(await exportDocx(once))).get('word/document.xml'));
  assert.match(xml, /<w:tcBorders><w:top w:val="single" w:sz="4" /);
});

test('워드 문서 불러오기 — 글자·줄 단위가 0 이면 단위 없는 값을 쓴다(한글 문서 변환본)', async () => {
  const body =
    '<w:p><w:pPr><w:spacing w:beforeLines="0" w:before="240" w:after="0"/><w:ind w:leftChars="0" w:left="800" w:firstLineChars="0" w:firstLine="400"/></w:pPr><w:r><w:t>가</w:t></w:r></w:p>';
  const { doc: d } = await importDocx(await wordFile(body, ''));
  assert.deepEqual(d.content![0].attrs, { lineHeight: 1, spaceBefore: 12, spaceAfter: 0, indent: 40, firstLine: 20 });
});

test('워드 표 테두리 불러오기 — 들쭉날쭉한 줄(gridBefore)의 첫 칸도 바깥선, 표 스타일이 없으면 문서 기본 표 스타일', async () => {
  const styles =
    '<w:style w:type="table" w:default="1" w:styleId="Base"><w:name w:val="Normal Table"/><w:tblPr><w:tblBorders><w:left w:val="single" w:sz="8" w:color="FF0000"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr></w:style>';
  const tc = (text: string) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const body =
    '<w:tbl><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>' +
    `<w:tr>${tc('가')}${tc('나')}</w:tr><w:tr><w:trPr><w:gridBefore w:val="1"/></w:trPr>${tc('다')}</w:tr></w:tbl>`;
  const { doc: d } = await importDocx(await wordFile(body, styles));
  const red = { style: 'solid', width: 1.33, color: '#ff0000' };
  assert.deepEqual((d.content![0].content![1].content![0].attrs?.borders as Record<string, unknown>).left, red);
  assert.deepEqual((d.content![0].content![0].content![1].attrs?.borders as Record<string, unknown>).left, { style: 'none', width: 0, color: '#000000' });
});

test('글꼴 — 영문 글꼴은 한글 자리에 넣지 않는다(워드가 한글을 바탕체로 바꿔 그리지 않게), 한글 글꼴은 넣는다', async () => {
  const font = (f: string) => p(t('가a', { type: 'textStyle', attrs: { fontFamily: f } }));
  const xml = new TextDecoder().decode((await unzip(await exportDocx(doc(font('Segoe UI'), font('Batang, 바탕, serif'))))).get('word/document.xml'));
  assert.ok(xml.includes('<w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/>'));
  assert.ok(xml.includes('<w:rFonts w:ascii="Batang" w:hAnsi="Batang" w:eastAsia="Batang"/>'));
});

test('열 너비 맞추기 — 합은 표 너비 그대로, 최소 너비보다 좁은 열은 최소 너비로 두고 나머지를 줄인다', () => {
  const out = fitWidths([32, 165, 119, 225, 64], 600);
  assert.ok(out.reduce((a, b) => a + b, 0) <= 600);
  assert.ok(out.every((w) => w >= CELL_MIN_WIDTH));
  assert.deepEqual(fitWidths([100, 100], 300), [150, 150]);
});

test('열 끌기 — 표 끝이 본문 경계 앞뒤 근처면 경계에 붙고, 더 끌면 넘어간다. 너비 모르는 열이 있으면 그대로', () => {
  const w = [100, 200, 200];
  assert.equal(snapColumnWidth(w, 2, 150, 600), 150);
  assert.equal(snapColumnWidth(w, 2, 300 - TABLE_SNAP + 1, 600), 300);
  assert.equal(snapColumnWidth(w, 2, 300 + TABLE_SNAP - 1, 600), 300);
  assert.equal(snapColumnWidth(w, 2, 450, 600), 450);
  assert.equal(snapColumnWidth([100, undefined, 200], 2, 450, 600), 450);
});

test('글꼴 불러오기 — 영문 글꼴만 정한 글은 한글 자리에 문서 기본 한글 글꼴(화면이 한글을 엉뚱한 글꼴로 그리지 않게), 다시 저장해도 같은 짝', async () => {
  const body = '<w:p><w:r><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/></w:rPr><w:t>가a</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="바탕"/></w:rPr><w:t>나b</w:t></w:r></w:p>';
  const { doc: d } = await importDocx(await wordFile(body, ''));
  const fam = d.content![0].content!.map((n) => n.marks?.[0]?.attrs?.fontFamily);
  assert.deepEqual(fam, ['Segoe UI, 맑은 고딕', 'Arial, 바탕']);
  const xml = new TextDecoder().decode((await unzip(await exportDocx(d))).get('word/document.xml'));
  assert.ok(xml.includes('<w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:eastAsia="맑은 고딕"/>'));
  assert.ok(xml.includes('<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="바탕"/>'));
});

test('색·크기 읽기', () => {
  assert.equal(hexColor('#abc'), 'AABBCC');
  assert.equal(hexColor('rgb(255, 0, 16)'), 'FF0010');
  assert.equal(hexColor('red'), undefined);
  assert.equal(halfPoints('14pt'), 28);
  assert.equal(halfPoints('16px'), 24);
  assert.equal(halfPoints('abc'), undefined);
});

test('워드가 아닌 파일은 알아듣게 막는다', async () => {
  await assert.rejects(importDocx(new Uint8Array([1, 2, 3])));
});

// 이 모듈은 다른 프로젝트로 폴더째 옮겨 쓸 수 있어야 한다 — 폴더 안 상대 경로와 react·@tiptap 만 불러온다
test('모듈 밖 코드를 불러오지 않는다', () => {
  const DIR = dirname(fileURLToPath(import.meta.url));
  const ok = (spec: string) => spec.startsWith('./') || spec === 'react' || spec.startsWith('react/') || spec.startsWith('@tiptap/');
  const bad: string[] = [];
  for (const f of readdirSync(DIR).filter((x) => /\.tsx?$/.test(x) && !/\.test\.tsx?$/.test(x))) {
    for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) if (!ok(m[1])) bad.push(`${f} → ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
