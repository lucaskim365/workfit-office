import assert from 'node:assert/strict';
import test from 'node:test';
import { workPhaseSchema } from '@/domain/workPhase/schema';
import { workTaskSchema } from './schema';

const phase = {
  id: 'PHASE-0001',
  projectId: 'PRJ-0001',
  name: '기획',
  sortOrder: 0,
  createdBy: 'U011',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedBy: 'U011',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

const task = {
  id: 'TASK-20260812-0001',
  projectId: 'PRJ-0001',
  trackId: null,
  parentId: null,
  level: 1,
  path: '0000',
  phaseId: 'PHASE-0001',
  title: '요구사항 정리',
  description: '',
  assigneeUserId: 'U011',
  startAt: '2026-08-12T00:00:00.000Z',
  dueAt: '2026-08-14T14:59:59.999Z',
  status: 'TODO',
  progress: 0,
  sortOrder: 0,
  completedAt: null,
  version: 1,
  createdBy: 'U011',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedBy: 'U011',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

test('프로젝트 WBS 단계와 작업 계약을 검증한다', () => {
  assert.equal(workPhaseSchema.safeParse(phase).success, true);
  assert.equal(workTaskSchema.safeParse(task).success, true);
});

test('트리 불변식 — level·parentId·path 가 서로 맞아야 한다', () => {
  // 셋 중 하나만 어긋나도 트리 조회가 조용히 틀린다. 저장 전에 막는다.
  assert.equal(workTaskSchema.safeParse({ ...task, level: 2 }).success, false, 'level 2인데 상위가 없다');
  assert.equal(
    workTaskSchema.safeParse({ ...task, parentId: 'TASK-20260812-0002' }).success,
    false,
    'level 1인데 상위가 있다',
  );
  assert.equal(
    workTaskSchema.safeParse({ ...task, parentId: 'TASK-20260812-0002', level: 2, path: '0000' }).success,
    false,
    '경로 마디 수가 level과 다르다',
  );
  assert.equal(
    workTaskSchema.safeParse({ ...task, parentId: 'TASK-20260812-0002', level: 2, path: '0000.0001' }).success,
    true,
  );
  assert.equal(workTaskSchema.safeParse({ ...task, path: '1' }).success, false, '마디는 4자리다');
});

test('작업 시작일보다 빠른 마감일을 거절한다', () => {
  assert.equal(workTaskSchema.safeParse({
    ...task,
    dueAt: '2026-08-11T14:59:59.999Z',
  }).success, false);
});

test('상태와 진척률·완료일시가 일치해야 한다', () => {
  assert.equal(workTaskSchema.safeParse({ ...task, status: 'TODO', progress: 10 }).success, false);
  assert.equal(workTaskSchema.safeParse({ ...task, status: 'IN_PROGRESS', progress: 0 }).success, false);
  assert.equal(workTaskSchema.safeParse({ ...task, status: 'DONE', progress: 100, completedAt: null }).success, false);
  assert.equal(workTaskSchema.safeParse({
    ...task,
    status: 'DONE',
    progress: 100,
    completedAt: '2026-08-14T05:00:00.000Z',
  }).success, true);
});
