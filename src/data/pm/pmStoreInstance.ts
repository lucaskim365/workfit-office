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
const env: Record<string, string | boolean | undefined> = (import.meta as { env?: Record<string, string | boolean> }).env ?? {};
export const PM_DRIVER: 'appwrite' | 'memory' = env.VITE_PM_DRIVER === 'appwrite' ? 'appwrite' : 'memory';
/**
 * 운영 빌드(`vite build`)인데 스위치가 없음 → PM 화면은 '준비 중' 안내만 (11/27 총괄 결정).
 * 그룹웨어 타일이 켜진 채 환경 변수 없이 배포되면 모든 직원이 메모리 예시 데이터를 보고
 * 넣은 것이 새로 고침에 사라지므로 막는다. 개발 서버 · 테스트(PROD 아님)의 메모리 모드는 그대로.
 */
export const PM_OFF = env.PROD === true && PM_DRIVER !== 'appwrite';
export const PM_OFF_TEXT = '프로젝트 관리는 아직 준비 중입니다';

function make(): PmStore {
  // 화면은 PM_OFF 면 저장소를 부르지 않음 — 그래도 불리면 예시 데이터 없이 멈춤
  if (PM_OFF) return createPmStore(todayStr(), { blocked: PM_OFF_TEXT });
  if (PM_DRIVER !== 'appwrite') return createPmStore();
  if (dbDriver !== 'appwrite') return createPmStore(todayStr(), { blocked: `PM 저장소 준비 안 됨 (VITE_DB_DRIVER 가 appwrite 가 아님 — 지금 ${dbDriver})` });
  return createPmStore(todayStr(), { db: createAppwritePmDb() });
}

let store: PmStore | null = null;
/** 처음 부를 때 만든다 */
export const pmStore = () => (store ??= make());
