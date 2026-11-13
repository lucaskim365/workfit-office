import assert from 'node:assert/strict';
import test from 'node:test';
import { MOCK_PURCHASE_PAYMENTS as ROWS } from './purchaseMock';
import { NO_FILTERS, activeFilters, clearFilter, matchFilters, setFilterOptions, withDateFilter, withSetFilter } from './purchaseFilter';

const pass = (f: typeof NO_FILTERS) => ROWS.filter((r) => matchFilters(r, f));

test('필터가 없으면 모든 줄', () => {
  assert.equal(pass(NO_FILTERS).length, ROWS.length);
  assert.deepEqual(activeFilters(NO_FILTERS), []);
});

test('값 필터 — 고른 값 중 하나와 같은 줄만, 열끼리는 모두 맞아야', () => {
  const byVendor = withSetFilter(NO_FILTERS, 'vendor', ['푸른자동화']);
  assert.ok(pass(byVendor).length > 0);
  assert.ok(pass(byVendor).every((r) => r.vendor === '푸른자동화'));
  const both = withSetFilter(byVendor, 'term', ['선금', '잔금']);
  assert.ok(pass(both).every((r) => r.vendor === '푸른자동화' && r.term !== '중도금'));
  assert.equal(pass(both).length, pass(byVendor).length - 1);
});

test('값 필터 — 매출 부가세 수금 O/X, 지출결의서는 이름표로', () => {
  assert.ok(pass(withSetFilter(NO_FILTERS, 'salesVat', ['X'])).every((r) => !r.salesVatCollected));
  assert.deepEqual(setFilterOptions(ROWS, 'salesVat').map((o) => o.value), ['O', 'X']);
  assert.equal(setFilterOptions(ROWS, 'expense')[0].label, '미작성');
  assert.deepEqual(setFilterOptions(ROWS, 'term').map((o) => o.value), ['선금', '중도금', '잔금', '일시']);
});

test('날짜 필터 — 비어 있음·입력됨', () => {
  const unpaid = pass(withDateFilter(NO_FILTERS, 'pay', { from: '', to: '', state: 'empty' }));
  assert.ok(unpaid.length > 0 && unpaid.every((r) => !r.payDate));
  const paid = pass(withDateFilter(NO_FILTERS, 'pay', { from: '', to: '', state: 'filled' }));
  assert.equal(paid.length + unpaid.length, ROWS.length);
});

test('날짜 필터 — 기간(날짜 없는 줄은 빠짐), 구축일은 기간이 겹치면', () => {
  const oct = pass(withDateFilter(NO_FILTERS, 'tax', { from: '2026-10-22', to: '2026-10-31', state: 'any' }));
  assert.deepEqual(oct.map((r) => r.taxDate).sort(), ['2026-10-22', '2026-10-27']);
  // 구축 11-03~11-21 / 11-10~11-14 — 11-20 하루만 골라도 앞의 것은 겹친다
  const build = pass(withDateFilter(NO_FILTERS, 'build', { from: '2026-11-20', to: '2026-11-20', state: 'any' }));
  assert.ok(build.length > 0 && build.every((r) => r.buildFrom === '2026-11-03'));
});

test('꼬리표와 풀기', () => {
  let f = withSetFilter(NO_FILTERS, 'expense', ['none', 'drafting', 'rejected']);
  f = withDateFilter(f, 'pay', { from: '', to: '', state: 'empty' });
  f = withDateFilter(f, 'planPay', { from: '2026-11-01', to: '', state: 'any' });
  assert.deepEqual(activeFilters(f).map((x) => x.text), ['지출결의서: 미작성 외 2', '(예정) 결제일: 2026-11-01 ~ 끝', '(확정) 결제일: 비어 있음']);
  assert.deepEqual(activeFilters(clearFilter(clearFilter(f, 'expense'), 'pay')).map((x) => x.key), ['planPay']);
});
