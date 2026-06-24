import type { SysAdmin } from '@/domain/sysAdmin/schema';

/**
 * 시스템 관리자 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sys-screens.UserAdminContent 의 인라인 ADMINS 이관)
 */
export const SYS_ADMIN_SEED: SysAdmin[] = [
  { id: 'admin', name: '홍길동', level: '슈퍼관리자', modules: '전체 모듈', status: '사용', twoFa: 'ON', ip: '10.20.3.0/24', lastLogin: '2026-06-09 08:41' },
  { id: 'sys_kim', name: '김철수', level: '시스템관리자', modules: '시스템·기준', status: '사용', twoFa: 'ON', ip: '10.20.3.0/24', lastLogin: '2026-06-09 08:12' },
  { id: 'ops_lee', name: '이순신', level: '운영관리자', modules: '생산·설비', status: '사용', twoFa: 'OFF', ip: '-', lastLogin: '2026-06-08 17:55' },
  { id: 'qa_kang', name: '강감찬', level: '운영관리자', modules: '품질', status: '잠금', twoFa: 'ON', ip: '-', lastLogin: '2026-06-05 09:03' },
  { id: 'adm_yoo', name: '유관순', level: '시스템관리자', modules: '시스템·리포트', status: '사용', twoFa: 'ON', ip: '10.20.3.0/24', lastLogin: '2026-06-09 07:30' },
  { id: 'ops_ahn', name: '안중근', level: '운영관리자', modules: '설비', status: '미사용', twoFa: 'OFF', ip: '-', lastLogin: '2026-05-28 14:20' },
];
