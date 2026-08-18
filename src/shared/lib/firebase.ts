import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase 초기화 — 설정은 환경변수(VITE_FB_*)에서 주입.
 * 값이 비어 있으면(예: env 미설정) 초기화를 건너뛰어 셸 UI가 깨지지 않도록 한다.
 * 실제 데이터 연동은 Phase 1에서 각 모듈이 lazy 하게 사용.
 *
 * `import.meta.env` 는 Vite 가 빌드 시점에 주입한다. repo 단위 테스트는 Vite 를 거치지
 * 않고 Node(`tsx --test`)로 도는데, 거기서는 이 값이 통째로 `undefined` 라 바로 읽으면
 * 모듈 로드에서 터진다. repo 가 이 파일에 의존하게 되면서 실제로 겪은 문제라 방어한다.
 * Node 로 돌 때는 빈 설정 → `isFirebaseConfigured === false` → 인메모리 경로가 된다.
 */
const env: Record<string, string | undefined> = import.meta.env ?? {};

const firebaseConfig = {
  apiKey: env.VITE_FB_API_KEY,
  authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID,
  appId: env.VITE_FB_APP_ID,
  storageBucket: env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  const dbId = env.VITE_FB_FIRESTORE_DB_ID;
  db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export { app, db, auth, storage };
