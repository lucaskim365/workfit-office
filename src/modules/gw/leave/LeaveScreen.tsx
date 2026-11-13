import { useAuthz } from '@/features/authz/useAuthz';
import { Navigate } from 'react-router-dom';

/**
 * 휴가 관리 라우트 (/gw/leave)
 *
 * 권한에 따라 /gw/commute 로 안전하게 라우팅합니다:
 * - 전사 권한자: /gw/commute?tab=team&adminTab=leave_ledger (전사 연차 원장 대시보드)
 * - 일반 사원: /gw/commute?tab=leave (내 연차·휴가 화면)
 */
export default function LeaveScreen() {
  const { commuteScope: authzCommuteScope } = useAuthz();
  const commuteScope = authzCommuteScope();
  const canAll = commuteScope === 'ALL';

  if (canAll) {
    return <Navigate to="/gw/commute?tab=team&adminTab=leave_ledger" replace />;
  }

  return <Navigate to="/gw/commute" replace />;
}
