import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, mergeRange, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, SHEET_VALUES_KEY, applyValues, setCellName, type CellInputType } from './approvalSheet';
import { canImportRelated, cellLabel, collectLabeled, importRelated, labeledFromDoc, labeledFromLegacy, labelKeyOf, normalizeLabel } from './labelMatch';
import { collectNamed, hasImportableNames, sheetWith } from './relatedImport';
import { SHEET_ROWS_KEY, repeatSections, setRepeatSection } from './repeatRows';

const input = (s: Sheet, r: number, c: number, type: CellInputType = 'text') => setCellMeta(s, APPROVAL_NS.input, r, c, { type });

/**
 * 품의서(원본) — 칸 이름 없음
 * 0행: '거래처' | [입력]
 * 1행: '품명'   | '수량'        ← 반복 구간 머리글
 * 2~3행: [입력] | [입력 숫자]   ← 반복 구간 '품목'
 * 4행: '합계'   | =SUM(B3:B4)
 */
function requestForm(): Sheet {
  let s = createSheet(5, 2);
  s = setCellValue(s, 0, 0, '거래처');
  s = input(s, 0, 1);
  s = setCellValue(s, 1, 0, '품명');
  s = setCellValue(s, 1, 1, '수량');
  for (const r of [2, 3]) {
    s = input(s, r, 0);
    s = input(s, r, 1, 'number');
  }
  s = setCellValue(s, 4, 0, '합계');
  s = setCellValue(s, 4, 1, '=SUM(B3:B4)');
  return setRepeatSection(s, 2, 3, '품목');
}

/**
 * 발주서(받는 쪽) — 모양·글자 꾸밈이 다르다
 * 0행: '발주번호' | [입력, 이름 'poNo']
 * 1행: '거래처 :' | [입력]
 * 2행: '수 량'    | '품 명(규격)'   ← 머리글(열 순서도 다름)
 * 3행: [입력 숫자]| [입력]          ← 반복 구간(한 줄)
 */
function orderForm(): Sheet {
  let s = createSheet(4, 2);
  s = setCellValue(s, 0, 0, '발주번호');
  s = input(s, 0, 1);
  s = setCellName(s, 0, 1, 'poNo');
  s = setCellValue(s, 1, 0, '거래처 :');
  s = input(s, 1, 1);
  s = setCellValue(s, 2, 0, '수 량');
  s = setCellValue(s, 2, 1, '품 명(규격)');
  s = input(s, 3, 0, 'number');
  s = input(s, 3, 1);
  return setRepeatSection(s, 3, 3, '품목');
}

test('라벨 맞추는 글자 — 빈칸·괄호 기호·앞뒤 :·* 를 뺀다. 글자가 없으면 빈 값', () => {
  assert.equal(normalizeLabel('금액(VAT 포함)'), '금액VAT포함');
  assert.equal(normalizeLabel(' 품 명 : '), '품명');
  assert.equal(normalizeLabel('* 성명 *'), '성명');
  assert.equal(normalizeLabel('[비고]'), '비고');
  assert.equal(normalizeLabel('거래처：'), '거래처');
  assert.equal(normalizeLabel('~'), '');
  assert.equal(normalizeLabel('  '), '');
});

test('칸 옆 글자 — 같은 줄 왼쪽, 없으면 위쪽. 반복 구간 안 칸은 열 머리글', () => {
  const s = requestForm();
  assert.equal(cellLabel(s, 0, 1), '거래처');
  const sec = repeatSections(s)[0];
  assert.equal(cellLabel(s, 3, 1, sec), '수량'); // 왼쪽 입력 칸 값이 아니라 머리글
  assert.equal(cellLabel(s, 2, 0, sec), '품명');
});

test('칸 옆 글자 — 기안자가 쓴 값·계산 결과·숫자는 라벨이 되지 않는다', () => {
  let s = createSheet(2, 3);
  s = setCellValue(s, 0, 0, '성명');
  s = input(s, 0, 1);
  s = input(s, 0, 2);
  s = setCellValue(s, 1, 0, '1');
  s = input(s, 1, 1);
  const filled = applyValues(s, { [cellKey(0, s.cols[1])]: '홍길동' }, { recalc: true });
  assert.equal(cellLabel(filled, 0, 2), ''); // '홍길동'(입력 칸)에서 멈춤 — 더 먼 '성명'은 그 칸의 라벨
  assert.equal(cellLabel(filled, 1, 1), ''); // '1'은 라벨이 아님, 위는 입력 칸
});

