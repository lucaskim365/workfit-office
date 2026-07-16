import { type User } from '@/domain/user/schema';

/**
 * 사용자 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * Workfit Office 실제 조직도 기준 실명 재직자 10명. 조직도 상 '충원(공석)' 자리는 제외.
 * position = 직급(직급 마스터와 매칭). jobTitle = 직책(팀장·본부장·팀원 등, 조직도 직책열).
 * 팀장/본부장 직책은 department.headUserId 와도 연동. managerId = 직속 상급자(상급자 체인 원천).
 *
 * ⚠ password 는 데모 한정 평문. 전 계정 공통 초기 비밀번호 `mes1234`.
 *   자체 로그인(사번 또는 이메일 + 비밀번호). ([[firebase-backend-setup]])
 */
const DEMO_PW = '06c4371239ef075e099d6d84de05e43ad7f649fc75350eac00ce55bc859cf218';

export const USER_SEED: Omit<User, 'sealUrl' | 'photoUrl'>[] = [
  // 대표이사 (임원)
  { id: 'U001', empNo: 'oilking5151', name: '박영미', dept: '대표이사', position: '대표이사', jobTitle: '대표이사', roleGroup: 'OPERATOR', email: 'oilking5151@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:40', managerId: null, password: DEMO_PW },
  // 대표이사 직속 — 직책 재경이사 / 직급 이사 (일반사원)
  { id: 'U002', empNo: 'jkRyu', name: '류지광', dept: '대표이사 직속', position: '이사', jobTitle: '재경이사', roleGroup: 'USER', email: 'jkryu@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:31', managerId: 'U001', password: DEMO_PW },
  // AX사업본부 — 직책 본부장 / 직급 상무이사 (임원)
  { id: 'U003', empNo: 'swonSon', name: '손승원', dept: 'AX사업본부', position: '상무이사', jobTitle: '본부장', roleGroup: 'OPERATOR', email: 'swonson@workfit.kr', status: '사용', lastLogin: '2026-07-07 09:02', managerId: 'U001', password: DEMO_PW },
  // 품질관리팀 — 팀장 강윤석(직급 이사) (일반사원)
  { id: 'U006', empNo: 'yskang', name: '강윤석', dept: '품질관리팀', position: '이사', jobTitle: '팀장', roleGroup: 'USER', email: 'yskang@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:12', managerId: 'U003', password: DEMO_PW },
  { id: 'U007', empNo: 'jihye.choi', name: '최지혜', dept: '품질관리팀', position: '사원', jobTitle: '팀원', roleGroup: 'USER', email: 'jihye.choi@workfit.kr', status: '사용', lastLogin: '2026-07-06 17:55', managerId: 'U006', password: DEMO_PW },
  // 영업팀 — 팀장 홍형표(직급 부장) (일반사원)
  { id: 'U008', empNo: 'hphong', name: '홍형표', dept: '영업팀', position: '부장', jobTitle: '팀장', roleGroup: 'USER', email: 'hphong@workfit.kr', status: '사용', lastLogin: '2026-07-07 07:48', managerId: 'U003', password: DEMO_PW },
  // 사업관리팀 — 팀장 박명규(부장) / 부팀장 박광래(차장) (일반사원)
  { id: 'U009', empNo: 'pmk', name: '박명규', dept: '사업관리팀', position: '부장', jobTitle: '팀장', roleGroup: 'USER', email: 'pmk@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:05', managerId: 'U003', password: DEMO_PW },
  { id: 'U010', empNo: 'krpark', name: '박광래', dept: '사업관리팀', position: '차장', jobTitle: '부팀장', roleGroup: 'USER', email: 'krpark@workfit.kr', status: '사용', lastLogin: '2026-07-06 18:20', managerId: 'U009', password: DEMO_PW },
  // S/W 개발팀 — 팀장 김승기(부장) (관리자)
  { id: 'U011', empNo: 'sgkim', name: '김승기', dept: 'S/W 개발팀', position: '부장', jobTitle: '팀장', roleGroup: 'ADMIN', email: 'sgkim@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:41', managerId: 'U003', password: DEMO_PW },
  { id: 'U012', empNo: 'cwhong', name: '홍채원', dept: 'S/W 개발팀', position: '사원', jobTitle: '팀원', roleGroup: 'ADMIN', email: 'cwhong@workfit.kr', status: '사용', lastLogin: '2026-07-07 06:48', managerId: 'U011', password: DEMO_PW },
];
