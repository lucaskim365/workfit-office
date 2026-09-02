import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WorkTaskTreeError,
  collectDescendants,
  descendantPrefix,
  isDescendantPath,
  joinPath,
  moveSubtree,
  nextSortOrder,
  pathLevel,
  rebuildPaths,
  segment,
  type TreeNode,
} from './path';

const T = (id: string, parentId: string | null, sortOrder: number, trackId: string | null = null, path?: string): TreeNode =>
  ({ id, parentId, sortOrder, trackId, path });

test('형제 순번은 4자리로 채운다', () => {
  assert.equal(segment(0), '0000');
  assert.equal(segment(3), '0003');
  assert.equal(segment(9999), '9999');
});

test('순번이 범위를 넘으면 거부한다', () => {
  assert.throws(() => segment(10_000), WorkTaskTreeError);
  assert.throws(() => segment(-1), WorkTaskTreeError);
});

test('대과업 경로는 마디 하나다', () => {
  assert.equal(joinPath(null, 2), '0002');
  assert.equal(joinPath('0002', 5), '0002.0005');
  assert.equal(pathLevel('0002.0005.0001'), 3);
});

test('하위 판정은 마디 경계를 지킨다', () => {
  assert.equal(isDescendantPath('0001.0002', '0001'), true);
  assert.equal(isDescendantPath('0001', '0001'), false, '자기 자신은 하위가 아니다');
  // 마디 경계를 안 지키면 형제를 하위로 잘못 잡는다.
  assert.equal(isDescendantPath('00010', '0001'), false);
  assert.equal(descendantPrefix('0001'), '0001.');
});

test('다음 형제 순번은 같은 부모·같은 트랙 안에서만 센다', () => {
  const nodes = [
    T('A', null, 0, 'TRK-0001'),
    T('B', null, 1, 'TRK-0001'),
    T('C', null, 7, 'TRK-0002'),
  ];
  assert.equal(nextSortOrder(nodes, 'TRK-0001', null), 2);
  assert.equal(nextSortOrder(nodes, 'TRK-0002', null), 8);
  assert.equal(nextSortOrder(nodes, null, null), 0, '비어 있으면 0');
});

test('경로는 parentId·sortOrder 에서 재계산된다', () => {
  const nodes = [
    T('A', null, 1),
    T('B', null, 0),
    T('A1', 'A', 0),
    T('A2', 'A', 1),
    T('A1a', 'A1', 0),
  ];
  const out = rebuildPaths(nodes);
  // sortOrder 로 정렬되므로 B 가 0000, A 가 0001.
  assert.equal(out.get('B')!.path, '0000');
  assert.equal(out.get('A')!.path, '0001');
  assert.equal(out.get('A1')!.path, '0001.0000');
  assert.equal(out.get('A2')!.path, '0001.0001');
  assert.equal(out.get('A1a')!.path, '0001.0000.0000');
  assert.equal(out.get('A1a')!.level, 3);
});

test('트랙마다 대과업 순번을 따로 매긴다', () => {
  // path 는 trackId 그룹 안에서만 유일하다. 트랙이 달라도 같은 경로가 나올 수 있다.
  const nodes = [
    T('A', null, 0, 'TRK-0001'),
    T('B', null, 0, 'TRK-0002'),
  ];
  const out = rebuildPaths(nodes);
  assert.equal(out.get('A')!.path, '0000');
  assert.equal(out.get('B')!.path, '0000');
});

test('고아 노드는 대과업으로 끌어올리지 않고 결과에서 뺀다', () => {
  // 조용히 위치를 바꾸면 트리가 사람 몰래 재배치된다.
  const nodes = [T('A', null, 0), T('X', 'MISSING', 0)];
  const out = rebuildPaths(nodes);
  assert.equal(out.has('A'), true);
  assert.equal(out.has('X'), false);
});

test('깊이가 5단을 넘으면 거부한다', () => {
  const nodes = [
    T('L1', null, 0), T('L2', 'L1', 0), T('L3', 'L2', 0),
    T('L4', 'L3', 0), T('L5', 'L4', 0), T('L6', 'L5', 0),
  ];
  assert.throws(() => rebuildPaths(nodes), (e: unknown) =>
    e instanceof WorkTaskTreeError && e.code === 'DEPTH_EXCEEDED');
});

