import { useCallback, useMemo } from 'react';
import { useRosterOrder } from '@/features/user/useRosterOrder';
import { useUsers } from '@/features/user/useUsers';
import { useEmployeeProfiles } from '@/features/employeeProfile/useEmployeeProfiles';
import { useCommuteEmployees } from '@/features/commute/useCommute';

/** 이름 공백 정규화 (예: '모 란' vs '모란' 동일인 처리) */
export const normName = (s?: string | null) => (s || '').replace(/\s+/g, '');

type PersonLike = {
  id?: string;
  name?: string | null;
  empNo?: string | null;
  dept?: string | null;
  position?: string | null;
  jobTitle?: string | null;
};
type RowLike = { name?: string | null; dept?: string | null; position?: string | null; jobTitle?: string | null };

/**
 * 근태 관리 대상 명단 — CAPS 직원 목록과 시스템 사용자·인사 프로필을 이어 붙인 것.
 * 웹 근태 화면과 PWA 근태 관제가 같이 쓴다(연차 원장 숫자가 두 화면에서 어긋나지 않게).
 * enabled: 근태 첫 요청(useCommuteBootstrap)이 끝난 뒤 켠다 — 그 캐시를 써서 다시 묻지 않게
 */
export function useCommuteRoster(enabled: boolean) {
  // 시스템 전체 사용자 목록
  const usersQuery = useUsers();
  const allUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  // CAPS 연동 직원 목록
  const employeesQuery = useCommuteEmployees({ enabled });
  const allEmployees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  // 사용자 검색 맵 (이름, 사번, ID 기준 빠른 매핑)
  const userByEmpMap = useMemo(() => {
    const map = new Map<string, (typeof allUsers)[0]>();
    for (const u of allUsers) {
      if (u.empNo) map.set(u.empNo.trim(), u);
      if (u.name) {
        map.set(u.name.trim(), u);
        map.set(normName(u.name), u);
      }
      if (u.id) map.set(u.id.trim(), u);
    }
    return map;
  }, [allUsers]);

  const profilesQuery = useEmployeeProfiles();
  const employeeProfiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const profileByEmpMap = useMemo(() => {
    const map = new Map<string, (typeof employeeProfiles)[0]>();
    for (const p of employeeProfiles) {
      if (p.empNo) map.set(p.empNo.trim(), p);
      if (p.name) {
        map.set(p.name.trim(), p);
        map.set(normName(p.name), p);
      }
      if (p.userId) map.set(p.userId.trim(), p);
    }
    return map;
  }, [employeeProfiles]);

  // 근태 관리 제외 대상 여부 단일 판정 헬퍼 (인명관리의 [근태 관리 대상] ON/OFF 스위치에 의해서만 결정)
  const isExcludedAttendance = useCallback(
    (u?: PersonLike | null, rowName?: string) => {
      const name = (u?.name || rowName || '').trim();
      const nName = normName(name);

      // 프로필에 근태 관리 대상 여부가 설정되어 있는 경우 반영 (기본값: true / 관리자가 OFF한 경우: false)
      const profile =
        (u?.id ? profileByEmpMap.get(u.id) : undefined) ??
        (u?.empNo ? profileByEmpMap.get(u.empNo) : undefined) ??
        (name ? profileByEmpMap.get(name) ?? profileByEmpMap.get(nName) : undefined);

      return profile?.isAttendanceTarget === false;
    },
    [profileByEmpMap]
  );

  /** 인원 정렬 — 임원(권한그룹) → 부서 → 직책 → 직급 → 이름([[rosterOrder]]). 행에 빠진 값은 사용자 정보로 채운다. */
  const { compare: compareRoster } = useRosterOrder();
  const compareEmployees = useCallback(
    (a: RowLike, b: RowLike) => {
      const fill = (row: RowLike) => {
        const name = (row.name || '').trim();
        const u = userByEmpMap.get(name) ?? userByEmpMap.get(normName(name));
        return {
          // 인사 프로필 행이면 id 가 아니라 userId 가 사용자 ID 다
          id: (u && 'userId' in u ? (u as { userId?: string }).userId : u?.id) || undefined,
          name,
          dept: row.dept || u?.dept || '',
          position: row.position || u?.position || '',
          jobTitle: row.jobTitle || u?.jobTitle || '',
        };
      };
      return compareRoster(fill(a), fill(b));
    },
    [compareRoster, userByEmpMap]
  );

  // CAPS DB 임직원과 시스템 전체 사용자(allUsers)를 통합 (임직원 DB 미등록자 및 근태관리 OFF 대상자 원천 배제)
  const employees = useMemo(() => {
    const list = [
      ...allEmployees
        .filter((row) => row.active !== false && !row.retireDate)
        .filter((row) => {
          const n = row.name.trim();
          // [규칙 1] 임직원 데이터베이스(allUsers)와 비교: 매칭되는 등록 임직원이 없으면 배제
          const matchedUser = userByEmpMap.get(n) ?? userByEmpMap.get(normName(n)) ?? userByEmpMap.get(String(row.empId));
          if (!matchedUser) return false;
          // [규칙 2] 퇴사자(미사용, resignedAt 기록자) 배제
          if (matchedUser.status === '미사용' || Boolean(matchedUser.resignedAt)) return false;
          // [규칙 3] 인명관리에서 근태관리 대상 OFF로 지정된 경우 배제
          return !isExcludedAttendance(matchedUser, row.name);
        }),
    ];
    const existingNormNames = new Set(list.map((e) => normName(e.name)));
    const existingEmpIds = new Set(list.map((e) => e.empId));

    for (const u of allUsers) {
      // 퇴사자(미사용, resignedAt 기록자) 배제
      if (u.status === '미사용' || Boolean(u.resignedAt)) continue;

      const name = (u.name || '').trim();
      const nName = normName(name);
      if (!name || !nName || existingNormNames.has(nName) || isExcludedAttendance(u, name)) continue;

      let empId = Number(u.empNo);
      if (Number.isNaN(empId) || empId <= 0 || existingEmpIds.has(empId)) {
        let hash = 0;
        const key = u.id || name;
        for (let i = 0; i < key.length; i++) {
          hash = (hash << 5) - hash + key.charCodeAt(i);
          hash |= 0;
        }
        empId = 10000 + (Math.abs(hash) % 80000);
        while (existingEmpIds.has(empId)) empId++;
      }

      existingNormNames.add(nName);
      existingEmpIds.add(empId);
      list.push({ empId, name, active: true, retireDate: null });
    }

    return list.sort(compareEmployees);
  }, [allEmployees, allUsers, userByEmpMap, isExcludedAttendance, compareEmployees]);

  const getHireDateForEmp = useCallback(
    (empName?: string | null, empId?: number | null) => {
      if (!empName && !empId) return null;
      const profile =
        (empName ? profileByEmpMap.get(empName.trim()) ?? profileByEmpMap.get(normName(empName)) : undefined) ??
        (empId ? profileByEmpMap.get(String(empId)) : undefined);
      return profile?.hireDate ? profile.hireDate.trim() : null;
    },
    [profileByEmpMap]
  );

  return {
    allUsers,
    allEmployees,
    employees,
    userByEmpMap,
    profileByEmpMap,
    employeeProfiles,
    isExcludedAttendance,
    compareEmployees,
    getHireDateForEmp,
  };
}

export type CommuteRoster = ReturnType<typeof useCommuteRoster>;
