import { useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { checkUserChangeLockout } from '@/domain/authz/audit';
import type { AuthzUser } from '@/domain/authz/engine';
import { useAuthzDraft } from './useAuthzDraft';

const LOCKOUT_MSG = '로그인할 수 있는 최고 관리자가 한 명도 남지 않아 저장할 수 없습니다. 다른 사람을 먼저 최고 관리자로 지정하세요.';
const SELF_MSG = '이대로 저장하면 본인의 최고 관리자 권한이 없어져 관리자 콘솔을 쓸 수 없게 됩니다. 계속할까요?';

/**
 * 직원 정보를 바꾸기 전 잠금 방지 검사 — 미사용·퇴직·부서/직급 변경·삭제로 최고 관리자가 0명이 되면 막고,
 * 본인이 최고 관리자에서 빠지면 한 번 더 묻는다. 통과하면 true.
 */
export function useUserLockoutGuard() {
  const { user: me } = useAuth();
  const { ready, roles, assignments, org, authzOrg } = useAuthzDraft();
  return useCallback(
    (p: { changed?: AuthzUser[]; removedIds?: string[] }) => {
      if (!ready || roles.length === 0) return true; // 새 권한 체계로 옮기기 전
      const res = checkUserChangeLockout({ users: org.users, ...p, org: authzOrg, roles, assignments, meId: me?.id });
      if (res.block) {
        alert(LOCKOUT_MSG);
        return false;
      }
      return !res.selfLoss || confirm(SELF_MSG);
    },
    [ready, roles, assignments, org.users, authzOrg, me?.id],
  );
}