test('자손을 모두 모은다', () => {
  const nodes = [T('A', null, 0), T('A1', 'A', 0), T('A1a', 'A1', 0), T('B', null, 1)];
  const ids = collectDescendants(nodes, 'A').map((n) => n.id).sort();
  assert.deepEqual(ids, ['A1', 'A1a']);
});

test('순환이 있어도 자손 수집이 멈춘다', () => {
  const nodes = [T('A', 'B', 0), T('B', 'A', 0)];
  assert.doesNotThrow(() => collectDescendants(nodes, 'A'));
});

test('과업을 옮기면 하위가 따라오고 경로가 다시 매겨진다', () => {
  const nodes = [
    T('A', null, 0, 'TRK-0001', '0000'),
    T('B', null, 1, 'TRK-0001', '0001'),
    T('B1', 'B', 0, 'TRK-0001', '0001.0000'),
  ];
  const changed = moveSubtree(nodes, 'B', { trackId: 'TRK-0001', parentId: 'A' });
  const byId = new Map(changed.map((c) => [c.id, c]));
  assert.equal(byId.get('B')!.parentId, 'A');
  assert.equal(byId.get('B')!.path, '0000.0000');
  assert.equal(byId.get('B')!.level, 2);
  assert.equal(byId.get('B1')!.path, '0000.0000.0000', '하위도 따라온다');
  assert.equal(byId.get('B1')!.level, 3);
  assert.equal(byId.has('A'), false, '움직이지 않은 이웃은 저장 대상이 아니다');
});

test('트랙을 옮기면 하위 전체의 트랙이 함께 바뀐다', () => {
  const nodes = [
    T('A', null, 0, 'TRK-0001', '0000'),
    T('A1', 'A', 0, 'TRK-0001', '0000.0000'),
  ];
  const changed = moveSubtree(nodes, 'A', { trackId: 'TRK-0002', parentId: null });
  assert.equal(changed.every((c) => c.trackId === 'TRK-0002'), true);
});

test('자기 자신이나 자기 하위로는 옮길 수 없다', () => {
  const nodes = [
    T('A', null, 0, null, '0000'),
    T('A1', 'A', 0, null, '0000.0000'),
    T('A1a', 'A1', 0, null, '0000.0000.0000'),
  ];
  assert.throws(() => moveSubtree(nodes, 'A', { trackId: null, parentId: 'A' }), (e: unknown) =>
    e instanceof WorkTaskTreeError && e.code === 'CYCLE');
  assert.throws(() => moveSubtree(nodes, 'A', { trackId: null, parentId: 'A1a' }), (e: unknown) =>
    e instanceof WorkTaskTreeError && e.code === 'CYCLE');
});

test('옮긴 결과가 5단을 넘으면 옮기기 전에 거부한다', () => {
  // 옮기고 나서 터지면 되돌릴 방법이 없다.
  const nodes = [
    T('L1', null, 0, null, '0000'), T('L2', 'L1', 0, null, '0000.0000'),
    T('L3', 'L2', 0, null, '0000.0000.0000'), T('L4', 'L3', 0, null, '0000.0000.0000.0000'),
    T('X', null, 1, null, '0001'), T('X1', 'X', 0, null, '0001.0000'),
  ];
  assert.throws(() => moveSubtree(nodes, 'X', { trackId: null, parentId: 'L4' }), (e: unknown) =>
    e instanceof WorkTaskTreeError && e.code === 'DEPTH_EXCEEDED');
});

test('부모와 트랙이 다르면 거부한다', () => {
  const nodes = [
    T('A', null, 0, 'TRK-0001', '0000'),
    T('B', null, 0, 'TRK-0002', '0000'),
  ];
  assert.throws(() => moveSubtree(nodes, 'B', { trackId: 'TRK-0002', parentId: 'A' }), WorkTaskTreeError);
});
