import type { User } from '@/domain/user/schema';

/**
 * 사용자 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * (와이어프레임 admin-screens.UserMgmtContent 기준)
 */
export const USER_SEED: User[] = [
  { id: 'U001', empNo: 'A12345', name: '김승기', dept: '시스템관리팀', position: '관리자', roleGroup: 'ADMIN', email: 'seunggi.kim@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 08:41' },
  { id: 'U002', empNo: 'A67890', name: '문성민', dept: '생산1팀', position: '파트장', roleGroup: 'MT_ADMIN', email: 'seongmin.moon@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 08:12' },
  { id: 'U003', empNo: 'B22120', name: '이서연', dept: '품질보증팀', position: '담당', roleGroup: 'QC_USER', email: 'seoyeon.lee@workfit.co.kr', status: '사용', lastLogin: '2026-06-22 17:55' },
  { id: 'U004', empNo: 'B53410', name: '정하윤', dept: '생산2팀', position: '담당', roleGroup: 'MT_USER', email: 'hayoon.jung@workfit.co.kr', status: '잠금', lastLogin: '2026-06-05 09:03' },
  { id: 'U005', empNo: 'C77201', name: '임건우', dept: '현장관리팀', position: '반장', roleGroup: 'FIELD_ADMIN', email: 'gunwoo.lim@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 07:30' },
  { id: 'U006', empNo: 'C90112', name: '안중근', dept: '설비보전팀', position: '담당', roleGroup: 'OPERATOR', email: 'jungeun.an@workfit.co.kr', status: '미사용', lastLogin: '2026-05-28 14:20' },
  { id: 'U007', empNo: 'A21099', name: '윤채원', dept: '품질보증팀', position: '파트장', roleGroup: 'QC_USER', email: 'chaewon.yoon@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 09:02' },
  { id: 'U008', empNo: 'D45100', name: '박민준', dept: '생산1팀', position: '관리자', roleGroup: 'MT_ADMIN', email: 'minjun.park@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 07:55' },
  { id: 'U009', empNo: 'D45221', name: '신유진', dept: '생산2팀', position: '담당', roleGroup: 'MT_USER', email: 'yujin.shin@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 06:48' },
  { id: 'U010', empNo: 'C33012', name: '한소율', dept: '설비보전팀', position: '담당', roleGroup: 'OPERATOR', email: 'soyul.han@workfit.co.kr', status: '사용', lastLogin: '2026-06-22 22:14' },
  { id: 'U011', empNo: 'B53999', name: '배예린', dept: '품질보증팀', position: '담당', roleGroup: 'QC_USER', email: 'yerin.bae@workfit.co.kr', status: '잠금', lastLogin: '2026-06-15 13:21' },
  { id: 'U012', empNo: 'D45777', name: '서준호', dept: '자재관리팀', position: '관리자', roleGroup: 'FIELD_ADMIN', email: 'junho.seo@workfit.co.kr', status: '사용', lastLogin: '2026-06-23 08:05' },
];
