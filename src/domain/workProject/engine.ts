import type { WorkProject } from './schema';

export interface ProjectAccessContext {
  userId: string;
  deptId: string | null;
  active: boolean;
  /**
   * 시스템 관리자 여부(`users.roleGroup === 'ADMIN'`).
   *
   * 관리자는 참여자·소유자 판정을 건너뛴다 — 남의 프로젝트를 손봐야 하는 상황(담당자
   * 퇴사, 잘못 만든 트리 정리, 장애 대응)에서 소유자를 찾아다니게 두면 도구가 멈춘다.
   * 자원예약·전자설문이 이미 같은 축(`roleGroup === 'ADMIN'`)을 쓴다.
   *
   * 열람이 아니라 **편집**을 뚫는 장치다. 삭제까지 열리므로 부여를 아껴야 한다.
   */
  isAdmin?: boolean;
}

/** 관리자는 활성 계정일 때만 통한다 — 잠긴 계정에 만능 권한을 주면 안 된다. */
export function isProjectAdmin(actor: ProjectAccessContext): boolean {
  return actor.active && actor.isAdmin === true;
}

export type ProjectDomainErrorCode = 'FORBIDDEN' | 'INVALID_PROJECT';

export class ProjectDomainError extends Error {
  constructor(public readonly code: ProjectDomainErrorCode, message: string) {
    super(message);
    this.name = 'ProjectDomainError';
  }
}

export function canViewProject(actor: ProjectAccessContext, project: WorkProject): boolean {
  if (!actor.active) return false;
  if (isProjectAdmin(actor)) return true;
  if (project.ownerUserId === actor.userId || project.memberUserIds.includes(actor.userId)) return true;
  if (project.visibility === 'COMPANY') return true;
  return project.visibility === 'TEAM' && actor.deptId !== null && actor.deptId === project.deptId;
}

export function canCreateProject(actor: ProjectAccessContext): boolean {
  return actor.active;
}

export function canManageProject(actor: ProjectAccessContext, project: WorkProject): boolean {
  if (!actor.active || project.status === 'ARCHIVED') return false;
  return isProjectAdmin(actor) || project.ownerUserId === actor.userId;
}

export function assertCanCreateProject(actor: ProjectAccessContext): void {
  if (!canCreateProject(actor)) {
    throw new ProjectDomainError('FORBIDDEN', '사용 중인 계정만 프로젝트를 만들 수 있습니다.');
  }
}

export function assertCanManageProject(actor: ProjectAccessContext, project: WorkProject): void {
  if (!canManageProject(actor, project)) {
    throw new ProjectDomainError('FORBIDDEN', '프로젝트 소유자만 프로젝트를 수정할 수 있습니다.');
  }
}
