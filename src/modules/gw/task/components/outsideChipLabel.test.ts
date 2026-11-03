import assert from 'node:assert/strict';
import test from 'node:test';
import { outsideChipLabel } from './outsideChipLabel';

test('외근·출장 칩 — 제목(목적)만 보이고 행선지는 보이지 않는다', () => {
  assert.equal(outsideChipLabel({ category: 'TRIP', subType: '국내출장', purpose: 'OO사 납품 협의' }), '[출장] OO사 납품 협의');
  assert.equal(
    outsideChipLabel({ category: 'TRIP', subType: '국내출장', purpose: 'OO사 납품 협의', companionOwnerName: '홍채원' }),
    '[동행] OO사 납품 협의 · 홍채원',
  );
});

test('외근·출장 칩 — 제목이 없으면 세부 구분, 여러 줄 목적은 첫 줄만', () => {
  assert.equal(outsideChipLabel({ category: 'TRIP', subType: '국내출장' }), '[출장] 국내출장');
  assert.equal(outsideChipLabel({ category: 'OUTSIDE', subType: '종일 외근', purpose: '  ', companionOwnerName: '홍채원' }), '[동행] 외근 · 홍채원');
  assert.equal(outsideChipLabel({ category: 'OUTSIDE', subType: '종일 외근', purpose: '\n설비 점검\n세부 안건' }), '[외근] 설비 점검');
});
