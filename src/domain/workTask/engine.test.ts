import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkPhase } from '@/domain/workPhase/schema';
import type { WorkTask, WorkTaskDraft } from './schema';
import {
  assertTaskReferences,
  assertWbsTaskVersion,
  canCreateWbsTask,
  canEditWbsTask,
  canManageWbsPhases,
  canUpdateWbsTaskProgress,
  derivePhaseProgress,
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
  visibility: 'PRIVATE', status: 'ACTIVE', startAt: '2026-08-10T15:00:00.000Z',
  dueAt: '2026-08-30T14:59:59.999Z', color: '#16a394', chatRoomId: null,
  createdBy: owner.userId, createdAt: '2026-08-01T00:00:00.000Z',
  updatedBy: owner.userId, updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies WorkProject;

const phase = {
  id: 'PHASE-0001', projectId: project.id, name: '기획', sortOrder: 0,
  createdBy: owner.userId, createdAt: '2026-08-01T00:00:00.000Z',
  updatedBy: owner.userId, updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies WorkPhase;

const task = {
  id: 'TASK-20260812-0001', projectId: project.id, phaseId: phase.id,
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

test('완료 프로젝트의 WBS를 읽기 전용으로 잠근다', () => {
  const completed = { ...project, status: 'COMPLETED' as const };
  assert.equal(canManageWbsPhases(owner, completed), false);
  assert.equal(canCreateWbsTask(owner, completed), false);
  assert.equal(canUpdateWbsTaskProgress(assignee, completed, task), false);
});

test('단계·프로젝트·담당자 참조를 검증한다', () => {
  const draft: WorkTaskDraft = {
    projectId: project.id, phaseId: phase.id, title: task.title, description: '',
    assigneeUserId: assignee.userId, startAt: task.startAt, dueAt: task.dueAt,
    status: 'TODO', progress: 0,
  };
  assert.doesNotThrow(() => assertTaskReferences(project, phase, draft));
  assert.throws(
    () => assertTaskReferences(project, phase, { ...draft, assigneeUserId: outsider.userId }),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_ASSIGNEE',
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

test('단계와 프로젝트 진척률을 작업 평균으로 계산한다', () => {
  const tasks = [task, { ...task, id: 'TASK-20260812-0002', progress: 50, status: 'IN_PROGRESS' as const }];
  assert.equal(deriveProjectWbsProgress(tasks, project.id), 25);
  assert.equal(derivePhaseProgress(tasks, phase.id), 25);
  assert.equal(deriveProjectWbsProgress([], project.id), 0);
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
