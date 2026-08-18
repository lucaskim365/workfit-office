import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppwriteConfig } from '../server/caps/appwriteStore';

/**
 * `.env.local`의 Appwrite dev 항목을 읽는다(스크립트 전용 — 프론트 번들과 무관).
 * dotenv 의존성 없이 `KEY="value"` / `KEY=value` 형식만 지원한다.
 */
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
