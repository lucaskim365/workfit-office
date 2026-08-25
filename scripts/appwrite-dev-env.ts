import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppwriteConfig } from '../server/caps/appwriteStore';

/**
 * `.env.local`의 Appwrite 항목을 읽는다(스크립트 전용 — 프론트 번들과 무관).
 * dotenv 의존성 없이 `KEY="value"` / `KEY=value` 형식만 지원한다.
 *
 * 기본은 **dev**다. 운영에 쓰려면 `--prod`를 명시해야 한다 — 기본값이 운영이면
 * 스크립트를 무심코 돌렸을 때 운영을 건드린다.
 */
export function loadAppwriteConfig(databaseId = 'workfit', prod = false): AppwriteConfig | null {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return null;
  const map = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    map.set(match[1], match[2].replace(/^"|"$/g, ''));
  }
  const endpoint = map.get('APPWRITE_ENDPOINT_DEV') ?? map.get('VITE_APPWRITE_ENDPOINT');
  // 운영 프로젝트 ID는 `.env.local`에 항목이 없어 상수로 둔다(런북·배포 스크립트와 같은 값).
  const projectId = prod
    ? (map.get('APPWRITE_PROJECT_ID_PROD') ?? '6a6bf85e002acb7f71d6')
    : map.get('APPWRITE_PROJECT_ID_DEV');
  const apiKey = prod ? map.get('APPWRITE_API_KEY_PROD') : map.get('APPWRITE_API_KEY_DEV');
  if (!endpoint || !projectId || !apiKey) return null;
  return { endpoint: endpoint.replace(/\/$/, ''), projectId, apiKey, databaseId };
}

/** 예전 이름. dev 전용 호출부 호환. */
export function loadAppwriteDevConfig(databaseId = 'workfit'): AppwriteConfig | null {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return null;
  const map = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    map.set(match[1], match[2].replace(/^"|"$/g, ''));
  }
  const endpoint = map.get('APPWRITE_ENDPOINT_DEV');
  const projectId = map.get('APPWRITE_PROJECT_ID_DEV');
  const apiKey = map.get('APPWRITE_API_KEY_DEV');
  if (!endpoint || !projectId || !apiKey) return null;
  return { endpoint: endpoint.replace(/\/$/, ''), projectId, apiKey, databaseId };
}
