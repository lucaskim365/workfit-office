import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import { WbsDomainError } from '@/domain/workTask/engine';
import { workPhaseRepo } from './workPhase.repo';

const owner: ProjectAccessContext = { userId: 'U011', deptId: 'D240', active: true };
const member: ProjectAccessContext = { userId: 'U012', deptId: 'D240', active: true };
const outsider: ProjectAccessContext = { userId: 'U008', deptId: 'D220', active: true };

test('조회 가능한 프로젝트의 단계를 정렬해 반환한다', async () => {
  const rows = await workPhaseRepo.list(member, 'PRJ-0001');
  assert.deepEqual(rows.map((row) => row.name), ['기획', '개발', '검증']);
  assert.deepEqual(await workPhaseRepo.list(outsider, 'PRJ-0001'), []);
});

test('프로젝트 소유자가 빈 단계를 생성·수정·삭제한다', async () => {
  const created = await workPhaseRepo.create(owner, { projectId: 'PRJ-0001', name: '배포 준비' });
  assert.equal(created.name, '배포 준비');
  const updated = await workPhaseRepo.update(owner, created.id, '출시 준비');
  assert.equal(updated.name, '출시 준비');
  const removed = await workPhaseRepo.remove(owner, created.id);
  assert.equal(removed.id, created.id);
});

test('일반 참여자의 단계 변경과 작업이 있는 단계 삭제를 차단한다', async () => {
  await assert.rejects(
    () => workPhaseRepo.create(member, { projectId: 'PRJ-0001', name: '권한 없는 단계' }),
    (error) => error instanceof WbsDomainError && error.code === 'FORBIDDEN',
  );
  await assert.rejects(
    () => workPhaseRepo.remove(owner, 'PHASE-0001'),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_PHASE',
  );
});

test('같은 프로젝트의 단계명 중복을 차단한다', async () => {
  await assert.rejects(
    () => workPhaseRepo.create(owner, { projectId: 'PRJ-0001', name: '기획' }),
    (error) => error instanceof WbsDomainError && error.code === 'INVALID_PHASE',
  );
});
