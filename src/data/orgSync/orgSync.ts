import { userRepo } from '@/data/user/user.repo';
import { employeeProfileRepo } from '@/data/employeeProfile/employeeProfile.repo';
import { departmentMemberRepo } from '@/data/departmentMember/departmentMember.repo';
import { loadOrgMasters } from '@/data/_backend/orgMasters';
import { departmentRepo } from '@/data/department/department.repo';
import { positionRepo } from '@/data/position/position.repo';
import { isCommitteeDept, makeDepartmentMemberId } from '@/domain/departmentMember/engine';
import type { Department } from '@/domain/department/schema';

/*
 * 조직 기준정보(부서·직급·직책)와 사람 소속 사이의 규칙.
 * 사람의 본직 소속은 인명관리에 기준정보 ID로만 저장된다 — 기준정보 이름을 바꿔도 사람 쪽은 고칠 것이 없다.
 * 여기서는 부서장 지정과, 쓰는 사람이 있는 기준정보의 삭제 차단을 다룬다.
 *
 * 부서장은 두 곳에 기록된다 — 부서의 headUserId(결재선·권한·조직도가 읽음)와 그 부서에서의 사람 직책(인명관리).
 * 둘을 따로 바꾸면 어긋나므로 부서장 지정·해제는 assignDeptHead 한 곳에서만 한다.
 */

/** 한 사람의 직책을 인명관리와 본직 소속행에 저장한다(부서장 지정·해제 등). 이름은 저장소가 ID로 바꾼다. */
export async function setPersonJobTitle(userId: string, jobTitle: string): Promise<void> {
  // 저장소는 못 찾은 이름이면 기존 직책을 유지한다 — 코드에서 정한 직책이 기준정보에 없으면 조용히 무시되지 않게 먼저 알린다.
  if (jobTitle && !(await loadOrgMasters()).jobTitles.some((j) => j.name === jobTitle)) {
    throw new Error(`직책 '${jobTitle}'이(가) 직급관리에 없습니다. 직급관리 > 직책에 먼저 추가하세요.`);
  }
  const profile = (await employeeProfileRepo.listIncludingTestAccounts()).find((p) => p.userId === userId || p.id === userId);
  if (profile && profile.jobTitle !== jobTitle) {
    await employeeProfileRepo.save({ ...profile, jobTitle }, { keepAttendanceTarget: true });
  }
  for (const m of await departmentMemberRepo.listByUserId(userId)) {
    if (m.isPrimary && m.jobTitle !== jobTitle) await departmentMemberRepo.save({ ...m, jobTitle });
  }
}

/** 부서장으로 보는 직책 — 같은 부서에 이 직책이 둘이면 부서장이 둘로 보이므로 지정 때 하나만 남긴다. */
export const DEPT_HEAD_TITLES = ['팀장', '본부장', '위원장'] as const;
export const isDeptHeadTitle = (title?: string | null) => (DEPT_HEAD_TITLES as readonly string[]).includes(title ?? '');

/** 부서장이 받는 직책 — 본부는 본부장, 그 외는 직급 순위 3(이사) 이하면 팀장·위로는 임원. 위원회는 직책을 두지 않는다. */
export function headJobTitleFor(dept: Pick<Department, 'name' | 'deptType'>, rank: number): string | null {
  if (isCommitteeDept(dept as Department)) return null;
  if (dept.deptType === '본부') return '본부장';
  return rank >= 3 ? '팀장' : '임원';
}

/** 부서장에서 물러난 사람의 그 부서 직책. */
const formerHeadJobTitle = (rank: number) => (rank >= 3 ? '팀원' : '임원');

/**
 * 부서장 지정·해제 — 부서의 headUserId 와 **그 부서에서의** 직책을 함께 바꾼다.
 * - 새 부서장이 그 부서 본직이면 본직 직책을, 다른 부서 사람이면 그 부서 겸직(없으면 만든다) 직책을 바꾼다.
 * - 기존 부서장과 그 부서에서 부서장 직책을 가진 다른 사람은 그 부서에서의 직책만 내린다(본직 부서 직책은 그대로).
 * - 위원회는 직책을 두지 않으므로 headUserId 만 바꾼다.
 * 필요한 직책이 직책 목록에 없으면 아무것도 저장하지 않고 알린다.
 * headUserId 가 이미 같아도 직책을 다시 맞추므로, 어긋난 부서는 다시 저장하면 바로잡힌다.
 */
