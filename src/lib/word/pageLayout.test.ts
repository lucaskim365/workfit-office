import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutPages, type LayoutItem } from './pageLayout';

// 한 장 100px(본문 80 + 아래위 여백·틈 20), 줄 높이 10
const PITCH = 100;
const CONTENT = 80;
const para = (pos: number, top: number, count: number, extra: Partial<LayoutItem> = {}): LayoutItem => ({
  pos,
  kind: 'pad',
  top,
  bottom: top + count * 10,
  lines: Array.from({ length: count }, (_, i) => ({ top: top + i * 10, bottom: top + i * 10 + 10 })),
  lineStart: (i) => pos + 1 + i * 5,
  ...extra,
});

test('나눌 수 없는 덩어리가 장 끝에 걸리면 통째로 다음 장 첫머리로', () => {
  const r = layoutPages([{ pos: 0, kind: 'row', top: 70, bottom: 90 }], PITCH, CONTENT);
  assert.deepEqual(r.pushes, [{ pos: 0, kind: 'row', size: 30 }]);
  assert.equal(r.pages, 2);
});

test('문단은 줄 단위로 — 장 끝에 걸린 줄부터 다음 장으로', () => {
  const r = layoutPages([para(0, 40, 6)], PITCH, CONTENT);
  // 40·50·60·70 줄은 첫 장, 80 줄(다섯째)부터 다음 장
  assert.deepEqual(r.pushes, [{ pos: 21, kind: 'line', size: 20 }]);
  assert.equal(r.pages, 2);
});

test('외톨이 줄 방지 — 마지막 한 줄만 넘어가면 한 줄 더 같이 넘긴다', () => {
  const r = layoutPages([para(0, 30, 6)], PITCH, CONTENT);
  // 30~70 다섯 줄이 들어가고 80 줄 하나만 넘칠 자리 → 70 줄부터 두 줄을 넘긴다
  assert.deepEqual(r.pushes, [{ pos: 21, kind: 'line', size: 30 }]);
});

test('외톨이 줄 방지 — 첫 줄 하나만 앞 장에 남으면 문단을 통째로', () => {
  const r = layoutPages([para(0, 70, 4)], PITCH, CONTENT);
  assert.deepEqual(r.pushes, [{ pos: 0, kind: 'pad', size: 30 }]);
});

test('한 장보다 긴 문단은 여러 장에 걸쳐 나눈다', () => {
  const r = layoutPages([para(0, 0, 20)], PITCH, CONTENT);
  assert.deepEqual(
    r.pushes.map((p) => p.kind),
    ['line', 'line'],
  );
  assert.equal(r.pages, 3);
});

test('제목은 다음 문단 첫 줄들과 같은 장에 — 못 들어가면 제목도 같이 넘긴다', () => {
  const heading: LayoutItem = { pos: 0, kind: 'pad', top: 55, bottom: 65, keepWithNext: true };
  const r = layoutPages([heading, para(10, 65, 4)], PITCH, CONTENT);
  // 다음 문단 첫 두 줄(65~85)이 80 을 넘으므로 제목부터 다음 장
  assert.deepEqual(r.pushes[0], { pos: 0, kind: 'pad', size: 45 });
  assert.equal(r.pushes.length, 1);
});

test('줄 두 개 합이 한 장보다 커도(큰 그림 두 줄) 끝난다 — 이미 장 첫머리인 줄은 밀지 않는다', () => {
  const big: LayoutItem = { pos: 0, kind: 'pad', top: 0, bottom: 100, lines: [{ top: 0, bottom: 10 }, { top: 10, bottom: 100 }], lineStart: (i) => i + 1 };
  const r = layoutPages([big], PITCH, CONTENT);
  assert.ok(r.pushes.length <= 2);
});

test('장 첫머리 제목은 다음 덩어리가 같이 안 들어가도 밀지 않는다(빈 장을 만들지 않게)', () => {
  const heading: LayoutItem = { pos: 0, kind: 'pad', top: 0, bottom: 10, keepWithNext: true };
  const r = layoutPages([heading, { pos: 5, kind: 'row', top: 10, bottom: 85 }], PITCH, CONTENT);
  assert.deepEqual(r.pushes, [{ pos: 5, kind: 'row', size: 90 }]);
  assert.equal(r.pages, 2);
});

test('제목 뒤 짧은 문단(3줄)이 통째로 넘어가면 제목도 같이', () => {
  // 문단 셋째 줄만 넘칠 자리 → 외톨이 줄 방지로 문단이 통째로 넘어가므로 제목도 같이
  const heading: LayoutItem = { pos: 0, kind: 'pad', top: 50, bottom: 60, keepWithNext: true };
  const r = layoutPages([heading, para(10, 60, 3)], PITCH, CONTENT);
  assert.deepEqual(r.pushes, [{ pos: 0, kind: 'pad', size: 50 }]);
});

test('제목이 이어지면(제목1→제목2→문단) 같이 넘긴다', () => {
  const h = (pos: number, top: number): LayoutItem => ({ pos, kind: 'pad', top, bottom: top + 10, keepWithNext: true });
  const r = layoutPages([h(0, 50), h(5, 60), para(10, 70, 4)], PITCH, CONTENT);
  assert.deepEqual(r.pushes[0], { pos: 0, kind: 'pad', size: 50 });
  assert.equal(r.pushes.length, 1);
});

test('틈(여백)에서 시작하는 덩어리도 다음 장 첫머리로', () => {
  const r = layoutPages([{ pos: 0, kind: 'pad', top: 85, bottom: 95 }], PITCH, CONTENT);
  assert.deepEqual(r.pushes, [{ pos: 0, kind: 'pad', size: 15 }]);
});
