import assert from 'node:assert/strict';
import test from 'node:test';
import { userSchema } from '@/domain/user/schema';
import { employeeProfileSchema } from '@/domain/employeeProfile/schema';
import { positionSchema } from '@/domain/position/schema';
import { userRepo } from '@/data/user/user.repo';
import { employeeProfileRepo } from '@/data/employeeProfile/employeeProfile.repo';
import { departmentMemberRepo } from '@/data/departmentMember/departmentMember.repo';
import { departmentRepo } from '@/data/department/department.repo';
import { positionRepo } from '@/data/position/position.repo';
import { jobTitleRepo } from '@/data/jobTitle/jobTitle.repo';
import {
  assignDeptHead,
  departmentDeleteBlocker,
  jobTitleDeleteBlocker,
  positionDeleteBlocker,
  releaseDeptHeadOnLeave,
  setPersonJobTitle,
  syncDeptHeadFromTitle,
} from './orgSync';

const dept = (id: string, name: string, parentId: string | null = null) =>
  departmentRepo.save({ id, name, parentId, headUserId: null, deptType: '본사', order: 1 });

test.before(async () => {
  await dept('DX1', 'X팀');
  await dept('DX2', 'Y팀');
  await positionRepo.save(positionSchema.parse({ id: 'PX1', name: 'X직급', rank: 5 }));
  await positionRepo.save(positionSchema.parse({ id: 'PX2', name: 'Y직급', rank: 6 }));
  await jobTitleRepo.save({ id: 'JX1', name: 'X직책' });
  await jobTitleRepo.save({ id: 'JX2', name: 'Y직책' });
});

/** 소속은 인명관리에만 둔다. 계정 이름 칸은 일부러 엉뚱한 값 — ID 기준임을 확인하려고. */
const person = async (id: string, aff: { dept?: string; position?: string; jobTitle?: string }, status: '사용' | '미사용' = '사용') => {
  await userRepo.save(userSchema.parse({ id, empNo: id, name: id, email: `${id.toLowerCase()}@x.co`, dept: '엉뚱', position: '엉뚱', jobTitle: '엉뚱', status }));
  await employeeProfileRepo.save(employeeProfileSchema.parse({ id, userId: id, empNo: id, name: id, ...aff }), { keepAttendanceTarget: true });
};

test('부서장 직책 지정은 인명관리 직책 ID와 본직 소속행 직책을 바꾸고, 사람 목록에 그 이름이 나온다', async () => {
  await person('UJ1', { dept: 'X팀', jobTitle: 'Y직책' });
  await departmentMemberRepo.save({ id: 'DM-UJ1-DX1', userId: 'UJ1', deptId: 'DX1', deptName: 'X팀', isPrimary: true, jobTitle: 'Y직책' });

  await setPersonJobTitle('UJ1', 'X직책');

  assert.equal((await employeeProfileRepo.get('UJ1'))?.jobTitleId, 'JX1');
  assert.equal((await userRepo.get('UJ1'))?.jobTitle, 'X직책');
  assert.equal((await departmentMemberRepo.get('DM-UJ1-DX1'))?.jobTitleId, 'JX1');
});

test('부서 삭제 차단은 인명관리 부서 ID 기준 — 계정 이름 칸은 보지 않는다', async () => {
  const depts = [
    { id: 'DX1', name: 'X팀', parentId: null },
    { id: 'DX2', name: 'Y팀', parentId: null },
    { id: 'DX3', name: '상위', parentId: null },
    { id: 'DX4', name: '하위', parentId: 'DX3' },
    { id: 'DX5', name: '겸직만', parentId: null },
    { id: 'DX6', name: '엉뚱', parentId: null },
  ];
  await person('UD1', { dept: 'Y팀' });
  await person('UD2', { dept: 'X팀' }, '미사용');
  await departmentMemberRepo.save({ id: 'DM-UD1-DX5', userId: 'UD1', deptId: 'DX5', deptName: '겸직만', isPrimary: false });

  assert.match((await departmentDeleteBlocker(depts[1], depts)) ?? '', /소속 인원 1명/);
  assert.match((await departmentDeleteBlocker(depts[2], depts)) ?? '', /하위 부서/);
  assert.match((await departmentDeleteBlocker(depts[4], depts)) ?? '', /겸직/);
  // 계정 이름 칸이 '엉뚱'인 사람들이 있어도 막지 않는다
  assert.equal(await departmentDeleteBlocker(depts[5], depts), null);
});

test('직급·직책 삭제 차단은 ID 기준, 퇴직자만 쓰면 허용', async () => {
  await person('UX1', { position: 'X직급', jobTitle: 'X직책' });
  await person('UX2', { position: 'Y직급', jobTitle: 'Y직책' }, '미사용');

  assert.match((await positionDeleteBlocker('PX1')) ?? '', /명/);
  assert.equal(await positionDeleteBlocker('PX2'), null);
  assert.match((await jobTitleDeleteBlocker('JX1')) ?? '', /명/);
});

test('기준정보에 없는 직책으로 지정하면 조용히 넘어가지 않고 알린다', async () => {
  await person('UJ9', { dept: 'X팀', jobTitle: 'X직책' });
  await assert.rejects(setPersonJobTitle('UJ9', '위원장'), /직책 '위원장'/);
  assert.equal((await employeeProfileRepo.get('UJ9'))?.jobTitleId, 'JX1');
});

// ── 부서장 지정 — 부서 headUserId 와 그 부서에서의 직책을 함께 맞춘다 ──
const headDept = (id: string, name: string, deptType: '본사' | '위원회' = '본사', headUserId: string | null = null) =>
  departmentRepo.save({ id, name, parentId: null, headUserId, deptType, order: 1 });

