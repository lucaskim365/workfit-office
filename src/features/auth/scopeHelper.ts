import { isTestAccount } from '@/domain/user/testAccount';
import type { User } from '@/domain/user/schema';

/**
 * 데이터 조회 스코프 표준 정의:
 * - MY_ONLY: 오직 본인 데이터만 열람 가능 (사원의 근태)
 * - TEAM: 본인 및 같은 부서 팀원/팀장 열람 가능 (사원의 업무계획, 팀장의 근태)
 * - TEAM_AND_LEADERS: 본인 부서 팀원 + 타 부서 팀장급 열람 가능 (팀장의 업무계획)
 * - ALL: 전사 모든 임직원 열람 가능 (임원/OPERATOR의 계획 및 근태)
 */
export type DataScope = 'MY_ONLY' | 'TEAM' | 'TEAM_AND_LEADERS' | 'ALL';
export type UserDataScope = DataScope; // 하위 호환용 별칭

export interface OrgContextLike {
  depts?: Array<{ id: string; name: string; headUserId?: string | null }>;
}

/**
 * 테스터 계정 여부 판별 — 프로젝트 공통 기준([[testAccount]])의 별칭.
 */
export function isTestUser(user?: { id?: string; name?: string; dept?: string; email?: string } | null): boolean {
  return isTestAccount(user);
}

/**
 * 업무계획(및 같은 범위를 쓰는 캘린더 팀 일정)의 조회 스코프를 결정합니다.
 *
 * 2026-10-06부터 직책·직급·권한별 차등 없이 **전사 공통(ALL)** 입니다.
 * 테스트 계정도 전사를 본다. 임직원에게서 테스트 계정을 숨기는 일은 사람 목록 repo 가 맡는다.
 */
export function resolveWorkPlanScope(
  user?: User | null,
  _userRoles: string[] = [],
  _org?: OrgContextLike
): DataScope {
  if (!user) return 'TEAM';
  return 'ALL';
}

/**
 * 업무계획 화면에서 특정 대상자의 업무계획을 조회할 수 있는지 판정합니다.
 * 
 * 본인은 항상, ALL 은 전사, TEAM 은 같은 부서만. 직급·직책 이름으로 범위를 넓히지 않는다.
 */
export function canViewWorkPlan(
  actor: User,
  target: User,
  actorScope: DataScope,
  _org?: OrgContextLike
): boolean {
  // 1. 본인 업무계획은 항상 열람 가능
  if (target.id === actor.id) return true;

  // 테스트 계정은 볼 수 없는 접속자의 사람 목록에서 이미 빠져 있다(repo).

  // 본인 전용 스코프인 경우
  if (actorScope === 'MY_ONLY') return false;

  // 전사 임원 스코프
  if (actorScope === 'ALL') return true;

  // 2. 같은 부서 소속 팀원 간 상호 열람 허용 (팀원끼리 업무계획 확인 로직)
  if (target.dept && actor.dept && target.dept === actor.dept) {
    return true;
  }

  // 그 밖(TEAM): 오직 본인 소속 부서 팀원들만 열람 가능 (타 부서 인원 일체 비노출)
  return false;
}