test('칸 옆 글자 — 왼쪽에 입력·불러오기 칸이 끼면 멈춘다(먼 라벨을 집지 않음)', () => {
  // [기안자][불러오기 칸][빈칸][입력]
  let s = createSheet(1, 4);
  s = setCellValue(s, 0, 0, '기안자');
  s = setCellMeta(s, APPROVAL_NS.bind, 0, 1, 'drafter');
  s = input(s, 0, 3);
  assert.equal(cellLabel(s, 0, 3), '');
  // [수량][입력][입력] — 첫 칸만 '수량', 둘째는 라벨 없음 → '수량'이 하나라 맞춰진다
  let q = createSheet(1, 3);
  q = setCellValue(q, 0, 0, '수량');
  q = input(q, 0, 1);
  q = input(q, 0, 2);
  assert.equal(cellLabel(q, 0, 1), '수량');
  assert.equal(cellLabel(q, 0, 2), '');
  assert.deepEqual(collectLabeled(applyValues(q, { [cellKey(0, q.cols[1])]: '5' }, { recalc: true })), { [labelKeyOf('수량')]: '5' });
  // 수식 칸·이름 붙은 칸에서도 멈춘다
  let f = createSheet(1, 3);
  f = setCellValue(f, 0, 0, '합계');
  f = setCellValue(f, 0, 1, '=1+1');
  f = input(f, 0, 2);
  assert.equal(cellLabel(f, 0, 2), '');
  let n = createSheet(1, 3);
  n = setCellValue(n, 0, 0, '거래처');
  n = setCellName(n, 0, 1, 'vendor');
  n = input(n, 0, 2);
  assert.equal(cellLabel(n, 0, 2), '');
});

test('칸 옆 글자 — 왼쪽이 막히면 위 머리글(표 모양). 위쪽은 3줄까지, 넓은 제목은 라벨이 아니다', () => {
  // 0행: ''  | '품명' | '수량'
  // 1행: '1' | [입력] | [입력]
  let t = createSheet(2, 3);
  t = setCellValue(t, 0, 1, '품명');
  t = setCellValue(t, 0, 2, '수량');
  t = setCellValue(t, 1, 0, '1');
  t = input(t, 1, 1);
  t = input(t, 1, 2);
  assert.equal(cellLabel(t, 1, 1), '품명');
  assert.equal(cellLabel(t, 1, 2), '수량'); // 왼쪽 입력 칸에서 멈추고 위를 본다
  // 0행: '비고' / 1~3행 빈칸 / 4행: [입력] — 4줄 위라 라벨 아님, 3줄 위면 라벨
  let far = createSheet(5, 1);
  far = setCellValue(far, 0, 0, '비고');
  far = input(far, 4, 0);
  assert.equal(cellLabel(far, 4, 0), '');
  assert.equal(cellLabel(input(far, 3, 0), 3, 0), '비고');
  // 0행: '발 주 서'(4칸 병합 제목) / 1행: [입력] — 제목은 라벨이 아니다
  let title = createSheet(2, 4);
  title = setCellValue(title, 0, 0, '발 주 서');
  title = mergeRange(title, { r1: 0, r2: 0, c1: 0, c2: 3 });
  title = input(title, 1, 0);
  assert.equal(cellLabel(title, 1, 0), '');
  // 같은 너비로 병합된 머리글은 라벨이다(넓은 내용 칸 위 '내 용')
  let body = createSheet(2, 4);
  body = setCellValue(body, 0, 0, '내 용');
  body = mergeRange(body, { r1: 0, r2: 0, c1: 0, c2: 3 });
  body = mergeRange(body, { r1: 1, r2: 1, c1: 0, c2: 3 });
  body = input(body, 1, 0);
  assert.equal(cellLabel(body, 1, 0), '내 용');
  // 위에 입력 칸이 있으면 멈춘다
  let up = createSheet(3, 1);
  up = setCellValue(up, 0, 0, '성명');
  up = input(up, 1, 0);
  up = input(up, 2, 0);
  assert.equal(cellLabel(up, 2, 0), '');
});

test('라벨 값 모으기(원본) — 한 칸은 값, 반복 구간 열은 목록, 계산 칸은 없음', () => {
  const tpl = requestForm();
  const [a, b] = tpl.cols;
  const s = applyValues(
    tpl,
    { [cellKey(0, b)]: '에이스', [cellKey(2, a)]: '태블릿', [cellKey(2, b)]: '3', [cellKey(3, a)]: '설비', [cellKey(3, b)]: '1' },
    { recalc: true }
  );
  assert.deepEqual(collectLabeled(s), {
    [labelKeyOf('거래처')]: '에이스',
    [labelKeyOf('품명')]: ['태블릿', '설비'],
    [labelKeyOf('수량')]: ['3', '1'],
  });
});

