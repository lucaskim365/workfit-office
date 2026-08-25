import {
  commuteEmployeeSchema,
  commuteRecordSchema,
  type CommuteEmployee,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_EMPLOYEE_FIXTURE, COMMUTE_RECORD_FIXTURE } from './commute.fixture';
import { commuteGateway } from './commute.gateway';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * 근태 조회 Repository — 읽기 전용.
 *
 * 쓰기는 CAPS 인제스트(서버 전용 키)만 한다. 조회는 `caps-ingest` Function 경유
 * (`commute.gateway.ts`)이고, memory 드라이버면 로컬 수신 서버(:3020) → fixture 순으로
 * degrade한다.
 *
 * **왜 Function을 거치는가**: 근태 컬렉션은 개인정보라 서버 전용 권한(`permissions: []`)으로
 * 만들어져 있고, 브라우저는 프로젝트 ID만 가진 익명 클라이언트라 직접 읽으면 401이다.
 * 컬렉션을 열어서 푸는 건 답이 아니다 — projectId가 번들에 공개돼 있어 누구나 전 직원
 * 출퇴근 기록을 가져가게 된다. 신원은 메일과 같은 `widdy-login` 서명 토큰을 쓴다.
 */
export const commuteRepo = {
  async listEmployees(): Promise<CommuteEmployee[]> {
    if (dbDriver !== 'memory') {
      const rows = await commuteGateway.listEmployees();
      return rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    // 로컬 수신 서버(:3020)가 떠 있으면 CAPS 실데이터(.caps-local)를 읽고, 없으면 fixture.
    const real = await fetchLocal<unknown[]>('/api/local/employees');
    if (real && real.length > 0) {
      return real
        .flatMap((row) => {
          const parsed = commuteEmployeeSchema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    return [...COMMUTE_EMPLOYEE_FIXTURE].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  },

  /** 한 직원의 한 달(YYYY-MM) 근태. 날짜 오름차순. */
  async listMonth(empId: number, month: string): Promise<CommuteRecord[]> {
    const from = `${month}-01`;
    const to = `${month}-31`;

    if (dbDriver !== 'memory') {
      // 범위 질의는 Function이 `idx_empId_date`로 처리한다. 전건을 받아 여기서 거르면
      // 직원×일수로 늘어나는 데이터에서 조회 상한에 먼저 걸린다.
      const rows = await commuteGateway.listMonth(empId, month);
      return rows.sort((a, b) => a.date.localeCompare(b.date));
    }

    const real = await fetchLocal<unknown[]>(`/api/local/attendance?empId=${empId}&month=${month}`);
    if (real) {
      return real
        .flatMap((row) => {
          const parsed = commuteRecordSchema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return COMMUTE_RECORD_FIXTURE
      .filter((row) => row.empId === empId && row.date >= from && row.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};

/**
 * 개발용 로컬 수신 서버 조회. 서버가 없으면 null을 돌려 fixture로 degrade한다.
 * dev 빌드에서만 시도한다 — 운영 번들이 localhost를 두드리면 안 된다.
 */
async function fetchLocal<T>(path: string): Promise<T | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const response = await fetch(`http://localhost:3020${path}`, { signal: AbortSignal.timeout(800) });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}
