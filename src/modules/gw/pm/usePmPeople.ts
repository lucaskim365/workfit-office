import { useCallback, useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useUsers } from '@/features/user/useUsers';

/**
 * PM 화면의 사람 — 그룹웨어 사용자(읽기만). 로그인한 사람 = '나' (데모의 사용자 선택 창 대신, §0).
 */
export interface PmPerson {
  id: string;
  name: string;
  /** "이름 직급" */
  label: string;
  dept: string;
}

export function usePmPeople() {
  const { user } = useAuth();
  const q = useUsers();
  const people = useMemo<PmPerson[]>(
    () =>
      (q.data ?? [])
        .filter((u) => u.status !== '미사용')
        .map((u) => ({ id: u.id, name: u.name, label: u.position ? `${u.name} ${u.position}` : u.name, dept: (u as { deptName?: string }).deptName ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [q.data],
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const nameOf = useCallback((id: string) => byId.get(id)?.name ?? (id ? '(알 수 없음)' : ''), [byId]);
  const labelOf = useCallback((id: string) => byId.get(id)?.label ?? nameOf(id), [byId, nameOf]);
  return { me: user?.id ?? '', people, nameOf, labelOf };
}
