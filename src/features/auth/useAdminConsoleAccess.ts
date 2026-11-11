import { useAuthz } from '@/features/authz/useAuthz';

/**
 * 관리자 콘솔(/admin)에 들어갈 수 있는가 — 관리자 권한(콘솔 화면 권한)이 하나라도 있으면.
 * 새 권한 체계로 옮기기 전에는 예전처럼 최고 관리자만.
 * 콘솔 입구(헤더 단추)와 콘솔 화면의 출입 검사가 모두 이 판정 하나를 본다.
 */
export function useAdminConsoleAccess() {
  const { canUseConsole, isLoading } = useAuthz();
  return { canUse: canUseConsole, isLoading };
}

/** 콘솔 창 이름 — 이미 열려 있으면 새 창을 또 열지 않고 그 창을 앞으로 가져온다 */
export const ADMIN_WINDOW_NAME = 'workfit-admin-console';
