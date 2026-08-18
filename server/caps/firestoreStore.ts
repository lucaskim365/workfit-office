import type { CapsCollection, CapsStore } from './store';

/**
 * Firestore 저장소 — **마이그레이션 시점에 활성화**(계약 §4·§5·§8).
 *
 * `firebase-admin` 의존성이 아직 package.json에 없어(프론트 전용 개발 환경) 동적
 * import로 두고, 없으면 명확한 안내로 실패시킨다. 활성화 조건:
 *  1) `npm i firebase-admin` (package.json 승인)
 *  2) 환경변수 `FIREBASE_SERVICE_ACCOUNT`(서비스계정 JSON) — 또는
 *     `FIRESTORE_EMULATOR_HOST` 설정 시 자격 증명 없이 에뮬레이터로 붙는다.
 */
export class CapsFirestoreStore implements CapsStore {
  private writes: { collection: CapsCollection; id: string; data: Record<string, unknown> }[] = [];

  mergeSet(collection: CapsCollection, id: string, data: Record<string, unknown>): void {
    this.writes.push({ collection, id, data });
  }

  async flush(): Promise<void> {
    const db = await firestore();
    // Firestore writeBatch는 500 ops 상한이라 나눠 커밋한다(계약 §4).
    for (let at = 0; at < this.writes.length; at += 500) {
      const batch = db.batch();
      for (const write of this.writes.slice(at, at + 500)) {
        batch.set(db.collection(write.collection).doc(write.id), write.data, { merge: true });
      }
      await batch.commit();
    }
    this.writes = [];
  }
}

type AdminFirestore = {
  batch(): {
    set(ref: unknown, data: Record<string, unknown>, options: { merge: boolean }): void;
    commit(): Promise<unknown>;
  };
  collection(name: string): { doc(id: string): unknown };
};

/** firebase-admin의 CJS 기본 내보내기 중 여기서 쓰는 표면만. */
type AdminModule = {
  apps: unknown[];
  initializeApp(options?: Record<string, unknown>): unknown;
  credential: { cert(serviceAccount: Record<string, unknown>): unknown };
  firestore(): AdminFirestore;
};

let cached: AdminFirestore | null = null;

async function firestore(): Promise<AdminFirestore> {
  if (cached) return cached;

  let admin: AdminModule;
  try {
    // CJS 모듈이라 ESM dynamic import에서는 default 아래로 들어온다.
    const loaded: unknown = await import('firebase-admin');
    admin = (((loaded as { default?: unknown }).default ?? loaded)) as AdminModule;
  } catch {
    throw new Error(
      'firebase-admin이 설치되어 있지 않습니다. 마이그레이션 단계에서 `npm i firebase-admin` 후 사용하세요. '
      + '(로컬 검증은 CapsFileStore가 담당합니다)',
    );
  }

  if (admin.apps.length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    } else if (process.env.FIRESTORE_EMULATOR_HOST) {
      // 에뮬레이터는 자격 증명 없이 붙는다. projectId만 아무 값이나 필요하다.
      admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'caps-local' });
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 없습니다(또는 FIRESTORE_EMULATOR_HOST).');
    }
  }
  cached = admin.firestore() as unknown as AdminFirestore;
  return cached;
}
