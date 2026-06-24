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
  { code: 'ADMIN', name: '관리자 그룹', use: true, desc: '전사 시스템 관리 권한 그룹. 사용자/권한/코드 전 영역 접근 가능.',
    members: [{ name: '김승기', code: 'A12345' }, { name: '오태경', code: 'A67890' }],
    permissions: matrix(() => true) },
  { code: 'OPERATOR', name: '운영자 그룹', use: true, desc: '운영 모니터링 및 기준정보 조회 중심 권한.',
    members: [{ name: '박민준', code: 'B10021' }],
    permissions: matrix((mi, ci) => ci < 2 || mi < 2) },
  { code: 'FIELD_ADMIN', name: '현장관리자 그룹', use: true, desc: '현장 생산·실적 등록 및 설비 상태 제어 권한.',
    members: [{ name: '임건우', code: 'C33012' }],
    permissions: matrix((mi, ci) => ci < 4 && mi > 1) },
  { code: 'MT_ADMIN', name: '생산 관리자', use: true, desc: '생산계획·작업지시 관리 권한.',
    members: [{ name: '문성민', code: 'D45100' }],
    permissions: matrix((_, ci) => ci < 4) },
  { code: 'MT_USER', name: '생산 담당자 그룹', use: true, desc: '생산 실적 입력 권한.',
    members: [{ name: '정하윤', code: 'D45221' }],
    permissions: matrix((_, ci) => ci < 2) },
  { code: 'QC_USER', name: '품질 담당자 그룹', use: true, desc: '품질 검사·판정 등록 권한.',
    members: [{ name: '이서연', code: 'Q22013' }],
    permissions: matrix((mi, ci) => ci < 3 && mi > 3) },
];
