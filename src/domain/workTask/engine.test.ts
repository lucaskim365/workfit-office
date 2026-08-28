import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkTask, WorkTaskDraft } from './schema';
import {
  assertTaskReferences,
  assertWbsTaskVersion,
  canCreateWbsTask,
  canEditWbsTask,
  canManageWbsPhases,
  canUpdateWbsTaskProgress,
  deriveProjectWbsProgress,
  isTaskOutsideProjectSchedule,
  progressForStatus,
  statusForProgress,
  updateTaskProgress,
  WbsDomainError,
} from './engine';

const owner: ProjectAccessContext = { userId: 'U011', deptId: 'D240', active: true };
const assignee: ProjectAccessContext = { userId: 'U012', deptId: 'D240', active: true };
const outsider: ProjectAccessContext = { userId: 'U009', deptId: 'D230', active: true };

const project = {
  id: 'PRJ-0001', code: 'GW-2026', name: '그룹웨어', description: '',
  ownerUserId: owner.userId, memberUserIds: [owner.userId, assignee.userId], deptId: 'D240',
  visibility: 'PRIVATE', status: 'ACTIVE',
  projectType: 'INTERNAL', fundingType: null, clientName: null, contractNo: null,
  contractStartAt: null, contractEndAt: null,
  startAt: '2026-08-10T15:00:00.000Z',
  dueAt: '2026-08-30T14:59:59.999Z', color: '#16a394', chatRoomId: null,
  createdBy: owner.userId, createdAt: '2026-08-01T00:00:00.000Z',
  updatedBy: owner.userId, updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies WorkProject;

const task = {
  id: 'TASK-20260812-0001', projectId: project.id,
  trackId: null, parentId: null, level: 1, path: '0000',
  title: '요구사항 정리', description: '', assigneeUserId: assignee.userId,
  startAt: '2026-08-12T00:00:00.000Z', dueAt: '2026-08-14T14:59:59.999Z',
  status: 'TODO', progress: 0, sortOrder: 0, completedAt: null, version: 1,
  createdBy: owner.userId, createdAt: '2026-08-01T00:00:00.000Z',
  updatedBy: owner.userId, updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies WorkTask;

test('프로젝트 소유자와 참여자의 WBS 권한을 구분한다', () => {
  assert.equal(canManageWbsPhases(owner, project), true);
  assert.equal(canManageWbsPhases(assignee, project), false);
  assert.equal(canCreateWbsTask(assignee, project), true);
  assert.equal(canCreateWbsTask(outsider, project), false);
  assert.equal(canEditWbsTask(owner, project, task), true);
  assert.equal(canEditWbsTask(assignee, project, task), false);
  assert.equal(canUpdateWbsTaskProgress(assignee, project, task), true);
});

test('관리자는 참여자·소유자 판정을 건너뛴다', () => {
  // 담당자 퇴사·잘못 만든 트리 정리처럼 남의 프로젝트를 손봐야 하는 상황에서
  // 소유자를 찾아다니게 두면 도구가 멈춘다.
  const admin: ProjectAccessContext = { userId: 'U999', deptId: 'D999', active: true, isAdmin: true };
  assert.equal(canCreateWbsTask(outsider, project), false, '참여자가 아니면 못 만든다');
  assert.equal(canCreateWbsTask(admin, project), true);
  assert.equal(canEditWbsTask(admin, project, task), true);
  assert.equal(canManageWbsPhases(admin, project), true);
  assert.equal(canUpdateWbsTaskProgress(admin, project, task), true);
});

test('관리자여도 잠긴 계정과 완료 프로젝트는 뚫지 못한다', () => {
  // 완료·보관은 권한이 아니라 상태다. 뚫으면 '완료'가 아무 뜻도 없어진다.
  const lockedAdmin: ProjectAccessContext = { userId: 'U999', deptId: null, active: false, isAdmin: true };
  assert.equal(canCreateWbsTask(lockedAdmin, project), false);

  const admin: ProjectAccessContext = { userId: 'U999', deptId: null, active: true, isAdmin: true };
  const completed = { ...project, status: 'COMPLETED' as const };
  assert.equal(canCreateWbsTask(admin, completed), false);
  assert.equal(canEditWbsTask(admin, completed, task), false);
});

test('완료 프로젝트의 WBS를 읽기 전용으로 잠근다', () => {
  const completed = { ...project, status: 'COMPLETED' as const };
  assert.equal(canManageWbsPhases(owner, completed), false);
  assert.equal(canCreateWbsTask(owner, completed), false);
  assert.equal(canUpdateWbsTaskProgress(assignee, completed, task), false);
});

test('상위 과업·프로젝트·담당자 참조를 검증한다', () => {
  const draft: WorkTaskDraft = {
    projectId: project.id, trackId: null, parentId: null,
    title: task.title, description: '',
    assigneeUserId: assignee.userId, startAt: task.startAt, dueAt: task.dueAt,
    status: 'TODO', progress: 0,
  };
  // 대과업은 확인할 상위가 없다.
  assert.doesNotThrow(() => assertTaskReferences(project, null, draft));
  assert.throws(
    () => assertTaskReferences(project, null, { ...draft, assigneeUserId: outsider.userId }),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_ASSIGNEE',
  );
  // 상위를 지정했는데 넘어온 상위가 없으면 거부한다.
  assert.throws(
    () => assertTaskReferences(project, null, { ...draft, parentId: task.id }),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_PARENT',
  );
  assert.doesNotThrow(() => assertTaskReferences(project, task, { ...draft, parentId: task.id }));
  // 한 트리가 두 트랙에 걸치면 트랙 진행률이 어느 쪽에도 온전히 안 잡힌다.
  assert.throws(
    () => assertTaskReferences(project, task, { ...draft, parentId: task.id, trackId: 'TRK-0001' }),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_TRACK',
  );
});

test('진척률과 상태를 양방향으로 일치시킨다', () => {
  assert.equal(statusForProgress(0), 'TODO');
  assert.equal(statusForProgress(35), 'IN_PROGRESS');
  assert.equal(statusForProgress(100), 'DONE');
  assert.equal(progressForStatus('IN_PROGRESS', 0), 50);
  assert.equal(progressForStatus('IN_PROGRESS', 40), 40);

  const done = updateTaskProgress(assignee, project, task, 100, new Date('2026-08-12T05:00:00.000Z'));
  assert.equal(done.status, 'DONE');
  assert.equal(done.completedAt, '2026-08-12T05:00:00.000Z');
  const reopened = updateTaskProgress(assignee, project, done, 30, new Date('2026-08-12T06:00:00.000Z'));
  assert.equal(reopened.status, 'IN_PROGRESS');
  assert.equal(reopened.completedAt, null);
});

test('프로젝트 진척률은 대과업의 기간 가중 평균이다', () => {
  const tasks = [
    task, // 0%, 3일
    { ...task, id: 'TASK-20260812-0002', path: '0001', progress: 50, status: 'IN_PROGRESS' as const },
  ];
  // 두 대과업 모두 같은 기간(3일)이라 가중치가 같다 → (0 + 50) / 2 = 25.
  assert.equal(deriveProjectWbsProgress(tasks, project.id), 25);
  assert.equal(deriveProjectWbsProgress([], project.id), 0);
});

test('상위 과업의 저장값은 프로젝트 진척률에 두 번 세지 않는다', () => {
  // 트리 도입 전에는 전 작업의 단순 평균이라 상위가 같이 세어져 하위가 두 번 반영됐다.
  const parent = { ...task, id: 'TASK-20260812-0010', path: '0000', progress: 0 };
  const child = {
    ...task,
    id: 'TASK-20260812-0011',
    parentId: parent.id,
    level: 2,
    path: '0000.0000',
    progress: 100,
    status: 'DONE' as const,
    completedAt: '2026-08-13T00:00:00.000Z',
  };
  // 단순 평균이면 (0 + 100) / 2 = 50. 접어 올리면 대과업 = 자식 100 → 100.
  assert.equal(deriveProjectWbsProgress([parent, child], project.id), 100);
});

test('프로젝트 기간을 벗어난 작업 일정을 경고 대상으로 판정한다', () => {
  assert.equal(isTaskOutsideProjectSchedule(project, task), false);
  assert.equal(isTaskOutsideProjectSchedule(project, { ...task, dueAt: '2026-09-01T14:59:59.999Z' }), true);
  assert.equal(isTaskOutsideProjectSchedule(
    { ...project, startAt: '2026-08-11T00:00:00.000Z' },
    { ...task, startAt: '2026-08-10T15:00:00.000Z' },
  ), false);
});

test('작업 version 불일치를 차단한다', () => {
  assert.doesNotThrow(() => assertWbsTaskVersion(task, 1));
  assert.throws(
    () => assertWbsTaskVersion(task, 2),
    (error) => error instanceof WbsDomainError && error.code === 'VERSION_CONFLICT',
  );
});
