import {
  commuteEmployeeSchema,
  commuteRecordSchema,
  type CommuteEmployee,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_EMPLOYEE_FIXTURE, COMMUTE_RECORD_FIXTURE } from './commute.fixture';
import { createCrudBackend } from '@/data/_backend/crudBackend';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * 근태 조회 Repository — 읽기 전용.
 *
 * 쓰기는 CAPS 인제스트(서버 전용 키)만 한다. 조회는 공유 CrudBackend(VITE_DB_DRIVER)로
 * `employees`·`attendance`를 읽고, memory 드라이버면 로컬 수신 서버(:3020) → fixture 순으로
 * degrade한다.
 *
 * ⚠ **이 화면은 아직 운영에서 열리지 않는다.** 근태 컬렉션은 개인정보라 서버 전용 권한
 * (`permissions: []`)으로 프로비저닝돼 있고, 브라우저는 프로젝트 ID만 가진 익명 클라이언트라
 * 읽기가 거부된다. 열리려면 Appwrite Auth + 문서 권한(본인·관리자) 또는 서버 경유 조회가
 * 선행되어야 한다(feat/commute DESIGN §3).
 */
const toIso = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === 'function' ? maybe.toDate().toISOString() : null;
};

const employeesBackend = createCrudBackend<CommuteEmployee>({
  coll: 'employees',
  parse: (raw) => {
    const parsed = commuteEmployeeSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => String(row.empId),
  seed: [...COMMUTE_EMPLOYEE_FIXTURE],
});

const attendanceBackend = createCrudBackend<CommuteRecord>({
  coll: 'attendance',
  // Firestore Timestamp → ISO 정규화. Appwrite는 이미 ISO 문자열이라 그대로 통과한다.
  parse: (raw) => {
    const data = raw as Record<string, unknown>;
    const parsed = commuteRecordSchema.safeParse({
      ...data,
      inAt: toIso(data.inAt),
      outAt: toIso(data.outAt),
    });
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => `${row.empId}_${row.date.replaceAll('-', '')}`, // 인제스트 계약 §4와 동일
  seed: [...COMMUTE_RECORD_FIXTURE],
});

export const commuteRepo = {
  async listEmployees(): Promise<CommuteEmployee[]> {
    if (dbDriver !== 'memory') {
      return (await employeesBackend.loadAll()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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
      // ⚠ 공유 백엔드가 전건 로드만 제공해 Firestore 시절의 서버측 where(empId·date 범위)가
      // 사라졌다. 지금 규모(수백 건)는 견디지만, 근태는 직원×일수로 선형 증가하므로
      // 백엔드에 질의 API를 추가하는 것이 다음 수순이다.
      const rows = await attendanceBackend.loadAll();
      return rows
        .filter((row) => row.empId === empId && row.date >= from && row.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date));
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
