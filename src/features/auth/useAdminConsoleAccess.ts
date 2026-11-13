import { useAuthz } from '@/features/authz/useAuthz';

/**
 * 관리자 콘솔(/admin)에 들어갈 수 있는가 — '관리자 콘솔 접속' 권한이 있으면(콘솔 메뉴 권한을 받으면 함께 따라온다).
 * 콘솔 안에서는 받은 권한의 메뉴만 보인다. 최고 관리자는 모두.
 * 콘솔 입구(헤더 단추)와 콘솔 화면의 출입 검사가 모두 이 판정 하나를 본다.
 */
export function useAdminConsoleAccess() {
  const { canUseConsole, isLoading } = useAuthz();
  return { canUse: canUseConsole, isLoading };
}

/** 콘솔 창 이름 — 이미 열려 있으면 새 창을 또 열지 않고 그 창을 앞으로 가져온다 */
export const ADMIN_WINDOW_NAME = 'workfit-admin-console';