export async function assignDeptHead(deptId: string, headUserId: string | null): Promise<void> {
  const dept = await departmentRepo.get(deptId);
  if (!dept) throw new Error('부서를 찾을 수 없습니다.');
  const [{ active, profiles }, positions, masters, members] = await Promise.all([
    activeProfiles(),
    positionRepo.list(),
    loadOrgMasters(),
    departmentMemberRepo.list(),
  ]);
  const profileOf = (uid: string) => profiles.find((p) => p.userId === uid || p.id === uid);
  const rankOf = (uid: string) => positions.find((p) => p.id === profileOf(uid)?.positionId)?.rank ?? 9;
  const committee = isCommitteeDept(dept);

  // 그 부서에서 부서장 직책을 가진 재직자(본직 + 겸직) — 새 부서장 말고는 모두 내린다
  const holders = new Set<string>();
  for (const p of profiles) if (p.deptId === dept.id && isDeptHeadTitle(p.jobTitle)) holders.add(p.userId);
  for (const m of members) if (!m.isPrimary && m.deptId === dept.id && active.has(m.userId) && isDeptHeadTitle(m.jobTitle)) holders.add(m.userId);
  if (dept.headUserId) holders.add(dept.headUserId);
  if (headUserId) holders.delete(headUserId);

  const changes: { userId: string; title: string }[] = [];
  if (!committee) {
    if (headUserId) {
      const title = headJobTitleFor(dept, rankOf(headUserId));
      if (title) changes.push({ userId: headUserId, title });
    }
    for (const uid of holders) changes.push({ userId: uid, title: formerHeadJobTitle(rankOf(uid)) });
  }
  const missing = [...new Set(changes.map((c) => c.title))].filter((t) => !masters.jobTitles.some((j) => j.name === t));
  if (missing.length) {
    throw new Error(`직책 '${missing.join("', '")}'이(가) 직급관리에 없습니다. 직급관리 > 직책에 먼저 추가하세요.`);
  }

  if ((dept.headUserId ?? null) !== headUserId) await departmentRepo.save({ ...dept, headUserId });
  for (const c of changes) await setJobTitleInDept(c.userId, dept, c.title, c.userId === headUserId);
}

/**
 * 한 사람의 '그 부서에서의' 직책을 바꾼다. 본직 부서면 인명관리 직책, 아니면 그 부서 겸직 행.
 * 겸직 행이 없을 때는 부서장으로 지정할 때(create)만 만든다 — 내릴 때 없는 소속을 새로 만들지 않는다.
 */
async function setJobTitleInDept(userId: string, dept: Department, title: string, create: boolean): Promise<void> {
  const profile = (await employeeProfileRepo.listIncludingTestAccounts()).find((p) => p.userId === userId || p.id === userId);
  if (profile?.deptId === dept.id) {
    await setPersonJobTitle(userId, title);
    return;
  }
  const id = makeDepartmentMemberId(userId, dept.id);
  const row = await departmentMemberRepo.get(id);
  if (row) {
    if (row.jobTitle !== title) await departmentMemberRepo.save({ ...row, jobTitle: title });
  } else if (create) {
    await departmentMemberRepo.save({ id, userId, deptId: dept.id, deptName: dept.name, isPrimary: false, jobTitle: title, order: 99, assignedAt: new Date().toISOString() });
  }
}

/**
 * 인명관리에서 한 부서의 직책을 바꾼 뒤 부서장 기록을 맞춘다.
 * - 부서장 직책으로 지정했고 지금 그 부서 부서장이 아니면 → 부서장으로 지정(기존 부서장은 내려간다)
 * - 부서장이던 사람을 부서장 아닌 직책으로 바꿨으면 → 그 부서 부서장을 비운다
 * 그 외(임원·대표처럼 부서장 직책 목록 밖, 위원회)는 건드리지 않는다.
 */
