import { dbDriver } from '@/shared/lib/dbDriver';
import { todayStr } from '@/domain/pm/rules';
import { createPmStore, type PmStore } from './pm.store';
import { createAppwritePmDb } from './pmDbAppwrite';

/**
 * 화면이 쓰는 PM 저장소 하나 — 스위치 (설계 5.7.4, K6).
 * - `VITE_PM_DRIVER` 없음 → 메모리 (지금처럼). 그룹웨어 `VITE_DB_DRIVER=appwrite` 만으로는 켜지지 않음.
 * - `VITE_PM_DRIVER=appwrite` **그리고** 공용 `dbDriver === 'appwrite'` → DB.
 * - `VITE_PM_DRIVER=appwrite` 인데 `dbDriver` 가 firestore · memory → "PM 저장소 준비 안 됨" 으로 멈춤
 *   (firestore 면 pm 문서가 Firestore 로, memory 면 저장된 것처럼 보이다 사라짐).
 */
const env: Record<string, string | undefined> = (import.meta as { env?: Record<string, string> }).env ?? {};
export const PM_DRIVER: 'appwrite' | 'memory' = env.VITE_PM_DRIVER === 'appwrite' ? 'appwrite' : 'memory';

function make(): PmStore {
  if (PM_DRIVER !== 'appwrite') return createPmStore();
  if (dbDriver !== 'appwrite') return createPmStore(todayStr(), { blocked: `PM 저장소 준비 안 됨 (VITE_DB_DRIVER 가 appwrite 가 아님 — 지금 ${dbDriver})` });
  return createPmStore(todayStr(), { db: createAppwritePmDb() });
}

let store: PmStore | null = null;
/** 처음 부를 때 만든다 */
export const pmStore = () => (store ??= make());
