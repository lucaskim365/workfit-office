import type { AuthRole } from '@/domain/authRole/schema';

/**
 * 권한 역할 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (AuthMgmtScreen 의 인라인 ROLES + 권한 매트릭스 SEED 이관)
 *
 * permissions 의 각 행은 화면 상수 MENUS 와 동일 순서로 7개:
 * ['운영 현황','기준 정보','생산 관리','설비 관리','품질 관리','리포트','시스템 관리']
 * 각 행 = [접근(조회), 수정].
 */
export const AUTH_ROLE_SEED: AuthRole[] = [
  {
    code: 'OPERATOR',
    name: '작업자',
    // [i < 5, false] — 운영~품질 접근, 리포트·시스템 차단, 수정 전무
    permissions: [
      [true, false],
      [true, false],
      [true, false],
      [true, false],
      [true, false],
      [false, false],
      [false, false],
    ],
  },
  {
    code: 'LEADER',
    name: '반장',
    // [i < 6, i >= 2 && i <= 4] — 운영~리포트 접근, 생산·설비·품질 수정
    permissions: [
      [true, false],
      [true, false],
      [true, true],
      [true, true],
      [true, true],
      [true, false],
      [false, false],
    ],
  },
  {
    code: 'MANAGER',
    name: '관리자',
    permissions: [
      [true, false],
      [true, true],
      [true, true],
      [true, true],
      [true, true],
      [true, false],
      [true, false],
    ],
  },
  {
    code: 'SYS_ADMIN',
    name: '시스템관리자',
    // 전 메뉴 접근·수정
    permissions: [
      [true, true],
      [true, true],
      [true, true],
      [true, true],
      [true, true],
      [true, true],
      [true, true],
    ],
  },
];
