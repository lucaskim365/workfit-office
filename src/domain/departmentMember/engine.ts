import type { DepartmentMember } from './schema';
import type { Department } from '@/domain/department/schema';

/**
 * 부서가 '위원회' 유형인지 판정합니다.
 */
export function isCommitteeDept(dept?: Department | null | string): boolean {
  if (!dept) return false;
  if (typeof dept === 'string') {
    return dept.includes('위원회');
  }
  return dept.deptType === '위원회' || dept.name.includes('위원회');
}

/**
 * 부서 유형에 따른 직책 유효성 보정 (위원회인 경우 직책 배제)
 * ★ 비즈니스 규칙: 위원회 부서는 직책 없음('')으로 자동 강제됩니다.
 */
export function sanitizeJobTitle(
  dept: Department | null | undefined | string,
  rawJobTitle?: string | null,
): string {
  if (isCommitteeDept(dept)) {
    return '';
  }
  return (rawJobTitle || '').trim();
}

/**
 * 복합 식별자(PK) 생성 헬퍼: DM-{userId}-{deptId}
 */
export function makeDepartmentMemberId(userId: string, deptId: string): string {
  return `DM-${userId}-${deptId}`;
}

/**
 * 사용자의 주 소속(본직, isPrimary === true)을 도출합니다.
 * 만약 isPrimary가 명시된 것이 없으면 첫 번째 항목을 주 소속으로 취급합니다.
 */
export function resolveUserPrimaryAffiliation(members: DepartmentMember[]): DepartmentMember | null {
  if (!members || members.length === 0) return null;
  return members.find((m) => m.isPrimary) || members[0] || null;
}

/**
 * 사용자의 겸직 소속(isPrimary === false) 목록을 도출합니다.
 */
export function resolveUserConcurrentAffiliations(members: DepartmentMember[]): DepartmentMember[] {
  if (!members || members.length === 0) return [];
  const primary = resolveUserPrimaryAffiliation(members);
  return members.filter((m) => m.id !== primary?.id && !m.isPrimary);
}

/**
 * 단일 주 소속 무결성 보장:
 * 특정 사용자의 부서 소속 목록을 갱신할 때, 한 항목이 isPrimary=true로 설정되면
 * 나머지 모든 소속은 isPrimary=false로 자동 강등합니다.
 */
export function enforceSinglePrimary(
  existingMembers: DepartmentMember[],
  targetDeptId: string,
  setAsPrimary: boolean,
): DepartmentMember[] {
  return existingMembers.map((m) => {
    if (m.deptId === targetDeptId) {
      return { ...m, isPrimary: setAsPrimary };
    }
    // 대상이 주 소속으로 승격되면 나머지는 모두 겸직으로 전환
    if (setAsPrimary && m.isPrimary) {
      return { ...m, isPrimary: false };
    }
    return m;
  });
}
