import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportDocx } from './docxWrite';
import { importDocx } from './docxRead';
import { halfPoints, hexColor } from './docxWrite';
import { imageSize, toDataUrl } from './image';
import { unzip } from './zip';
import type { WordNode } from './model';

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
