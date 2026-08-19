import { Client, Databases, ID, Query } from 'appwrite';

/**
 * Appwrite 초기화 — Firestore→Appwrite 이관 PoC(Phase 1).
 * 설정은 환경변수(VITE_APPWRITE_*)로 주입:
 *   VITE_APPWRITE_ENDPOINT    예: https://appwrite.widdyax.com/v1
 *   VITE_APPWRITE_PROJECT_ID  예: 6a6bf85e002acb7f71d6 (workfit-intra)
 *   VITE_APPWRITE_DATABASE_ID 예: workfit (Console에서 생성한 DB id)
 */
const env: Record<string, string | undefined> = import.meta.env ?? {};

const endpoint = env.VITE_APPWRITE_ENDPOINT;
const projectId = env.VITE_APPWRITE_PROJECT_ID;
const databaseId = env.VITE_APPWRITE_DATABASE_ID;

export const isAppwriteConfigured = Boolean(endpoint && projectId && databaseId);

let client: Client | null = null;
let databases: Databases | null = null;

if (isAppwriteConfigured) {
  client = new Client().setEndpoint(endpoint as string).setProject(projectId as string);
  databases = new Databases(client);
}

/** Console에서 생성한 Database id. 미설정 시 빈 문자열. */
export const APPWRITE_DATABASE_ID = (databaseId as string | undefined) ?? '';

export { client, databases, ID, Query };

/**
 * Appwrite 문서 $id 제약: 최대 36자, [a-zA-Z0-9._-], 선행 특수문자 불가.
 * 앱 문서 ID(Firestore auto-id·`NT-0001`·`RM-0002` 등)는 대부분 적합하나,
 * 이관 대상 중 규격 밖 ID가 있으면 PoC 단계에서 즉시 드러나도록 검증한다.
 */
const APPWRITE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
export function assertAppwriteId(id: string): string {
  if (!APPWRITE_ID_RE.test(id)) {
    throw new Error(
      `[appwrite] 문서 ID "${id}" 가 Appwrite $id 규격(≤36자, [a-zA-Z0-9._-], 선행 특수문자 불가)에 맞지 않습니다. ` +
        `이관 시 ID 매핑 규칙이 필요합니다.`,
    );
  }
  return id;
}

/** 결정적 문자열 해시(cyrb53) — 한글 등 규격 밖 자연키를 유효 $id 로 매핑할 때 사용. */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * 자연키 → 유효 Appwrite $id. 규격에 맞으면 그대로(가독성 유지), 아니면(한글 등)
 * 결정적 해시 $id 로 변환한다. 자연키 자체는 문서 attribute 에 그대로 저장되므로
 * 조회/upsert 는 그 필드로 하고, $id 는 결정적이라 같은 키는 항상 같은 문서를 가리킨다.
 * (예: companySite.name, creditLimit.cust 가 한글일 때)
 */
export function safeDocId(key: string): string {
  if (APPWRITE_ID_RE.test(key)) return key;
  return 'h' + cyrb53(key).toString(36) + cyrb53(key, 1).toString(36);
}
