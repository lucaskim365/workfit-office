import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autoNumberChannel,
  autoNumberConfigSchema,
  DEFAULT_AUTO_NUMBER,
  formatAutoNumber,
  isFieldVisible,
  type AutoNumberConfig,
} from './autoNumber';

const D = new Date(2026, 10, 1); // 2026-11-01 (현지)

const cfg = (patch: Partial<AutoNumberConfig>): AutoNumberConfig => autoNumberConfigSchema.parse(patch);

test('자동번호 모양 — 접두어·날짜·순번, 빈 부분은 뺀다', () => {
  assert.equal(formatAutoNumber(cfg({ prefix: 'PO', datePart: 'YYYY', digits: 4 }), D, 7), 'PO-2026-0007');
  assert.equal(formatAutoNumber(cfg({ datePart: 'YYMMDD', digits: 3, reset: 'DAY' }), D, 12), '261101-012');
  assert.equal(formatAutoNumber(cfg({ prefix: '견적', datePart: 'NONE', digits: 5, reset: 'NEVER' }), D, 1), '견적-00001');
});

test('공문 기본 모양 — 20261101 - 01호', () => {
  assert.equal(formatAutoNumber(DEFAULT_AUTO_NUMBER, D, 1), '20261101 - 01호');
  assert.equal(formatAutoNumber(DEFAULT_AUTO_NUMBER, D, 12), '20261101 - 12호');
  assert.equal(DEFAULT_AUTO_NUMBER.reset, 'DAY');
});

test('자동번호 채널 — 영숫자 36자 이내, 초기화 주기 묶음, 모양을 바꾸면 새 채널', () => {
  const base = cfg({ prefix: 'PO', datePart: 'YYYY', digits: 4, reset: 'MONTH' });
  const ch = autoNumberChannel('발주서', 'poNo', base, D);
  assert.match(ch, /^AN-[0-9a-z]+-202611$/);
  assert.ok(ch.length <= 36);
  assert.equal(autoNumberChannel('발주서', 'poNo', base, new Date(2026, 10, 30)), ch);
  assert.notEqual(autoNumberChannel('발주서', 'poNo', base, new Date(2026, 11, 1)), ch);
  assert.notEqual(autoNumberChannel('발주서', 'poNo', { ...base, prefix: 'PR' }, D), ch);
  assert.notEqual(autoNumberChannel('견적서', 'poNo', base, D), ch);
});

test('자동번호 설정 확인 — 접두어에 기호(-)는 쓸 수 없다', () => {
  assert.equal(autoNumberConfigSchema.safeParse({ prefix: 'P-O' }).success, false);
  assert.deepEqual(autoNumberConfigSchema.parse({}), {
    prefix: '', datePart: 'YYYY', digits: 4, reset: 'YEAR', separator: '-', suffix: '', asDocNo: false,
  });
});

test('숨은 칸(visibleIf) 판단', () => {
  assert.equal(isFieldVisible(null, {}), true);
  assert.equal(isFieldVisible('kind:발주', { kind: '발주' }), true);
  assert.equal(isFieldVisible('kind:발주', { kind: '견적' }), false);
});
