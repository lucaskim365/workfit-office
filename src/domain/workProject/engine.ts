import type { WorkProject } from './schema';

export interface ProjectAccessContext {
  userId: string;
  deptId: string | null;
  active: boolean;
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
  if (project.ownerUserId === actor.userId || project.memberUserIds.includes(actor.userId)) return true;
  if (project.visibility === 'COMPANY') return true;
  return project.visibility === 'TEAM' && actor.deptId !== null && actor.deptId === project.deptId;
}

export function canCreateProject(actor: ProjectAccessContext): boolean {
  return actor.active;
}

export function canManageProject(actor: ProjectAccessContext, project: WorkProject): boolean {
  return actor.active && project.ownerUserId === actor.userId && project.status !== 'ARCHIVED';
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
