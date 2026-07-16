import type { RoleGroup } from '@/domain/roleGroup/schema';
import { PERM_MENUS, PERM_COLS } from '@/domain/roleGroup/schema';

/**
 * 역할그룹 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * (와이어프레임 sub-auth.jsx 정본. 권한 매트릭스는 화면 SEED 규칙 재현)
 */
const M = PERM_MENUS.length;
const C = PERM_COLS.length;
const matrix = (fn: (mi: number, ci: number) => boolean): boolean[][] =>
  Array.from({ length: M }, (_, mi) => Array.from({ length: C }, (_, ci) => fn(mi, ci)));

export const ROLE_GROUP_SEED: RoleGroup[] = [
  {
    code: 'ADMIN', name: '관리자', use: true, desc: '전사 시스템 관리 권한. 사용자/권한/코드 전 영역 접근 가능.',
    members: [
      { name: '홍채원', code: 'cwhong' },
      { name: '김승기', code: 'sgkim' }
    ],
    permissions: matrix(() => true)
  },
  {
    code: 'OPERATOR', name: '임원', use: true, desc: '결재선 문서 모니터링 및 완료 문서 조회 권한.',
    members: [
      { name: '박영미', code: 'oilking5151' },
      { name: '손승원', code: 'swson' }
    ],
    permissions: matrix((mi, ci) => ci < 2 || mi < 2)
  },
  {
    code: 'USER', name: '일반사원', use: true, desc: '일반 사원 권한. 기본 조회 권한만 제공.',
    members: [
      { name: '류지광', code: 'jgRyu' },
      { name: '강윤석', code: 'yskang' },
      { name: '최지혜', code: 'jihye.choi' },
      { name: '홍형표', code: 'hphong' },
      { name: '박명규', code: 'pmk' },
      { name: '박광래', code: 'krpark' }
    ],
    permissions: matrix((mi, ci) => ci < 3 && mi > 3)
  },
];