test('가져오기 — 칸 이름 없는 칸을 라벨로 채우고(꾸밈 달라도), 반복 구간 행을 늘린다. 확인 창은 서식에 적힌 라벨', () => {
  const src = {
    [labelKeyOf('거래처')]: '에이스메디칼',
    [labelKeyOf('품명규격')]: ['태블릿', '설비 I/F'],
    [labelKeyOf('수량')]: ['14', '1'],
    poNo: 'PO-1',
  };
  const tpl = orderForm();
  const [a, b] = tpl.cols;
  const id = repeatSections(tpl)[0].id;
  const res = importRelated(tpl, {}, {}, {}, src);
  assert.deepEqual(res.extras, { [id]: 1 });
  assert.equal(res.values[cellKey(0, b)], 'PO-1'); // 이름으로
  assert.equal(res.values[cellKey(1, b)], '에이스메디칼');
  assert.equal(res.values[cellKey(3, a)], '14');
  assert.equal(res.values[cellKey(4, b)], '설비 I/F');
  assert.deepEqual([...res.captions].sort(), ['거래처 :', '발주번호', '수 량', '품 명(규격)'].sort());
});

test('가져오기 — 잠깐 붙인 라벨 이름은 틀·문서 시트·__named 에 남지 않는다', () => {
  const tpl = orderForm();
  const before = JSON.stringify(tpl);
  const res = importRelated(tpl, {}, {}, {}, { [labelKeyOf('거래처')]: '에이스' });
  assert.equal(JSON.stringify(tpl), before);
  const s = sheetWith(tpl, res);
  assert.deepEqual(Object.values(s.cellMeta[APPROVAL_NS.name] ?? {}), ['poNo']);
  assert.deepEqual(Object.keys(collectNamed(s)), ['poNo']);
});

test('가져오기 — 이름 붙은 칸은 이름으로만 채운다(라벨이 같아도 다시 채우지 않음)', () => {
  let tpl = createSheet(1, 2);
  tpl = setCellValue(tpl, 0, 0, '거래처');
  tpl = input(tpl, 0, 1);
  tpl = setCellName(tpl, 0, 1, 'vendor');
  const res = importRelated(tpl, {}, {}, {}, { vendor: '이름 값', [labelKeyOf('거래처')]: '라벨 값' });
  assert.equal(res.values[cellKey(0, tpl.cols[1])], '이름 값');
  assert.deepEqual(res.filled, ['vendor']);
});

test('가져오기 — 이름 붙은 칸이라도 원본에 그 이름이 없으면 라벨로 채운다(한 번만)', () => {
  let tpl = createSheet(2, 2);
  tpl = setCellValue(tpl, 0, 0, '거래처');
  tpl = input(tpl, 0, 1);
  tpl = setCellName(tpl, 0, 1, 'vendor'); // 규칙이 붙인 이름 같은 것 — 원본엔 없음
  tpl = setCellValue(tpl, 1, 0, '연봉');
  tpl = input(tpl, 1, 1);
  tpl = setCellName(tpl, 1, 1, 'pay');
  tpl = setCellMeta(tpl, APPROVAL_NS.secret, 1, 1, true);
  const b = tpl.cols[1];
  const res = importRelated(tpl, {}, {}, {}, { [labelKeyOf('거래처')]: '라벨 값', [labelKeyOf('연봉')]: '1억' });
  assert.equal(res.values[cellKey(0, b)], '라벨 값');
  assert.deepEqual(res.filled, [labelKeyOf('거래처')]); // 비공개 칸은 라벨로 채우지 않음
  assert.deepEqual(res.captions, ['거래처']);
  // 잠깐 바꾼 이름은 틀에 남지 않는다
  assert.deepEqual(Object.values(sheetWith(tpl, res).cellMeta[APPROVAL_NS.name] ?? {}).sort(), ['pay', 'vendor']);
});

