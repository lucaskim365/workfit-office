/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FB_API_KEY: string;
  /** 루미팹 인트라넷 주소(쉼표로 여러 개) — 주소에 'lumefab' 이 들어 있으면 적지 않아도 된다 */
  readonly VITE_LUMEFAB_HOSTS?: string;
  readonly VITE_FB_AUTH_DOMAIN: string;
  readonly VITE_FB_PROJECT_ID: string;
  readonly VITE_FB_APP_ID: string;
  readonly VITE_FB_STORAGE_BUCKET: string;
  readonly VITE_FB_MESSAGING_SENDER_ID: string;
  readonly VITE_FB_FIRESTORE_DB_ID?: string;
  // ── DB 이관 PoC(Phase 1): 백엔드 스위치 + Appwrite 연결 ──
  readonly VITE_DB_DRIVER?: 'firestore' | 'appwrite';
  readonly VITE_APPWRITE_ENDPOINT?: string;
  readonly VITE_APPWRITE_PROJECT_ID?: string;
  readonly VITE_APPWRITE_DATABASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
