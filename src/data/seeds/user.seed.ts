import { DEFAULT_USER_PASSWORD, type User } from '@/domain/user/schema';

/**
 * 사용자 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * Workfit Office 실제 조직도 기준 실명 재직자 10명. 조직도 상 '충원(공석)' 자리는 제외.
 * position = 직급(직급 마스터와 매칭). jobTitle = 직책(팀장·본부장·팀원 등, 조직도 직책열).
 * 팀장/본부장 직책은 department.headUserId 와도 연동. managerId = 직속 상급자(상급자 체인 원천).
 *
 * ⚠ password 는 데모 한정 평문. 전 계정 공통 초기 비밀번호 `mes1234`.
 *   자체 로그인(사번 또는 이메일 + 비밀번호). ([[firebase-backend-setup]])
 */
const DEMO_PW = DEFAULT_USER_PASSWORD;

export const USER_SEED: User[] = [
  // 대표이사
  { id: 'U001', empNo: '100001', name: '박영미', dept: '대표이사', position: '대표이사', jobTitle: '대표이사', roleGroup: 'ADMIN', email: 'ympark@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:40', managerId: null, password: DEMO_PW },
  // 대표이사 직속 — 직책 재경이사 / 직급 이사
  { id: 'U002', empNo: '100002', name: '류지광', dept: '대표이사 직속', position: '이사', jobTitle: '재경이사', roleGroup: 'ADMIN', email: 'jgryu@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:31', managerId: 'U001', password: DEMO_PW },
  // AX사업본부 — 직책 본부장 / 직급 상무이사
  { id: 'U003', empNo: '200001', name: '손승원', dept: 'AX사업본부', position: '상무이사', jobTitle: '본부장', roleGroup: 'ADMIN', email: 'smartfactory@workfit.kr', status: '사용', lastLogin: '2026-07-07 09:02', managerId: 'U001', password: DEMO_PW },
  // 품질관리팀 — 팀장 강윤석(직급 이사)
  { id: 'U006', empNo: '300001', name: '강윤석', dept: '품질관리팀', position: '이사', jobTitle: '팀장', roleGroup: 'QC_USER', email: 'yskang@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:12', managerId: 'U003', password: DEMO_PW },
  { id: 'U007', empNo: '300002', name: '최지혜', dept: '품질관리팀', position: '사원', jobTitle: '팀원', roleGroup: 'QC_USER', email: 'jhchoi@workfit.kr', status: '사용', lastLogin: '2026-07-06 17:55', managerId: 'U006', password: DEMO_PW },
  // 영업팀 — 팀장 홍형표(직급 부장)
  { id: 'U008', empNo: '400001', name: '홍형표', dept: '영업팀', position: '부장', jobTitle: '팀장', roleGroup: 'OPERATOR', email: 'hphong@workfit.kr', status: '사용', lastLogin: '2026-07-07 07:48', managerId: 'U003', password: DEMO_PW },
  // 사업관리팀 — 팀장 박명규(부장) / 부팀장 박광래(차장)
  { id: 'U009', empNo: '500001', name: '박명규', dept: '사업관리팀', position: '부장', jobTitle: '팀장', roleGroup: 'OPERATOR', email: 'mgpark@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:05', managerId: 'U003', password: DEMO_PW },
  { id: 'U010', empNo: '500002', name: '박광래', dept: '사업관리팀', position: '차장', jobTitle: '부팀장', roleGroup: 'OPERATOR', email: 'grpark@workfit.kr', status: '사용', lastLogin: '2026-07-06 18:20', managerId: 'U009', password: DEMO_PW },
  // S/W 개발팀 — 팀장 김승기(부장)
  { id: 'U011', empNo: '600001', name: '김승기', dept: 'S/W 개발팀', position: '부장', jobTitle: '팀장', roleGroup: 'ADMIN', email: 'sgkim@workfit.kr', status: '사용', lastLogin: '2026-07-07 08:41', managerId: 'U003', password: DEMO_PW },
  { id: 'U012', empNo: '600002', name: '홍채원', dept: 'S/W 개발팀', position: '사원', jobTitle: '팀원', roleGroup: 'OPERATOR', email: 'cwhong@workfit.kr', status: '사용', lastLogin: '2026-07-07 06:48', managerId: 'U011', password: DEMO_PW },
];
