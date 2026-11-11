/** 역할 — 권한 묶음 (authRoles) */
export type AuthRoleKind = 'super' | 'base' | 'custom';

export interface AuthRole {
  id: string;
  name: string;
  desc: string;
  permissions: string[];
  kind: AuthRoleKind;
  use: boolean;
  sort: number;
  /** 변환 출처(옛 그룹 이름·규칙). 새로 만든 역할은 빈 값 */
  migratedFrom?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** 지정 — 역할을 누구에게, 어느 범위로 (authAssignments) */
export type AuthTargetType = 'USER' | 'DEPT' | 'POSITION' | 'DEPT_HEAD';
export type AuthScopeType = 'ALL' | 'OWN_DEPT' | 'DEPTS';

export interface AuthAssignment {
  id: string;
  roleId: string;
  targetType: AuthTargetType;
  /** 사용자 id · 부서 id · 직급 id. 부서장(DEPT_HEAD)은 빈 값 */
  targetId: string;
  /** 부서 대상: 하위 부서 사람 포함 */
  targetSub: boolean;
  /** 직급 대상: 그 직급만(EQ) / 그 직급 이상(GTE) */
  positionMode: 'EQ' | 'GTE';
  scopeType: AuthScopeType;
  scopeDeptIds: string[];
  /** 범위에 하위 부서 포함 */
  scopeSub: boolean;
  regBy?: string;
  regAt?: string;
}

export const TARGET_TYPE_LABEL: Record<AuthTargetType, string> = {
  USER: '사람',
  DEPT: '부서',
  POSITION: '직급',
  DEPT_HEAD: '부서장',
};

export const SCOPE_TYPE_LABEL: Record<AuthScopeType, string> = {
  ALL: '전사',
  OWN_DEPT: '본인 소속 부서',
  DEPTS: '지정 조직',
};
