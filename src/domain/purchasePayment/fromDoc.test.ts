import assert from 'node:assert/strict';
import test from 'node:test';
import { isLedgerPurchaseOrder, paymentsFromDoc, ratePercent } from './fromDoc';

const NOW = '2026-11-13T00:00:00.000Z';
/** 개발 DB 시험 문서(AP-261113-001)에 실제로 저장된 모양 */
const NAMED = {
  poVendor: '(주)미르시스템',
  poBizType: '부처협업형',
  poClient: '새솔테크',
  poSummary: ['데이터 수집 시스템', '현장 단말기'],
  poSupply: '42000000',
  poVat: '4200000',
  poTerm: ['선금', '잔금'],
  poTermRate: ['0.5', '0.5'],
};
const doc = (named: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  id: 'AP-1',
  docNo: 'AP-261113-001',
  docType: '발주',
  status: '완료',
  fieldValues: { __link: '발주', __named: JSON.stringify(named) },
  ...over,
});

test('발주서 → 지급 줄 — 지급 조건 줄마다 한 줄, 금액은 공급가액 × 비율', () => {
  const rows = paymentsFromDoc(doc(NAMED), NOW);
  assert.deepEqual(rows.map((r) => [r.id, r.seq, r.term, r.rate, r.supply]), [
    ['AP-1__1', 1, '선금', 50, 21_000_000],
    ['AP-1__2', 2, '잔금', 50, 21_000_000],
  ]);
  assert.equal(rows[0].client, '새솔테크');
  assert.equal(rows[0].vendor, '(주)미르시스템');
  assert.equal(rows[0].bizType, '부처협업형');
  assert.equal(rows[0].docNo, 'AP-261113-001');
  assert.deepEqual(rows[0].items, ['데이터 수집 시스템', '현장 단말기']);
  assert.equal(rows[0].planPayDate, '');
  assert.equal(rows[0].payDate, '');
});

test('지급 조건을 안 적은 발주서 — 한 번에 지급(일시 100%)', () => {
  const { poTerm: _t, poTermRate: _r, ...rest } = NAMED;
  const rows = paymentsFromDoc(doc(rest), NOW);
  assert.deepEqual(rows.map((r) => [r.term, r.rate, r.supply]), [['일시', 100, 42_000_000]]);
});

test('줄 금액·예정일을 적었으면 그 값, 안 쓴 줄은 뺀다', () => {
  const rows = paymentsFromDoc(
    doc({
      ...NAMED,
      poTerm: ['선금', '중도금', ''],
      poTermRate: ['30%', '0.7', ''],
      poTermSupply: ['12,000,000', '', ''],
      poTermTaxDate: ['2026-11-20', '미정', ''],
      poTermPayDate: ['2026-11-30', '', ''],
    }),
    NOW
  );
  assert.deepEqual(rows.map((r) => [r.term, r.rate, r.supply, r.planTaxDate, r.planPayDate]), [
    ['선금', 30, 12_000_000, '2026-11-20', '2026-11-30'],
    ['중도금', 70, 29_400_000, '', ''],
  ]);
});

test('대장에 올릴 문서 — 결재가 끝난 발주 연동 시트 문서만', () => {
  assert.ok(isLedgerPurchaseOrder(doc(NAMED)));
  assert.deepEqual(paymentsFromDoc(doc(NAMED, { status: '진행중' }), NOW), []);
  assert.deepEqual(paymentsFromDoc(doc(NAMED, { status: '임시저장' }), NOW), []);
  // 옛 양식 발주서(이름 붙은 값 없음)·다른 연동
  assert.deepEqual(paymentsFromDoc({ id: 'X', docType: '발주', status: '완료', fieldValues: { field_1: '프로젝트' } }, NOW), []);
  assert.deepEqual(paymentsFromDoc(doc(NAMED, { docType: '휴가', fieldValues: { __link: '휴가', __named: '{}' } }), NOW), []);
});

test('지급 비율 — 0.5·50%·50 모두 50', () => {
  assert.equal(ratePercent('0.5'), 50);
  assert.equal(ratePercent('50%'), 50);
  assert.equal(ratePercent('50'), 50);
  assert.equal(ratePercent('0.333'), 33.3);
  assert.equal(ratePercent('1'), 100);
  assert.equal(ratePercent(''), 0);
  assert.equal(ratePercent(undefined), 0);
});

// ── 검토에서 찾은 것(줄이 빠지거나 합이 어긋나던 경우) ──

test('구분을 비운 줄도 빠지지 않는다 — 가장 긴 열만큼 줄을 센다', () => {
  // 열마다 끝의 빈 값이 잘려 저장된다 — 구분 2줄, 비율 3줄
  const rows = paymentsFromDoc(doc({ ...NAMED, poTerm: ['선금', '잔금'], poTermRate: ['0.3', '0.3', '0.4'] }), NOW);
  assert.deepEqual(rows.map((r) => [r.seq, r.term, r.rate, r.supply]), [
    [1, '선금', 30, 12_600_000],
    [2, '잔금', 30, 12_600_000],
    [3, '', 40, 16_800_000],
  ]);
  assert.equal(rows.reduce((a, r) => a + r.supply, 0), 42_000_000);
});

test('지급 구분 칸에 이름을 안 붙인 서식 — 비율·금액만으로도 줄이 된다', () => {
  const { poTerm: _t, ...rest } = NAMED;
  const rows = paymentsFromDoc(doc({ ...rest, poTermRate: ['0.4', '0.6'] }), NOW);
  assert.deepEqual(rows.map((r) => [r.term, r.rate, r.supply]), [['', 40, 16_800_000], ['', 60, 25_200_000]]);
});

test('1/3 씩 나눠도 줄 합이 공급가액과 같다 — 마지막 줄이 나머지를 받는다', () => {
  const third = String(1 / 3);
  const rows = paymentsFromDoc(doc({ ...NAMED, poSupply: '10000000', poTerm: ['선금', '중도금', '잔금'], poTermRate: [third, third, third] }), NOW);
  assert.deepEqual(rows.map((r) => r.supply), [3_333_333, 3_333_333, 3_333_334]);
  assert.deepEqual(rows.map((r) => r.rate), [33.33, 33.33, 33.33]);
});

test('비율 합이 100% 가 아니면 맞추지 않는다(적힌 대로)', () => {
  const rows = paymentsFromDoc(doc({ ...NAMED, poTermRate: ['0.3', '0.3'] }), NOW);
  assert.deepEqual(rows.map((r) => r.supply), [12_600_000, 12_600_000]);
});

test('저장 칸보다 긴 글자는 잘라 넣고, 틀린 숫자·날짜는 버린다', () => {
  const long = '가'.repeat(300);
  const rows = paymentsFromDoc(
    doc({ ...NAMED, poClient: long, poVendor: long, poBizType: long, poSummary: [long], poTerm: [long], poTermRate: ['-0.5'], poTermSupply: ['1e400'], poTermTaxDate: ['2026-13-45'] }),
    NOW
  );
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].client.length, rows[0].vendor.length, rows[0].bizType.length, rows[0].items[0].length, rows[0].term.length], [200, 200, 100, 200, 50]);
  assert.equal(rows[0].rate, 0);
  assert.equal(rows[0].supply, 0);
  assert.equal(rows[0].planTaxDate, '');
  assert.ok(Number.isSafeInteger(rows[0].supply));
});
