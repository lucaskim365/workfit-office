import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyFields, liveSheetVersion, sheetApplied } from './sheetSwitch';

const legacy = { id: '휴가', fields: [{ key: 'period' }] };
const fresh = { id: '발주_시트', fields: [] };

test('시트 적용 — 기존 서식은 켜기 전까지 기존 양식, 처음부터 시트 서식은 바로 시트', () => {
  assert.equal(hasLegacyFields(legacy), true);
  assert.equal(hasLegacyFields(fresh), false);
  assert.equal(sheetApplied(legacy, new Map()), false);
  assert.equal(sheetApplied(fresh, new Map()), true);
  assert.equal(sheetApplied(legacy, new Map([['휴가', true]])), true);
  assert.equal(sheetApplied(fresh, new Map([['발주_시트', false]])), false, '꺼 두면 꺼짐');
});

test('기안에 쓸 시트 버전 — 적용된 서식의 최신 버전, 아니면 기존 양식(null)', () => {
  const latest = new Map([
    ['휴가', 3],
    ['발주_시트', 2],
  ]);
  assert.equal(liveSheetVersion(legacy, latest, new Map()), null, '붙이는 중');
  assert.equal(liveSheetVersion(legacy, latest, new Map([['휴가', true]])), 3);
  assert.equal(liveSheetVersion(fresh, latest, new Map()), 2);
  assert.equal(liveSheetVersion({ id: '기안', fields: [{}] }, latest, new Map([['기안', true]])), null, '시트 버전이 없으면 기존 양식');
});
