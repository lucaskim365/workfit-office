import assert from 'node:assert/strict';
import test from 'node:test';
import { workTaskSchema } from './schema';

const task = {
  id: 'TASK-20260812-0001',
  projectId: 'PRJ-0001',
  trackId: null,
  parentId: null,
  level: 1,
  path: '0000',
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

test('과업 계약을 검증한다', () => {
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
});

test('트리 필드가 없는 옛 문서는 버리지 않고 대과업으로 눕힌다', () => {
  // 파싱에 실패하면 crudBackend 가 그 문서를 건너뛰어 **에러 없이 과업이 사라진다.**
  // 이관 전에도 목록이 멀쩡히 보여야 하므로 읽기는 관대하게 간다.
  const legacy = { ...task, sortOrder: 20 } as Record<string, unknown>;
  delete legacy.trackId;
  delete legacy.parentId;
  delete legacy.level;
  delete legacy.path;

  const parsed = workTaskSchema.safeParse(legacy);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.level, 1);
  assert.equal(parsed.data?.path, '0020', '옛 sortOrder 를 형제 순번으로 쓴다');
  assert.equal(parsed.data?.trackId, null);
  assert.equal(parsed.data?.parentId, null);

  // 규격 밖 경로도 같은 방식으로 되살린다 — 버리는 것보다 눕히는 편이 낫다.
  assert.equal(workTaskSchema.safeParse({ ...task, path: '1' }).data?.path, '0000');
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
