import type { DepartmentMember } from '@/domain/departmentMember/schema';
import { USER_SEED } from './user.seed';
import { DEPARTMENT_SEED } from './department.seed';

/**
 * 부서 소속 및 겸직 시드 데이터 (DepartmentMember)
 * - 모든 임직원의 본직(주 소속, isPrimary: true)
 * - 시연 및 검증용 겸직(isPrimary: false) 데이터 포함:
 *   1) 김승기 부장(U011): 본직=데이터플랫폼 개발팀(팀장) / 겸직=기술경영전략위원회(직책 없음)
 *   2) 홍채원 사원(U012): 본직=데이터플랫폼 개발팀(팀원) / 겸직=기술경영전략위원회(직책 없음)
 *   3) 박영미 대표(U001): 본직=대표이사 / 겸직=기술경영전략위원회(직책 없음)
 *   4) 강윤석 이사(U006): 본직=품질심사팀(팀장) / 겸직=AX PMO팀(팀원)
 */
const deptMap = new Map<string, string>();
DEPARTMENT_SEED.forEach((d) => deptMap.set(d.name, d.id));

export const DEPARTMENT_MEMBER_SEED: DepartmentMember[] = [
  // ── 1. 전 직원 기본 본직(주 소속, isPrimary: true) ──
  ...USER_SEED.map((u, idx) => {
    const deptId = deptMap.get(u.dept) || 'D100';
    return {
      id: `DM-${u.id}-${deptId}`,
      userId: u.id,
      deptId,
      deptName: u.dept,
      isPrimary: true,
      jobTitle: u.jobTitle || '',
      order: idx + 1,
      assignedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }),

  // ── 2. 시연 및 기능 검증용 겸직 소속 (isPrimary: false) ──
  // 김승기 부장: 기술경영전략위원회(D120) 겸직 (★ 위원회이므로 직책 없음)
  {
    id: 'DM-U011-D120',
    userId: 'U011',
    deptId: 'D120',
    deptName: '기술경영전략위원회',
    isPrimary: false,
    jobTitle: '', // 위원회 직책 없음
    order: 101,
    assignedAt: '2026-03-01T00:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },

  // 홍채원 사원: 기술경영전략위원회(D120) 겸직 (★ 위원회 직책 없음)
  {
    id: 'DM-U012-D120',
    userId: 'U012',
    deptId: 'D120',
    deptName: '기술경영전략위원회',
    isPrimary: false,
    jobTitle: '', // 위원회 직책 없음
    order: 102,
    assignedAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },

  // 박영미 대표: 기술경영전략위원회(D120) 겸직 (★ 위원회 직책 없음)
  {
    id: 'DM-U001-D120',
    userId: 'U001',
    deptId: 'D120',
    deptName: '기술경영전략위원회',
    isPrimary: false,
    jobTitle: '', // 위원회 직책 없음
    order: 103,
    assignedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // 강윤석 이사: AX PMO팀(D230) 겸직 (일반 부서이므로 '자문위원/팀원' 등 직책 가능)
  {
    id: 'DM-U006-D230',
    userId: 'U006',
    deptId: 'D230',
    deptName: 'AX PMO팀',
    isPrimary: false,
    jobTitle: '팀원',
    order: 104,
    assignedAt: '2026-05-01T00:00:00.000Z',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
];