test('다른 부서 사람을 부서장으로 지정하면 그 부서 겸직 팀장이 생기고, 본직 직책과 기존 부서장의 본직 부서는 그대로다', async () => {
  await headDept('DH1', 'H1팀');
  await headDept('DH2', 'H2팀');
  await person('UH1', { dept: 'H1팀', position: '부장', jobTitle: '팀장' }); // H1팀 부서장
  await person('UH2', { dept: 'H2팀', position: '부장', jobTitle: '팀장' }); // H2팀 팀장(부서장 칸은 비어 있던 상태)
  await assignDeptHead('DH1', 'UH1');

  await assignDeptHead('DH2', 'UH1');

  assert.equal((await departmentRepo.get('DH2'))?.headUserId, 'UH1');
  assert.equal((await departmentMemberRepo.get('DM-UH1-DH2'))?.jobTitle, '팀장');
  assert.equal((await departmentMemberRepo.get('DM-UH1-DH2'))?.isPrimary, false);
  assert.equal((await employeeProfileRepo.get('UH1'))?.jobTitle, '팀장'); // 본직(H1팀) 직책 그대로
  assert.equal((await departmentRepo.get('DH1'))?.headUserId, 'UH1');
  assert.equal((await employeeProfileRepo.get('UH2'))?.jobTitle, '팀원'); // H2팀의 기존 팀장은 내려간다
});

test('부서장을 바꾸면 기존 부서장은 그 부서 직책만 내려가고, 그 사람이 겸직으로 맡던 다른 부서는 그대로다', async () => {
  await headDept('DH3', 'H3팀');
  await headDept('DH4', 'H4팀');
  await person('UH3', { dept: 'H3팀', position: '부장', jobTitle: '팀원' });
  await person('UH4', { dept: 'H4팀', position: '부장', jobTitle: '팀원' });
  await assignDeptHead('DH3', 'UH4'); // UH4 가 H3팀 겸직 부서장
  await assignDeptHead('DH4', 'UH4'); // 본직 H4팀 부서장

  await assignDeptHead('DH3', 'UH3');

  assert.equal((await departmentRepo.get('DH3'))?.headUserId, 'UH3');
  assert.equal((await employeeProfileRepo.get('UH3'))?.jobTitle, '팀장');
  assert.equal((await departmentMemberRepo.get('DM-UH4-DH3'))?.jobTitle, '팀원');
  assert.equal((await employeeProfileRepo.get('UH4'))?.jobTitle, '팀장');
  assert.equal((await departmentRepo.get('DH4'))?.headUserId, 'UH4');
});

test('인명관리에서 팀장으로 발령하면 부서장이 바뀌고, 부서장을 팀원으로 바꾸면 부서장이 비워진다', async () => {
  await headDept('DH5', 'H5팀');
  await person('UH5', { dept: 'H5팀', position: '과장', jobTitle: '팀장' });
  await person('UH6', { dept: 'H5팀', position: '대리', jobTitle: '팀원' });
  await assignDeptHead('DH5', 'UH5');

  // 화면이 직책을 먼저 저장한 뒤 연동을 부른다
  await setPersonJobTitle('UH6', '팀장');
  await syncDeptHeadFromTitle('UH6', 'DH5', '팀원', '팀장');
  assert.equal((await departmentRepo.get('DH5'))?.headUserId, 'UH6');
  assert.equal((await employeeProfileRepo.get('UH5'))?.jobTitle, '팀원');

  await setPersonJobTitle('UH6', '팀원');
  await syncDeptHeadFromTitle('UH6', 'DH5', '팀장', '팀원');
  assert.equal((await departmentRepo.get('DH5'))?.headUserId, null);
});

test('겸직을 해제하거나 본직 부서를 옮기면 그 부서 부서장에서 빠진다', async () => {
  await headDept('DH6', 'H6팀');
  await person('UH7', { dept: 'H1팀', position: '부장', jobTitle: '팀원' });
  await assignDeptHead('DH6', 'UH7');
  assert.equal((await departmentRepo.get('DH6'))?.headUserId, 'UH7');

  await departmentMemberRepo.remove('DM-UH7-DH6');
  await releaseDeptHeadOnLeave('UH7', 'DH6');
  assert.equal((await departmentRepo.get('DH6'))?.headUserId, null);
});

test('위원회는 직책을 바꾸지 않고 부서장만 지정한다', async () => {
  await headDept('DH7', 'H7위원회', '위원회');
  await person('UH8', { dept: 'H1팀', position: '이사', jobTitle: '임원' });

  await assignDeptHead('DH7', 'UH8');

  assert.equal((await departmentRepo.get('DH7'))?.headUserId, 'UH8');
  assert.equal(await departmentMemberRepo.get('DM-UH8-DH7'), null);
  assert.equal((await employeeProfileRepo.get('UH8'))?.jobTitle, '임원');
});

test('필요한 직책이 직책 목록에 없으면 부서장도 직책도 바꾸지 않는다', async () => {
  await headDept('DH8', 'H8본부');
  await departmentRepo.save({ id: 'DH8', name: 'H8본부', parentId: null, headUserId: null, deptType: '본부', order: 1 });
  await person('UH9', { dept: 'H8본부', position: '부장', jobTitle: '팀원' });
  const removed = (await jobTitleRepo.list()).find((j) => j.name === '본부장');
  if (removed) await jobTitleRepo.remove(removed.id);
  try {
    await assert.rejects(assignDeptHead('DH8', 'UH9'), /본부장/);
    assert.equal((await departmentRepo.get('DH8'))?.headUserId, null);
    assert.equal((await employeeProfileRepo.get('UH9'))?.jobTitle, '팀원');
  } finally {
    if (removed) await jobTitleRepo.save(removed);
  }
});
