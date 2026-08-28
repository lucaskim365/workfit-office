import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateProgress, rollupTasks, rollupTrack, weightOf, type RollupInput } from './rollup';

function leaf(id: string, parentId: string | null, progress: number, days?: number): RollupInput {
  const startAt = days ? '2026-08-01T00:00:00.000Z' : null;
  const dueAt = days ? new Date(Date.parse('2026-08-01T00:00:00.000Z') + (days - 1) * 86_400_000).toISOString() : null;
  const status = progress === 0 ? 'TODO' : progress === 100 ? 'DONE' : 'IN_PROGRESS';
  return { id, parentId, progress, status, startAt, dueAt };
}

test('기간이 없으면 가중치는 1이다', () => {
  assert.equal(weightOf({ startAt: null, dueAt: null }), 1);
  assert.equal(weightOf({ startAt: '2026-08-01T00:00:00.000Z', dueAt: null }), 1);
});

test('가중치는 시작·종료를 포함한 일수다', () => {
  assert.equal(weightOf({ startAt: '2026-08-01T00:00:00.000Z', dueAt: '2026-08-01T00:00:00.000Z' }), 1);
  assert.equal(weightOf({ startAt: '2026-08-01T00:00:00.000Z', dueAt: '2026-08-10T00:00:00.000Z' }), 10);
});

test('기간이 뒤집혀도 가중치가 0이나 음수가 되지 않는다', () => {
  // 0이면 형제 전체 분모가 0이 되어 NaN이 나온다.
  assert.equal(weightOf({ startAt: '2026-08-10T00:00:00.000Z', dueAt: '2026-08-01T00:00:00.000Z' }), 1);
});

test('상위 진행률은 기간 가중 평균이다 — 긴 과업이 더 무겁다', () => {
  const nodes = [
    leaf('TASK-20260801-0001', null, 0),
    leaf('TASK-20260801-0002', 'TASK-20260801-0001', 100, 1),  // 하루짜리 완료
    leaf('TASK-20260801-0003', 'TASK-20260801-0001', 0, 9),    // 9일짜리 미착수
  ];
  const out = rollupTasks(nodes);
  // 단순 평균이면 50. 기간 가중이면 (100*1 + 0*9) / 10 = 10.
  assert.equal(out.get('TASK-20260801-0001')!.progress, 10);
});

test('리프의 저장값은 그대로 쓰고 isLeaf 로 표시한다', () => {
  const nodes = [leaf('TASK-20260801-0001', null, 42)];
  const out = rollupTasks(nodes);
  assert.deepEqual(out.get('TASK-20260801-0001'), { progress: 42, status: 'IN_PROGRESS', isLeaf: true });
});

test('3단 트리에서 아래에서 위로 접힌다', () => {
  const nodes = [
    leaf('TASK-20260801-0001', null, 0),                              // 대
    leaf('TASK-20260801-0002', 'TASK-20260801-0001', 0),              // 중
    leaf('TASK-20260801-0003', 'TASK-20260801-0002', 100),            // 소
    leaf('TASK-20260801-0004', 'TASK-20260801-0002', 0),              // 소
  ];
  const out = rollupTasks(nodes);
  assert.equal(out.get('TASK-20260801-0002')!.progress, 50);
  assert.equal(out.get('TASK-20260801-0001')!.progress, 50);
});

test('하위가 전부 완료면 상위 상태도 완료가 된다 — 저장된 상위 상태는 무시한다', () => {
  const nodes: RollupInput[] = [
    { id: 'TASK-20260801-0001', parentId: null, progress: 0, status: 'TODO', startAt: null, dueAt: null },
    leaf('TASK-20260801-0002', 'TASK-20260801-0001', 100),
    leaf('TASK-20260801-0003', 'TASK-20260801-0001', 100),
  ];
  const out = rollupTasks(nodes);
  assert.equal(out.get('TASK-20260801-0001')!.status, 'DONE');
  assert.equal(out.get('TASK-20260801-0001')!.progress, 100);
});

test('하위가 하나라도 움직였으면 상위는 진행 중이다', () => {
  const nodes: RollupInput[] = [
    { id: 'TASK-20260801-0001', parentId: null, progress: 0, status: 'TODO', startAt: null, dueAt: null },
    leaf('TASK-20260801-0002', 'TASK-20260801-0001', 30),
    leaf('TASK-20260801-0003', 'TASK-20260801-0001', 0),
  ];
  assert.equal(rollupTasks(nodes).get('TASK-20260801-0001')!.status, 'IN_PROGRESS');
});

test('부모를 못 찾는 고아도 계산에서 빠지지 않는다', () => {
  // 데이터가 깨졌을 때 화면에서 과업이 통째로 사라지는 편이 더 나쁘다.
  const nodes = [leaf('TASK-20260801-0009', 'TASK-20260801-9999', 70)];
  const out = rollupTasks(nodes);
  assert.equal(out.get('TASK-20260801-0009')!.progress, 70);
});

test('순환이 있어도 터지지 않는다', () => {
  const nodes: RollupInput[] = [
    { id: 'TASK-20260801-0001', parentId: 'TASK-20260801-0002', progress: 10, status: 'IN_PROGRESS', startAt: null, dueAt: null },
    { id: 'TASK-20260801-0002', parentId: 'TASK-20260801-0001', progress: 20, status: 'IN_PROGRESS', startAt: null, dueAt: null },
  ];
  const out = rollupTasks(nodes);
  assert.equal(out.size, 2);
});

test('빈 목록의 가중 평균은 0이다', () => {
  assert.equal(aggregateProgress([]), 0);
});

test('트랙 진행률은 직속 대과업들의 가중 평균이다', () => {
  const nodes = [
    leaf('TASK-20260801-0001', null, 100, 1),
    leaf('TASK-20260801-0002', null, 0, 9),
  ];
  const out = rollupTasks(nodes);
  assert.equal(rollupTrack(nodes, out), 10);
});

test('대과업이 없는 트랙은 0%다', () => {
  assert.equal(rollupTrack([], new Map()), 0);
});
