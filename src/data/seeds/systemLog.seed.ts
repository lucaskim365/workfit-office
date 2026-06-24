import type { SystemLog } from '@/domain/systemLog/schema';

/**
 * 시스템 로그 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sys-screens.LogMgmtContent 의 인라인 mock 이관)
 * PK(id)는 LOG-01~ 결정적 부여.
 */
export const SYSTEM_LOG_SEED: SystemLog[] = [
  { id: 'LOG-01', at: '2026-06-09 14:22:11', user: 'A12345 홍길동', type: '변경', screen: '품목정보', detail: 'UPDATE · WF-200-A 안전재고 500→600', ip: '10.20.3.14' },
  { id: 'LOG-02', at: '2026-06-09 14:08:55', user: 'B22120 이순신', type: '접속', screen: '로그인', detail: 'LOGIN SUCCESS', ip: '10.20.3.51' },
  { id: 'LOG-03', at: '2026-06-09 13:51:02', user: 'A67890 김철수', type: '변경', screen: '작업 지시', detail: 'INSERT · WO-20260609-022', ip: '10.20.3.22' },
  { id: 'LOG-04', at: '2026-06-09 13:30:40', user: 'C77201 유관순', type: '접속', screen: '로그아웃', detail: 'LOGOUT', ip: '10.20.3.77' },
  { id: 'LOG-05', at: '2026-06-09 12:47:18', user: 'A12345 홍길동', type: '변경', screen: '그룹권한관리', detail: 'UPDATE · ADMIN 권한 수정', ip: '10.20.3.14' },
  { id: 'LOG-06', at: '2026-06-09 11:20:33', user: 'B53410 강감찬', type: '접속', screen: '로그인 실패', detail: 'LOGIN FAIL (비밀번호 오류)', ip: '10.20.3.99' },
];
