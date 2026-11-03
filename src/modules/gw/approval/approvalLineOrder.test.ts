import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLineGroups, moveLineGroup, type EditStep } from './approvalLineOrder';

const seq = (id: string): EditStep => ({ approverId: id, kind: '결재', linkedPrev: false, groupId: null });
const par = (id: string, g: string, first = false): EditStep => ({ approverId: id, kind: '결재', linkedPrev: !first, groupId: g });

const ids = (approvers: EditStep[]) => approvers.map((a) => a.approverId).join(',');
const shape = (groups: ReturnType<typeof buildLineGroups>) =>
  groups.map((g) => (g.isParallel ? `[${g.items.map((i) => i.edit.approverId).join('+') || '빈'}]` : g.items[0].edit.approverId)).join(' ');

test('빈 병렬 그룹은 기억한 자리에 그린다', () => {
  const approvers = [seq('A'), seq('B'), seq('C')];
  assert.equal(shape(buildLineGroups(approvers, [{ id: 'e1', before: 1 }])), 'A [빈] B C');
  assert.equal(shape(buildLineGroups(approvers, [{ id: 'e1', before: 3 }])), 'A B C [빈]');
  assert.equal(shape(buildLineGroups(approvers, [{ id: 'e1', before: 9 }])), 'A B C [빈]'); // 범위 밖은 맨 끝
});

test('빈 병렬 그룹을 결재선 중간으로 올린다', () => {
  const approvers = [seq('A'), seq('B'), seq('C')];
  const groups = buildLineGroups(approvers, [{ id: 'e1', before: 3 }]);
  const up1 = moveLineGroup(groups, 3, -1);
  assert.deepEqual(up1.empties, [{ id: 'e1', before: 2 }]);
  assert.equal(shape(buildLineGroups(up1.approvers, up1.empties)), 'A B [빈] C');
  const g2 = buildLineGroups(up1.approvers, up1.empties);
  const up2 = moveLineGroup(g2, 2, -1);
  assert.equal(shape(buildLineGroups(up2.approvers, up2.empties)), 'A [빈] B C');
});

test('결재자가 있는 병렬 그룹을 중간으로 옮긴다', () => {
  const approvers = [seq('A'), seq('B'), seq('C'), par('P1', 'G9', true), par('P2', 'G9')];
  const groups = buildLineGroups(approvers, []);
  assert.equal(shape(groups), 'A B C [P1+P2]');
  const up = moveLineGroup(groups, 3, -1);
  assert.equal(ids(up.approvers), 'A,B,P1,P2,C');
  assert.deepEqual(
    up.approvers.map((a) => [a.linkedPrev, a.groupId]),
    [[false, null], [false, null], [false, 'G9'], [true, 'G9'], [false, null]],
  );
  assert.equal(shape(buildLineGroups(up.approvers, up.empties)), 'A B [P1+P2] C');
});

test('단독 결재자는 병렬 그룹을 통째로 건너뛴다 (그룹 사이에 끼지 않음)', () => {
  const approvers = [seq('A'), par('P1', 'G9', true), par('P2', 'G9'), seq('C')];
  const groups = buildLineGroups(approvers, []);
  const up = moveLineGroup(groups, 2, -1); // C 위로
  assert.equal(ids(up.approvers), 'A,C,P1,P2');
  assert.equal(shape(buildLineGroups(up.approvers, up.empties)), 'A C [P1+P2]');
  const down = moveLineGroup(groups, 0, 1); // A 아래로
  assert.equal(shape(buildLineGroups(down.approvers, down.empties)), '[P1+P2] A C');
});

test('맨 위·맨 아래에서는 움직이지 않는다', () => {
  const approvers = [seq('A'), seq('B')];
  const groups = buildLineGroups(approvers, []);
  assert.equal(ids(moveLineGroup(groups, 0, -1).approvers), 'A,B');
  assert.equal(ids(moveLineGroup(groups, 1, 1).approvers), 'A,B');
});
