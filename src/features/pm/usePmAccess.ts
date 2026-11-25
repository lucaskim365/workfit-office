import { useAuthz } from '@/features/authz/useAuthz';

/**
 * PM 권한 (설계 3.4 · 7장 12~14, 11/25 사용자 결정)
 * - 보기: 로그인한 직원 모두 (pm.view 는 1차에 판정에 안 씀)
 * - money = pm.manage: 사업 · 손익 메뉴, 지원 기준 · 품목 단가, 사업비, 다른 화면의 금액 칸(사업비 · 견적 이익률)
 * - manage = pm.manage: 사업 등록 · 정보 수정 · 삭제, 기준정보 고치기
 * CR '비용 영향'은 금액이지만 데모처럼 누구나 봄 (11/25 사용자 "최대한 데모와 비슷하게").
 */
export const PM_MANAGE_KEY = 'pm.manage';

export function usePmAccess() {
  const { can, isLoading } = useAuthz();
  const ok = !isLoading && can(PM_MANAGE_KEY);
  return { money: ok, manage: ok, loading: isLoading };
}
