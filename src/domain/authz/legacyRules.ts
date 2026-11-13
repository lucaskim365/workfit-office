import type { User } from '@/domain/user/schema';

/**
 * 예전 이름 판정(직급·직책·이름에 '팀장'·'이사' 등이 들어가면 부서장·임원으로 본 규칙).
 * 새 권한 체계로 옮기기 전의 판정과 옮기기 비교표에만 쓴다 — 업무 화면은 쓰지 않는다.
 */
interface OrgContextLike {
  depts?: Array<{ id: string; name: string; headUserId?: string | null }>;
}

const LEADER_TITLES = ['팀장', '부서장', '파트장', '실장', '본부장', '그룹장', '센터장', '지사장', 'leader', 'manager', 'head'];
const EXEC_TITLES = ['대표이사', '대표', '상무', '상무이사', '전무', '부사장', '사장', '이사', '임원'];


/**
 * 임원 여부 판별 (역할그룹 OPERATOR/EXEC 또는 직급/직책에 임원 명칭 포함)
 */
export function isExecutiveUser(
  user?: User | null,
  userRoles: string[] = []
): boolean {
  if (!user) return false;
  if (
    userRoles.includes('OPERATOR') ||
    userRoles.includes('EXEC') ||
    userRoles.includes('EXECUTIVE')
  ) {
    return true;
  }
  const p = (user.position ?? '').trim();
  const j = (user.jobTitle ?? '').trim();
  return EXEC_TITLES.some((title) => p.includes(title) || j.includes(title));
}

/**
 * 직책/직급 텍스트 및 조직도 부서장 지정 여부로부터 팀장급 이상 직책 여부를 판별합니다.
 */
export function isLeaderPosition(
  position?: string | null,
  jobTitle?: string | null,
  userId?: string | null,
  org?: OrgContextLike
): boolean {
  if (userId && org?.depts?.some((d) => d.headUserId === userId)) {
    return true;
  }
  const p = (position ?? '').trim().toLowerCase();
  const j = (jobTitle ?? '').trim().toLowerCase();
  const u = (userId ?? '').trim().toLowerCase();

  // 테스트 부서장 및 명시적 리더 ID 패턴 지원
  if (u === 'testb' || u.includes('부서장') || u.includes('팀장')) {
    return true;
  }

  return LEADER_TITLES.some((title) => p.includes(title) || j.includes(title));
}

/**
 * 팀장/부서장 여부 종합 판별 (역할그룹 LEADER 포함)
 */
export function isLeaderUser(
  user?: User | null,
  userRoles: string[] = [],
  org?: OrgContextLike
): boolean {
  if (!user) return false;
  if (userRoles.includes('LEADER') || userRoles.includes('ROLE_LEADER')) {
    return true;
  }
  const name = (user.name ?? '').trim().toLowerCase();
  if (name.includes('부서장') || name.includes('팀장') || name === 'testb') {
    return true;
  }
  return isLeaderPosition(user.position, user.jobTitle, user.id, org);
}