export async function syncDeptHeadFromTitle(userId: string, deptId: string, prevTitle: string, nextTitle: string): Promise<void> {
  const dept = await departmentRepo.get(deptId);
  if (!dept || isCommitteeDept(dept)) return;
  if (isDeptHeadTitle(nextTitle)) {
    if (dept.headUserId !== userId) await assignDeptHead(deptId, userId);
  } else if (isDeptHeadTitle(prevTitle) && dept.headUserId === userId) {
    await assignDeptHead(deptId, null);
  }
}

/** 인명관리에서 그 부서를 떠났을 때(본직 이동·겸직 해제) 그 부서 부서장이면 비운다. */
export async function releaseDeptHeadOnLeave(userId: string, deptId: string): Promise<void> {
  const dept = await departmentRepo.get(deptId);
  if (dept?.headUserId === userId) await departmentRepo.save({ ...dept, headUserId: null });
}

/** 재직자(계정 '미사용' 제외)의 인명관리 프로필. */
async function activeProfiles() {
  const [users, profiles] = await Promise.all([userRepo.listIncludingTestAccounts(), employeeProfileRepo.listIncludingTestAccounts()]);
  const active = new Set(users.filter((u) => u.status !== '미사용').map((u) => u.id));
  return { active, profiles: profiles.filter((p) => active.has(p.userId)) };
}

/**
 * 부서를 지울 수 없는 이유 — 지울 수 있으면 null.
 * 사람이 남은 채 지우면 그 사람들의 소속이 사라진다. 퇴직자는 따지지 않는다.
 */
export async function departmentDeleteBlocker(
  dept: { id: string; name: string },
  allDepts: { id: string; name: string; parentId: string | null }[],
): Promise<string | null> {
  const children = allDepts.filter((d) => d.parentId === dept.id);
  if (children.length) return `하위 부서(${children.map((d) => d.name).join(', ')})가 있어 삭제할 수 없습니다. 하위 부서를 먼저 옮기거나 삭제하세요.`;

  const { active, profiles } = await activeProfiles();
  const members = profiles.filter((p) => p.deptId === dept.id).length;
  if (members) return `소속 인원 ${members}명이 있어 삭제할 수 없습니다. 인명관리에서 다른 부서로 옮긴 뒤 삭제하세요.`;

  const concurrent = (await departmentMemberRepo.listByDeptId(dept.id)).filter((m) => !m.isPrimary && active.has(m.userId));
  if (concurrent.length) return `겸직자 ${concurrent.length}명이 있어 삭제할 수 없습니다. 인명관리에서 겸직을 해제한 뒤 삭제하세요.`;
  return null;
}

/** 직급을 지울 수 없는 이유 — 지울 수 있으면 null. */
export async function positionDeleteBlocker(positionId: string): Promise<string | null> {
  const n = (await activeProfiles()).profiles.filter((p) => p.positionId === positionId).length;
  return n ? `이 직급을 쓰는 직원 ${n}명이 있어 삭제할 수 없습니다. 인명관리에서 직급을 바꾼 뒤 삭제하세요.` : null;
}

/** 직책을 지울 수 없는 이유 — 지울 수 있으면 null. 겸직 직책도 센다. */
export async function jobTitleDeleteBlocker(jobTitleId: string): Promise<string | null> {
  const { active, profiles } = await activeProfiles();
  const ids = new Set(profiles.filter((p) => p.jobTitleId === jobTitleId).map((p) => p.userId));
  for (const m of await departmentMemberRepo.list()) {
    if (!m.isPrimary && m.jobTitleId === jobTitleId && active.has(m.userId)) ids.add(m.userId);
  }
  return ids.size ? `이 직책을 맡은 직원 ${ids.size}명이 있어 삭제할 수 없습니다. 인명관리에서 직책을 바꾼 뒤 삭제하세요.` : null;
}
