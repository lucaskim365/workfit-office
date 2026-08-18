import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  commuteEmployeeSchema,
  commuteRecordSchema,
  type CommuteEmployee,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_EMPLOYEE_FIXTURE, COMMUTE_RECORD_FIXTURE } from './commute.fixture';

/**
 * 근태 조회 Repository — 읽기 전용.
 *
 * 쓰기는 CAPS 인제스트 서버(/api/ingest, Admin SDK)만 한다. Firebase 설정 시 Firestore
 * `employees`·`attendance`를 읽고, 미설정 로컬은 fixture로 degrade한다.
 *
 * ⚠ 운영 rules는 근태 읽기를 `request.auth` 기반(본인·관리자)으로 제한한다. 현재 앱은
 * Firebase Auth 미사용이라 Firestore 모드 조회는 거부되는 것이 정상이며, 이 화면이
 * 운영에서 열리려면 Auth + userMap 도입이 선행되어야 한다(feat/commute DESIGN §3).
 */
const toIso = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === 'function' ? maybe.toDate().toISOString() : null;
};

export const commuteRepo = {
  async listEmployees(): Promise<CommuteEmployee[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, 'employees'));
      return snap.docs
        .flatMap((row) => {
          const parsed = commuteEmployeeSchema.safeParse(row.data());
          return parsed.success ? [parsed.data] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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

    if (isFirebaseConfigured && db) {
      const snap = await getDocs(query(
        collection(db, 'attendance'),
        where('empId', '==', empId),
        where('date', '>=', from),
        where('date', '<=', to),
      ));
      return snap.docs
        .flatMap((row) => {
          const data = row.data();
          const parsed = commuteRecordSchema.safeParse({
            ...data,
            inAt: toIso(data.inAt),
            outAt: toIso(data.outAt),
          });
          return parsed.success ? [parsed.data] : [];
        })
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
