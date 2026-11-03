import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTagNameAvailable, resolveTag, selectableGeneralTags, reorderGeneralTags, WorkPlanTagError, type WorkPlanTag } from './tag';

const tag = (over: Partial<WorkPlanTag> = {}): WorkPlanTag => ({
  id: 'WT-0001', name: '보고', colorId: 'teal', order: 0, hidden: false, ...over,
});

test('고정 태그 이름과 같은 일반 태그는 만들 수 없다', () => {
  assert.throws(() => assertTagNameAvailable([], '회의'), (e) => e instanceof WorkPlanTagError && e.code === 'DUPLICATE');
});

test('숨긴 태그 이름은 다시 쓸 수 있다', () => {
  assert.doesNotThrow(() => assertTagNameAvailable([tag({ hidden: true })], '보고'));
  assert.throws(() => assertTagNameAvailable([tag()], ' 보고 '), (e) => e instanceof WorkPlanTagError && e.code === 'DUPLICATE');
});

test('수정 중인 자기 자신은 제외', () => {
  assert.doesNotThrow(() => assertTagNameAvailable([tag()], '보고', 'WT-0001'));
});

test('못 찾는 태그는 기타(slate)', () => {
  const r = resolveTag([], 'WT-9999');
  assert.equal(r.name, '기타');
  assert.equal(r.colorId, 'slate');
  assert.equal(r.unknown, true);
  assert.equal(r.fixed, false);
});

test('숨긴 태그도 이름은 보인다', () => {
  const r = resolveTag([tag({ hidden: true })], 'WT-0001');
  assert.equal(r.name, '보고');
  assert.equal(r.unknown, false);
  assert.equal(resolveTag([], 'MEETING').fixed, true);
});

test('선택 목록은 숨김 제외·순서대로', () => {
  const list = selectableGeneralTags([
    tag({ id: 'WT-0003', name: '나', order: 1 }),
    tag({ id: 'WT-0002', name: '가', order: 1 }),
    tag({ id: 'WT-0004', name: '숨', order: 0, hidden: true }),
    tag({ id: 'WT-0001', name: '다', order: 0 }),
  ]);
  assert.deepEqual(list.map((t) => t.id), ['WT-0001', 'WT-0002', 'WT-0003']);
});

test('순서 바꿈 — 이웃과 맞바꾸고 1..n으로 다시 매긴다', () => {
  const list = [tag({ id: 'WT-0001', order: 1 }), tag({ id: 'WT-0002', name: '교육', order: 5 })];
  assert.deepEqual(reorderGeneralTags(list, 'WT-0002', 'up'), [
    { id: 'WT-0002', order: 1 },
    { id: 'WT-0001', order: 2 },
  ]);
});

test('순서 바꿈 — order가 셋 이상 겹쳐도 겹치지 않게 푼다', () => {
  const list = [
    tag({ id: 'WT-0001', name: 'a', order: 0 }),
    tag({ id: 'WT-0002', name: 'b', order: 0 }),
    tag({ id: 'WT-0003', name: 'c', order: 1 }),
  ];
  const changes = reorderGeneralTags(list, 'WT-0002', 'up')!;
  const final = new Map(list.map((t) => [t.id, t.order]));
  for (const c of changes) final.set(c.id, c.order);
  assert.deepEqual([...final.entries()].sort((x, y) => x[1] - y[1]).map(([k]) => k), ['WT-0002', 'WT-0001', 'WT-0003']);
  assert.equal(new Set(final.values()).size, 3);
});

test('순서 바꿈 — 맨 끝이거나 없는 태그면 null', () => {
  const list = [tag({ id: 'WT-0001', order: 1 }), tag({ id: 'WT-0002', name: '교육', order: 2 })];
  assert.equal(reorderGeneralTags(list, 'WT-0001', 'up'), null);
  assert.equal(reorderGeneralTags(list, 'WT-0002', 'down'), null);
  assert.equal(reorderGeneralTags(list, 'WT-9999', 'up'), null);
});
