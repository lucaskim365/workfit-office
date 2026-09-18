import type { DataScope, SecurityContext } from '../types';

/**
 * 업무계획(To-Do / 실적) 도메인 접근 정책 (WorkPlanPolicy)
 * 
 * [원칙]
 * 1. 임원 (EXECUTIVE): 전사 스코프 (ALL)
 * 2. 부서장 / 팀장 (isLeader / isDeptHead): 본인 부서원 + 타 부서 팀장급 스코프 (TEAM_AND_LEADERS)
 * 3. 일반 사원: 본인 소속 부서 스코프 (TEAM - 팀 내 업무 공유)
 */
export const workPlanPolicy = {
  /**
   * 업무계획 종합 현황 메뉴 접근 권한 판정
   * - 기본 직책 규칙: 팀장(isLeader) 또는 임원(isExecutive)은 자동으로 메뉴 열림 (권한그룹 생성 불필요)
   * - 커스텀 확장 규칙: 일반 사원이라도 그룹권한관리에서 체크된 경우(예: 추후 신설될 인사팀 등) 열림
   */
  canAccessWorkPlanAdmin(context: SecurityContext): boolean {
    if (!context.user) return false;
    // ⚠️ 최고관리자(isSuperAdmin)라도 비임원/비팀장인 개발자는 전사 업무 종합 모니터링 자동 오픈에서 제외 (임원/팀장/인사위임자 전용)
    if (context.isExecutive) return true;
    if (context.isLeader || context.organization.isDeptHead(context.dept)) return true;
    return (
      context.canMenuAccess('S_GW_WORK_PLAN_ADMIN') ||
      context.canMenuAccess('/gw/work-plan/admin')
    );
  },

  /**
   * 업무계획 데이터 조회 스코프 도출
   */
  getScope(context: SecurityContext): DataScope {
    if (!context.user) return 'TEAM';

    // 1. 임원, 운영자, 또는 그룹권한관리에서 직접 관제 권한을 부여받은 인사/감사 담당자 -> 전사 스코프 (ALL)
    if (
      context.isExecutive ||
      context.roles.includes('OPERATOR') ||
      context.roles.includes('EXEC') ||
      context.roles.includes('HR_ADMIN') ||
      // 비팀장/비임원이지만 그룹권한관리에서 명시적으로 권한을 부여받은 경우(인사팀원 등)
      (!context.isLeader && (
        context.canMenuAccess('S_GW_WORK_PLAN_ADMIN') ||
        context.canMenuAccess('/gw/work-plan/admin')
      ))
    ) {
      return 'ALL';
    }

    // 2. 부서장 / 팀장 -> 팀원 + 타 부서 팀장급 스코프 (TEAM_AND_LEADERS)
    if (context.isLeader || context.organization.isDeptHead(context.dept)) {
      return 'TEAM_AND_LEADERS';
    }

    // 3. 일반 사원 -> 소속 부서 스코프 (TEAM)
    return 'TEAM';
  },

  /**
   * 팀원 업무계획 모니터링 관리 권한 여부
   */
  canManageTeamWorkPlan(context: SecurityContext): boolean {
    return this.canAccessWorkPlanAdmin(context);
  },

  /**
   * 특정 사용자의 업무계획을 열람할 수 있는지 여부
   */
  canViewUser(
    context: SecurityContext,
    targetUser: { id: string; dept?: string | null; position?: string | null; isLeader?: boolean }
  ): boolean {
    if (!context.user) return false;
    if (context.userId === targetUser.id) return true;

    const scope = this.getScope(context);
    if (scope === 'ALL') return true;

    // 소속 부서원인 경우
    if (context.organization.isSameDept(targetUser.dept)) return true;

    // TEAM_AND_LEADERS 스코프인 경우 타 부서 팀장급도 열람 가능
    if (scope === 'TEAM_AND_LEADERS' && targetUser.isLeader) {
      return true;
    }

    return false;
  },
};
