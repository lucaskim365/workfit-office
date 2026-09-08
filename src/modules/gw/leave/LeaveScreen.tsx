import { Navigate } from 'react-router-dom';

/**
 * 휴가관리 화면 — 근태와 통합되어 /gw/commute?tab=leave 로 리다이렉트됩니다.
 * 기존 북마크나 권한 체계와의 하위 호환성을 완벽히 유지합니다.
 */
export default function LeaveScreen() {
  return <Navigate to="/gw/commute?tab=leave" replace />;
}
