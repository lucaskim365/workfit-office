import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import { WbsDomainError } from '@/domain/workTask/engine';
import type { WorkTaskDraft } from '@/domain/workTask/schema';
import { workTaskRepo } from './workTask.repo';

const owner: ProjectAccessContext = { userId: 'U011', deptId: 'D240', active: true };
const member: ProjectAccessContext = { userId: 'U012', deptId: 'D240', active: true };
const outsider: ProjectAccessContext = { userId: 'U008', deptId: 'D220', active: true };

const draft: WorkTaskDraft = {
  projectId: 'PRJ-0001',
  phaseId: 'PHASE-0002',
  title: 'WBS 저장소 테스트',
  description: '',
  assigneeUserId: member.userId,
  startAt: '2026-08-15T00:00:00.000Z',
  dueAt: '2026-08-16T14:59:59.999Z',
  status: 'TODO',
  progress: 0,
};

test('접근 가능한 프로젝트의 작업만 WBS 순서로 조회한다', async () => {
  const rows = await workTaskRepo.list(member, 'PRJ-0001');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.phaseId), ['PHASE-0001', 'PHASE-0002', 'PHASE-0003']);
  assert.deepEqual(await workTaskRepo.list(outsider, 'PRJ-0001'), []);
});

test('프로젝트 참여자가 작업을 만들고 작성자가 수정·삭제한다', async () => {
  const created = await workTaskRepo.create(member, draft);
  assert.equal(created.createdBy, member.userId);
  assert.equal(created.assigneeUserId, member.userId);

  const updated = await workTaskRepo.update(member, created.id, { ...draft, title: '수정된 WBS 작업' }, created.version);
  assert.equal(updated.title, '수정된 WBS 작업');
  const removed = await workTaskRepo.remove(member, updated.id, updated.version);
  assert.equal(removed.id, created.id);
});

test('담당자는 본인 작업의 진척률을 변경하되 상세는 수정할 수 없다', async () => {
  const current = await workTaskRepo.get(member, 'TASK-20260811-0003');
  assert.ok(current);
  const progressed = await workTaskRepo.setProgress(member, current.id, 40, current.version);
  assert.equal(progressed.status, 'IN_PROGRESS');
  assert.equal(progressed.progress, 40);

  await assert.rejects(
    () => workTaskRepo.update(member, progressed.id, {
      projectId: progressed.projectId,
      phaseId: progressed.phaseId,
      title: '권한 없는 수정',
      description: progressed.description,
      assigneeUserId: progressed.assigneeUserId,
      startAt: progressed.startAt,
      dueAt: progressed.dueAt,
      status: progressed.status,
      progress: progressed.progress,
    }, progressed.version),
    (error) => error instanceof WbsDomainError && error.code === 'FORBIDDEN',
  );
});

test('프로젝트 외 담당자와 오래된 version을 차단한다', async () => {
  await assert.rejects(
    () => workTaskRepo.create(owner, { ...draft, assigneeUserId: outsider.userId }),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_ASSIGNEE',
  );
  const current = await workTaskRepo.get(owner, 'TASK-20260811-0002');
  assert.ok(current);
  await assert.rejects(
    () => workTaskRepo.setProgress(owner, current.id, 70, current.version + 1),
    (error) => error instanceof WbsDomainError && error.code === 'VERSION_CONFLICT',
  );
  await assert.rejects(
    () => workTaskRepo.setProgress(outsider, current.id, 70, current.version + 1),
    (error) => error instanceof WbsDomainError && error.code === 'FORBIDDEN',
  );
});
