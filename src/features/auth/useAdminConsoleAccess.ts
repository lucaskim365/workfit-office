import { usePermission } from './usePermission';

/**
 * 관리자 콘솔(/admin)에 들어갈 수 있는가 — 지금은 역할관리의 최고 관리자(ADMIN 그룹)와 같다.
 *
 * 콘솔 입구(헤더 단추)와 콘솔 화면의 출입 검사가 모두 이 판정 하나를 본다.
 * 나중에 다른 역할에도 콘솔을 열어 주려면(예: 콘솔 전용 역할 등록) 여기만 고치면 된다.
 */
export function useAdminConsoleAccess() {
  const { isSuperAdmin, isLoading, user } = usePermission();
  return { canUse: Boolean(user) && isSuperAdmin, isLoading };
}

/** 콘솔 창 이름 — 이미 열려 있으면 새 창을 또 열지 않고 그 창을 앞으로 가져온다 */
export const ADMIN_WINDOW_NAME = 'workfit-admin-console';