test('가져오기 — 이름 붙은 반복 구간 열도 이름이 원본에 없으면 라벨(머리글)로 채운다', () => {
  let tpl = createSheet(2, 1);
  tpl = setCellValue(tpl, 0, 0, '품명');
  tpl = input(tpl, 1, 0);
  tpl = setCellName(tpl, 1, 0, 'item');
  tpl = setRepeatSection(tpl, 1, 1, '품목');
  const a = tpl.cols[0];
  const res = importRelated(tpl, {}, {}, {}, { [labelKeyOf('품명')]: ['가', '나'] });
  assert.equal(res.values[cellKey(1, a)], '가');
  assert.equal(res.values[cellKey(2, a)], '나');
  assert.deepEqual(res.filled, [labelKeyOf('품명')]);
  // 이름이 원본에 있으면 이름으로만
  assert.deepEqual(importRelated(tpl, {}, {}, {}, { item: ['x'], [labelKeyOf('품명')]: ['가', '나'] }).filled, ['item']);
});

test('라벨이 서식에 둘 이상이면 어느 쪽에서도 맞추지 않는다', () => {
  let s = createSheet(2, 2);
  for (const r of [0, 1]) {
    s = setCellValue(s, r, 0, '비고');
    s = input(s, r, 1);
  }
  const filled = applyValues(s, { [cellKey(0, s.cols[1])]: 'x' }, { recalc: true });
  assert.deepEqual(collectLabeled(filled), {});
  assert.deepEqual(importRelated(s, {}, {}, {}, { [labelKeyOf('비고')]: 'y' }).filled, []);
  assert.equal(canImportRelated(s), false);
});

test('비공개 칸은 라벨 값으로 남기지도 채우지도 않는다. 잠금 칸은 채우지 않는다', () => {
  let s = createSheet(3, 2);
  s = setCellValue(s, 0, 0, '연봉');
  s = input(s, 0, 1);
  s = setCellMeta(s, APPROVAL_NS.secret, 0, 1, true);
  s = setCellValue(s, 1, 0, '부서');
  s = input(s, 1, 1);
  s = setCellMeta(s, APPROVAL_NS.lock, 1, 1, true);
  s = setCellValue(s, 2, 0, '사유');
  s = input(s, 2, 1);
  const [, b] = s.cols;
  const filled = applyValues(s, { [cellKey(0, b)]: '1억', [cellKey(1, b)]: '개발', [cellKey(2, b)]: '출장' }, { recalc: true });
  assert.deepEqual(collectLabeled(filled), { [labelKeyOf('부서')]: '개발', [labelKeyOf('사유')]: '출장' });
  const res = importRelated(s, {}, {}, {}, { [labelKeyOf('연봉')]: '2억', [labelKeyOf('부서')]: '영업', [labelKeyOf('사유')]: '교육' });
  assert.deepEqual(res.filled, [labelKeyOf('사유')]);
  assert.equal(res.values[cellKey(0, b)], undefined);
});

test('가져오기 단추 — 이름이 없어도 라벨로 맞출 칸이 있으면 보인다', () => {
  assert.equal(hasImportableNames(requestForm()), false);
  assert.equal(canImportRelated(requestForm()), true);
  assert.equal(canImportRelated(createSheet(2, 2)), false);
});

test('예전 시트 문서 — 틀과 저장 값으로 라벨 값을 만든다(줄 수 포함)', () => {
  const tpl = requestForm();
  const [a] = tpl.cols;
  const id = repeatSections(tpl)[0].id;
  const fv = {
    [SHEET_VALUES_KEY]: JSON.stringify({ [cellKey(2, a)]: '가', [cellKey(3, a)]: '나', [cellKey(4, a)]: '다' }),
    [SHEET_ROWS_KEY]: JSON.stringify({ [id]: 1 }),
  };
  assert.deepEqual(labeledFromDoc(tpl, fv)[labelKeyOf('품명')], ['가', '나', '다']);
});

test('옛 서식 문서 — 필드 라벨로 라벨 값. 비공개·겹치는 라벨·표는 뺀다', () => {
  const fields = [
    { key: 'vendor', label: '거래처 :', type: '텍스트' },
    { key: 'pay', label: '연봉', type: '금액', isSecret: true },
    { key: 'period', label: '기간', type: '기간' },
    { key: 'n1', label: '비고', type: '텍스트' },
    { key: 'n2', label: '비 고', type: '장문' },
    { key: 'items', label: '품목', type: '표' },
  ];
  const fv = { vendor: '에이스', pay: '1억', period: '2026-01-01', period__end: '2026-01-03', n1: 'a', n2: 'b', items: '[]' };
  assert.deepEqual(labeledFromLegacy(fields, fv), {
    [labelKeyOf('거래처')]: '에이스',
    [labelKeyOf('기간')]: '2026-01-01 ~ 2026-01-03',
  });
});
