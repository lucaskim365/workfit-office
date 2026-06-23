export interface User {
  id: string;
  empNo: string;
  name: string;
  dept: string;
  role: string;
  email: string;
  status: '활성' | '휴직' | '잠금';
  lastLogin: string;
}

/** 사용자관리 샘플 데이터 — Phase 1 후반 Firestore `users` 컬렉션으로 대체. */
export const USERS: User[] = [
  { id: 'U001', empNo: 'E2021-014', name: '김승기', dept: '시스템관리팀', role: '시스템 관리자', email: 'seunggi.kim@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 08:41' },
  { id: 'U002', empNo: 'E2019-088', name: '박민준', dept: '생산1팀', role: '생산 관리자', email: 'minjun.park@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 07:55' },
  { id: 'U003', empNo: 'E2022-131', name: '이서연', dept: '품질보증팀', role: '품질 검사원', email: 'seoyeon.lee@workfit.co.kr', status: '활성', lastLogin: '2026-06-22 18:20' },
  { id: 'U004', empNo: 'E2018-052', name: '최도현', dept: '설비보전팀', role: '설비 엔지니어', email: 'dohyun.choi@workfit.co.kr', status: '휴직', lastLogin: '2026-05-30 14:02' },
  { id: 'U005', empNo: 'E2023-007', name: '정하윤', dept: '생산2팀', role: '현장 작업자', email: 'hayoon.jung@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 06:30' },
  { id: 'U006', empNo: 'E2020-076', name: '강지호', dept: '자재관리팀', role: '자재 담당자', email: 'jiho.kang@workfit.co.kr', status: '잠금', lastLogin: '2026-06-19 11:47' },
  { id: 'U007', empNo: 'E2021-099', name: '윤채원', dept: '품질보증팀', role: '품질 관리자', email: 'chaewon.yoon@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 09:02' },
  { id: 'U008', empNo: 'E2017-033', name: '임건우', dept: '생산1팀', role: '현장 반장', email: 'gunwoo.lim@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 05:58' },
  { id: 'U009', empNo: 'E2022-045', name: '한소율', dept: '설비보전팀', role: '설비 엔지니어', email: 'soyul.han@workfit.co.kr', status: '활성', lastLogin: '2026-06-22 22:14' },
  { id: 'U010', empNo: 'E2019-120', name: '오태경', dept: '경영지원팀', role: '리포트 열람자', email: 'taekyung.oh@workfit.co.kr', status: '휴직', lastLogin: '2026-06-10 16:33' },
  { id: 'U011', empNo: 'E2023-061', name: '신유진', dept: '생산2팀', role: '현장 작업자', email: 'yujin.shin@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 06:48' },
  { id: 'U012', empNo: 'E2020-018', name: '서준호', dept: '자재관리팀', role: '자재 관리자', email: 'junho.seo@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 08:05' },
  { id: 'U013', empNo: 'E2018-094', name: '배예린', dept: '품질보증팀', role: '품질 검사원', email: 'yerin.bae@workfit.co.kr', status: '잠금', lastLogin: '2026-06-15 13:21' },
  { id: 'U014', empNo: 'E2021-072', name: '문성민', dept: '생산1팀', role: '생산 계획자', email: 'seongmin.moon@workfit.co.kr', status: '활성', lastLogin: '2026-06-23 07:12' },
];
