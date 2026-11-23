import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staleDocKeys, staleValueKeys } from './staleValues';

const NEW_FIELDS = [{ key: 'field_ciad' }, { key: 'field_chart' }];

test('서식 칸이 통째로 바뀌기 전에 낸 문서 — 옛 칸의 키를 돌려준다', () => {
  assert.deepEqual(staleValueKeys(NEW_FIELDS, { body: '법인카드 사용내역을 보냅니다.' }), ['body']);
  assert.deepEqual(staleDocKeys(NEW_FIELDS, { body: '본문', fieldValues: {} }), ['body']);
});

test('지금 서식의 칸에 값이 하나라도 있으면 옛 모양이 아니다', () => {
  assert.deepEqual(staleValueKeys(NEW_FIELDS, { body: '옛 글', field_chart: '{"cols":[]}' }), []);
  // 칸에 딸린 값(기간 끝 날짜)만 있어도
  assert.deepEqual(staleValueKeys(NEW_FIELDS, { body: '옛 글', field_ciad__end: '2026-11-30' }), []);
});

test('값이 없거나 안쪽 기록뿐이면 옛 모양이 아니다', () => {
  assert.deepEqual(staleValueKeys(NEW_FIELDS, {}), []);
  assert.deepEqual(staleValueKeys(NEW_FIELDS, { body: '  ', __labeled: '{}' }), []);
  assert.deepEqual(staleDocKeys(NEW_FIELDS, { body: '', fieldValues: null }), []);
});

test('서식을 모르면(불러오는 중) 판단하지 않는다', () => {
  assert.deepEqual(staleValueKeys(undefined, { body: '글' }), []);
  assert.deepEqual(staleValueKeys([], { body: '글' }), []);
});

test('본문 칸이 있는 서식의 문서는 그대로', () => {
  assert.deepEqual(staleDocKeys([{ key: 'body' }], { body: '글', fieldValues: { body: '글', startTime: '09:00' } }), []);
});

test('시트 서식으로 쓴 문서는 옛 모양으로 보지 않는다', () => {
  assert.deepEqual(staleDocKeys(NEW_FIELDS, { body: '', fieldValues: { __formVersion: 'expense@v3', amount: '12000', period: '2026-11-01' } }), []);
});
