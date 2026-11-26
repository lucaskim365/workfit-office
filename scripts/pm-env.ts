/**
 * PM 스크립트 공용 안전장치 (설계 5.7.6 · K7 · 11/26 사용자 지시 "그룹웨어 다른 데이터에 영향이 없는지").
 * pm-schema · pm-import · pm-drop 이 쓴다.
 *
 * 1. 개발 DB 접속 값만 읽는다 — `.env` 에서 **아래 4개 이름만** 골라 읽고 다른 줄은 이름도 보지 않는다
 *    (같은 파일에 운영 열쇠가 있어도 그 이름을 코드에 쓰지 않음).
 * 2. 프로젝트 ID 가 운영 ID 이면 옵션과 상관없이 거절. `--prod` 도 거절.
 * 3. 쓰거나 지우는 컬렉션 이름은 `PM_COLLS` 23개와 글자 그대로 같아야 한다 (pm 으로 시작하는지만 보지 않음).
 * 4. 첫 줄에 endpoint · project · database 를 찍는다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PM_COLLS } from '../src/data/pm/pmDb';

/** 운영 프로젝트 — 무조건 거절 */
export const PROD_PROJECT_ID = '6a6bf85e002acb7f71d6';
/** 읽는 이름 (이것 말고는 읽지 않음) */
const ALLOWED = ['VITE_APPWRITE_ENDPOINT', 'VITE_APPWRITE_PROJECT_ID', 'VITE_APPWRITE_DATABASE_ID', 'APPWRITE_API_KEY'] as const;
type Allowed = (typeof ALLOWED)[number];

/** PM 컬렉션 23개 이름 (글자 그대로) */
export const PM_COLL_NAMES: readonly string[] = PM_COLLS.map((c) => c.name);

export interface DevDb { endpoint: string; project: string; database: string; key: string }

/** `.env` (없으면 `.env.local`) 에서 허용한 4개 이름만 — 줄 이름이 정확히 같을 때만 */
function readAllowed(): Partial<Record<Allowed, string>> {
  const out: Partial<Record<Allowed, string>> = {};
  for (const f of ['.env', '.env.local']) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const at = line.indexOf('=');
      if (at < 0) continue;
      const name = line.slice(0, at).trim();
      if (!(ALLOWED as readonly string[]).includes(name) || out[name as Allowed]) continue;
      // 값 = 따옴표 안, 따옴표가 없으면 뒤 주석(' #…') 뺀 것
      const rest = line.slice(at + 1).trim();
      const q = rest.match(/^"([^"]*)"|^'([^']*)'/);
      out[name as Allowed] = q ? (q[1] ?? q[2]) : rest.replace(/\s+#.*$/, '').trim();
    }
  }
  return out;
}

/** 개발 DB 접속 값 + 운영 거절. 첫 줄 찍기 */
export function devDb(label: string): DevDb {
  if (process.argv.includes('--prod')) fail('--prod 는 PM 스크립트에서 쓰지 않습니다 (운영은 8단계 · 따로 허락)');
  const env = readAllowed();
  const v = { endpoint: env.VITE_APPWRITE_ENDPOINT ?? '', project: env.VITE_APPWRITE_PROJECT_ID ?? '', database: env.VITE_APPWRITE_DATABASE_ID || 'workfit', key: env.APPWRITE_API_KEY ?? '' };
  console.log(`▶ ${label} — endpoint ${v.endpoint} / project ${v.project} / database ${v.database}`);
  if (!v.endpoint || !v.project || !v.key) fail('개발 DB 접속 값이 없습니다 (.env 의 VITE_APPWRITE_ENDPOINT · VITE_APPWRITE_PROJECT_ID · APPWRITE_API_KEY)');
  if (v.project === PROD_PROJECT_ID) fail(`운영 프로젝트(${PROD_PROJECT_ID})는 거절합니다 — PM 스크립트는 개발 DB 만`);
  return v;
}

/** 쓰거나 지울 컬렉션이 PM 23개 안인지 (글자 그대로) — 밖이면 멈춤 */
export function assertPmColl(name: string): void {
  if (!PM_COLL_NAMES.includes(name)) fail(`PM 컬렉션 23개 목록 밖의 이름 "${name}" — 쓰거나 지우지 않고 멈춤`);
}

export function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/** 시각 (초까지, 한국 시각) — 7-4 · 7-5 시작 · 끝 보고용 */
export const stampNow = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
