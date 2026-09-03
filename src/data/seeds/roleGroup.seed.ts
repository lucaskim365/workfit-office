import type { RoleGroup } from '@/domain/roleGroup/schema';
import { PERM_MENUS, PERM_COLS, SYSTEM_SCREENS } from '@/domain/roleGroup/schema';

const M = PERM_MENUS.length;
const C = PERM_COLS.length;
const matrix = (fn: (mi: number, ci: number) => boolean): boolean[][] =>
  Array.from({ length: M }, (_, mi) => Array.from({ length: C }, (_, ci) => fn(mi, ci)));

/** 1. 최고 관리자 (전사 전권) */
const adminPermissions = () => {
  const map: Record<string, any> = {};
  SYSTEM_SCREENS.forEach((s) => {
    map[s.id] = { access: true, create: true, update: true, delete: true };
  });
  return map;
};

/** 2. 임원 (경영진) 권한 (그룹웨어 + 경영/운영 + 영업현황 + 결재모니터링 조회) */
const execPermissions = () => {
  const map: Record<string, any> = {};
  SYSTEM_SCREENS.forEach((s) => {
    const isGw = s.category === 'GW';
    const isExec = s.category === 'EXEC';
    const isSales = s.category === 'SALES';
    const isMon = ['/base/approval-monitor', '/base/user', '/base/department', '/base/position'].includes(s.url);
    const canView = isGw || isExec || isSales || isMon;

    map[s.id] = {
      access: canView,
      create: isGw,
      update: isGw,
      delete: false,
    };
  });
  return map;
};

/** 3. 재무관리자 권한 (그룹웨어 + 영업/수주 전권 + 거래처/코드 + 결재모니터링) */
const financeAdminPermissions = () => {
  const map: Record<string, any> = {};
  SYSTEM_SCREENS.forEach((s) => {
    const isGw = s.category === 'GW';
    const isSales = s.category === 'SALES';
    const isFinanceTarget = ['/base/vendor', '/base/code', '/base/approval-monitor', '/exec'].includes(s.url);
    const canAccess = isGw || isSales || isFinanceTarget;

    map[s.id] = {
      access: canAccess,
      create: isGw || isSales || ['/base/vendor', '/base/code'].includes(s.url),
      update: isGw || isSales || ['/base/vendor', '/base/code'].includes(s.url),
      delete: isSales,
    };
  });
  return map;
};

/** 4. 일반 사원 권한 (그룹웨어 모듈 중심 기본 사용) */
const userPermissions = () => {
  const map: Record<string, any> = {};
  SYSTEM_SCREENS.forEach((s) => {
    const isGw = s.category === 'GW';
    map[s.id] = {
      access: isGw,
      create: isGw,
      update: isGw,
      delete: false,
    };
  });
  return map;
};

/** 그룹 코드 및 명칭에 따른 기본 권한 매트릭스 도출 헬퍼 */
export function getDefaultPermissionsForGroup(code: string, name = ''): Record<string, any> {
  const c = code.toUpperCase();
  const n = name.toLowerCase();
  if (c === 'ADMIN' || n.includes('관리자') || n.includes('admin')) {
    return adminPermissions();
  }
  if (c === 'EXEC' || c === 'OPERATOR' || n.includes('임원') || n.includes('운영') || n.includes('경영')) {
    return execPermissions();
  }
  if (c === 'FINANCE_ADMIN' || c === 'FINANCE' || c === 'QC_USER' || n.includes('재무') || n.includes('회계')) {
    return financeAdminPermissions();
  }
  return userPermissions();
}

export const ROLE_GROUP_SEED: RoleGroup[] = [
  {
    id: 'ADMIN',
    code: 'ADMIN',
    name: '관리자',
    use: true,
    isSystem: true,
    desc: '시스템 전역 설정, 그룹권한 관리, 사용자 및 전사 모니터링 등 시스템 전권을 보유한 최고 관리자 그룹입니다.',
    userIds: [],
    deptIds: ['D240'], // 데이터플랫폼 개발팀 (부서 ID 기반)
    positionRanks: [],
    menuPermissions: adminPermissions(),
    members: [],
    permissions: matrix(() => true),
  },
  {
    id: 'EXEC',
    code: 'EXEC',
    name: '임원',
    use: true,
    isSystem: false,
    desc: '경영 대시보드, 전사 운영 모니터링, 영업 수주 현황 및 전사 결재문서 전체 조회·엑셀 권한을 갖는 경영진 전용 그룹입니다.',
    userIds: ['U001', 'U003'], // 대표이사, 손승원 상무 등
    deptIds: [],
    positionRanks: [1, 2], // 대표이사, 상무, 전무 등
    menuPermissions: execPermissions(),
    members: [
      { name: '손승원', code: 'swson' },
    ],
    permissions: matrix((_, ci) => ci < 6),
  },
  {
    id: 'FINANCE',
    code: 'FINANCE',
    name: '재무담당자',
    use: true,
    isSystem: false,
    desc: '견적·수주·주문서 전권 관리, 거래처 및 공통코드 관리, 전사 결재 모니터링 및 재무 데이터 엑셀 추출 권한을 갖는 그룹입니다.',
    userIds: ['U008', 'U012'], // 홍형표, 홍채원 등
    deptIds: [],
    positionRanks: [],
    menuPermissions: financeAdminPermissions(),
    members: [
      { name: '홍형표', code: 'hphong' },
      { name: '홍채원', code: 'cwhong' },
    ],
    permissions: matrix((_, ci) => ci < 5),
  },
  {
    id: 'USER',
    code: 'USER',
    name: '일반사원',
    use: true,
    isSystem: true,
    desc: '모든 임직원에게 기본 부여되는 그룹웨어(전자결재, 메일, 캘린더, 근태, 게시판 등) 기본 업무 사용 그룹입니다.',
    userIds: [],
    deptIds: [],
    positionRanks: [],
    menuPermissions: userPermissions(),
    members: [
      { name: '강윤석', code: 'yskang' },
      { name: '최지혜', code: 'jihye.choi' },
    ],
    permissions: matrix((_, ci) => ci < 2),
  },
];
