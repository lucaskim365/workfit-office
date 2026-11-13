import type { AuthAssignment } from './types';
import { SCOPE_TYPE_LABEL } from './types';
import type { AuthzOrg } from './engine';

/** 지정 대상 표시 — 화면·변경 기록 공용 */
export function targetText(a: AuthAssignment, org: AuthzOrg, users: { id: string; name: string; dept?: string; position?: string }[]): { main: string; sub: string } {
  switch (a.targetType) {
    case 'USER': {
      const u = users.find((x) => x.id === a.targetId);
      return { main: u?.name ?? '퇴사·삭제된 사용자', sub: u ? [u.dept, u.position].filter(Boolean).join(' · ') : '' };
    }
    case 'DEPT':
      return { main: org.depts.find((d) => d.id === a.targetId)?.name ?? '삭제된 부서', sub: a.targetSub ? '하위 부서 포함' : '이 부서만' };
    case 'POSITION':
      return { main: org.positions.find((p) => p.id === a.targetId)?.name ?? '삭제된 직급', sub: a.positionMode === 'GTE' ? '이 직급 이상' : '이 직급만' };
    case 'DEPT_HEAD':
      return { main: '모든 부서장', sub: '조직도에서 부서장으로 지정된 사람' };
  }
}

export function scopeText(a: Pick<AuthAssignment, 'scopeType' | 'scopeDeptIds' | 'scopeSub'>, org: AuthzOrg): string {
  if (a.scopeType === 'DEPTS') {
    const names = a.scopeDeptIds.map((id) => org.depts.find((d) => d.id === id)?.name ?? '삭제된 부서');
    return `${names.join(', ') || '조직 없음'}${a.scopeSub ? ' (하위 포함)' : ''}`;
  }
  if (a.scopeType === 'OWN_DEPT') return `${SCOPE_TYPE_LABEL.OWN_DEPT}${a.scopeSub ? ' (하위 포함)' : ''}`;
  return SCOPE_TYPE_LABEL.ALL;
}
