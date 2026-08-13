import { isFirebaseConfigured } from '@/shared/lib/firebase';
import { isAppwriteConfigured } from '@/shared/lib/appwrite';

/**
 * DB 백엔드 선택기 — Firestore→Appwrite 이관 PoC(Phase 1).
 * storage.ts 의 VITE_STORAGE_DRIVER 선례를 DB에 그대로 적용한다.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] §4 어댑터 패턴)
 *
 * 선택: VITE_DB_DRIVER = "firestore" | "appwrite"
 *   - "appwrite" 인데 미설정 → memory 폴백(경고)
 *   - "firestore" 인데 미설정 → memory 폴백
 *   - 미지정 → 기존 동작 보존(Firebase 있으면 firestore, 없으면 memory)
 *
 * repo 단위로 이 값을 읽어 백엔드를 고르므로, 컬렉션 하나씩 점진 전환·즉시 롤백이 가능하다.
 */
export type DbDriver = 'firestore' | 'appwrite' | 'memory';

function selectDbDriver(): DbDriver {
  const explicit = import.meta.env.VITE_DB_DRIVER as DbDriver | undefined;

  if (explicit === 'appwrite') {
    if (isAppwriteConfigured) return 'appwrite';
    console.warn('[db] VITE_DB_DRIVER=appwrite 이지만 Appwrite 미설정 → memory 폴백');
    return 'memory';
  }
  if (explicit === 'firestore') {
    return isFirebaseConfigured ? 'firestore' : 'memory';
  }
  // 미지정: 기존 동작 보존
  return isFirebaseConfigured ? 'firestore' : 'memory';
}

/** 앱 전역 DB 드라이버(모듈 로드 시 1회 결정). */
export const dbDriver: DbDriver = selectDbDriver();
