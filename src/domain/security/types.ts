import type { User } from '@/domain/user/schema';
import type { ActionPermission, RoleGroup } from '@/domain/roleGroup/schema';

/**
 * 전사 표준 데이터 열람 스코프
 * - MY_ONLY: 본인 데이터만 열람
 * - TEAM: 본인 소속 부서 데이터 열람
 * - TEAM_AND_LEADERS: 본인 부서원 + 타 부서 팀장급 데이터 열람
 * - ALL: 전사 임직원 데이터 열람
 */
export type DataScope = 'MY_ONLY' | 'TEAM' | 'TEAM_AND_LEADERS' | 'ALL';

/**
 * 조직 관계 판정 헬퍼 인터페이스
 */
export interface OrgRelationship {
  /** 특정 부서 또는 본인 소속 부서의 부서장(head) 여부 */
  isDeptHead: (deptIdOrName?: string | null) => boolean;
  /** 대상 부서가 동일 부서인지 여부 */
  isSameDept: (targetDeptIdOrName?: string | null) => boolean;
  /** 대상 부서가 본인의 조직 하위 트리에 속하는지 여부 */
  isInDeptTree?: (targetDeptIdOrName: string) => boolean;
  /** 본인이 장(head)으로 관리하는 부서명/부서ID 목록 */
  managedDeptNames: string[];
}

/**
 * 정규화된 역할 식별자 (Role)
 */
export type StandardRole =
  | 'SUPER_ADMIN' // 시스템 설정 최고 관리자
  | 'OPERATOR'    // 시스템 운영자
  | 'EXECUTIVE'   // 임원 (대표이사, 상무, 전무, 부사장, 이사 등)
  | 'HR_ADMIN'    // 인사/근태 관리자
  | 'LEADER'      // 부서장 / 팀장
  | 'USER';       // 일반 임직원

/**
 * 정책 평가 결과
 */
export interface PolicyResult {
  allowed: boolean;
  reason: string;
}

/**
 * SecurityContext: "사용자가 누구인가"를 표현하는 불변의 주체 정보
 */
export interface SecurityContext {
  user: User | null;
  userId: string;
  name: string;
  dept: string;
  position: string;
  jobTitle?: string;

  /** 활성화된 역할 목록 (정규화된 대문자 코드) */
  roles: string[];
  /** 소속된 원본 역할그룹 목록 */
  roleGroups: RoleGroup[];

  /** 최고 관리자(SUPER_ADMIN) 여부 */
  isSuperAdmin: boolean;
  /** 임원(EXECUTIVE) 여부 */
  isExecutive: boolean;
  /** 부서장/팀장(LEADER) 여부 */
  isLeader: boolean;

  /** 조직 관계 헬퍼 */
  organization: OrgRelationship;

  /** 메뉴별 Action Permission 매트릭스 */
  canMenuAction: (urlOrId: string, action: keyof ActionPermission) => boolean;
  /** 메뉴 접근 허용 여부 */
  canMenuAccess: (urlOrId: string) => boolean;
}
