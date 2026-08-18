import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProjectDraft } from '@/domain/workProject/schema';
import { workProjectRepo } from './workProject.repo';

const owner: ProjectAccessContext = { userId: 'U011', deptId: 'D240', active: true };
const outsider: ProjectAccessContext = { userId: 'U099', deptId: 'D999', active: true };

const draft = (code: string): WorkProjectDraft => ({
  code,
  name: '프로젝트 저장소 테스트',
  description: '',
  ownerUserId: owner.userId,
  memberUserIds: [owner.userId, 'U012'],
  deptId: owner.deptId,
  visibility: 'PRIVATE',
  status: 'PLANNING',
  startAt: '2026-08-12T00:00:00.000Z',
  dueAt: '2026-08-31T14:59:59.999Z',
  color: '#16a394',
  chatRoomId: null,
});

test('접근 가능한 프로젝트만 목록과 상세로 반환한다', async () => {
  assert.equal((await workProjectRepo.list(owner)).some((row) => row.id === 'PRJ-0001'), true);
  assert.equal(await workProjectRepo.get(outsider, 'PRJ-0002'), null);
});

test('프로젝트 생성과 일정·참여자 수정을 지원한다', async () => {
  const created = await workProjectRepo.create(owner, draft('LOCAL-PM-TEST'));
  assert.deepEqual(created.memberUserIds, [owner.userId, 'U012']);
  const updated = await workProjectRepo.update(owner, created.id, {
    ...draft('LOCAL-PM-TEST'),
    name: '수정된 프로젝트',
    memberUserIds: [owner.userId],
    dueAt: '2026-09-10T14:59:59.999Z',
  });
  assert.equal(updated.name, '수정된 프로젝트');
  assert.deepEqual(updated.memberUserIds, [owner.userId]);
  assert.equal(updated.dueAt, '2026-09-10T14:59:59.999Z');
});

test('외부 수정·중복 코드·비활성 계정 생성을 차단한다', async () => {
  const created = await workProjectRepo.create(owner, draft('LOCAL-PM-GUARD'));
  await assert.rejects(() => workProjectRepo.update(outsider, created.id, draft('OTHER-CODE')));
  await assert.rejects(() => workProjectRepo.create(owner, draft('GW-2026')));
  await assert.rejects(() => workProjectRepo.create({ ...owner, active: false }, draft('INACTIVE-CREATE')));
});

test('WBS 작업 담당자로 지정된 참여자 제거를 차단한다', async () => {
  const project = await workProjectRepo.get(owner, 'PRJ-0001');
  assert.ok(project);

  await assert.rejects(
    () => workProjectRepo.update(owner, project.id, {
      code: project.code,
      name: project.name,
      description: project.description,
      ownerUserId: project.ownerUserId,
      memberUserIds: project.memberUserIds.filter((userId) => userId !== 'U012'),
      deptId: project.deptId,
      visibility: project.visibility,
      status: project.status,
      startAt: project.startAt,
      dueAt: project.dueAt,
      color: project.color,
      chatRoomId: project.chatRoomId,
    }),
    (error) => error instanceof Error && error.message.includes('WBS 작업 담당자'),
  );
});
