import type { Department } from './schema';

/**
 * 사용자의 부서 이름 → 부서 ID.
 *
 * `user.dept`는 부서 ID가 아니라 **부서 이름 문자열**이라 부서 목록에서 찾아 옮겨야 한다.
 * 같은 변환이 화면마다 흩어져 있었고(업무관리·설문·자원예약), 부서 범위 공유를 쓰는 곳이
 * 늘수록 계속 복사된다. 규칙을 한 곳에 둔다.
 *
 * 찾지 못하면 `null`이다 — 부서가 지워졌거나 이름이 바뀐 경우다. 부르는 쪽은 이걸
 * "부서 없음"으로 다뤄야 하고, 부서 범위 판정은 자동으로 거짓이 된다.
 */
export function resolveDeptId(departments: Department[], deptName: string | null | undefined): string | null {
  const name = deptName?.trim();
  if (!name) return null;
  return departments.find((department) => department.name === name)?.id ?? null;
}
