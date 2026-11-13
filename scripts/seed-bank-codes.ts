/**
 * 공통코드에 은행 목록(BANK 그룹)을 넣는다 — 기업 계좌의 은행 고르기 원천.
 * 없는 코드만 새로 만든다. 이미 있는 행은 고치지 않는다(관리자가 바꾼 이름·사용 여부 보존). 다른 그룹은 읽지도 쓰지도 않는다.
 *
 *   npx tsx scripts/seed-bank-codes.ts --dry-run          (개발, 만들 것만 출력)
 *   npx tsx scripts/seed-bank-codes.ts                    (개발 적용)
 *   npx tsx scripts/seed-bank-codes.ts --prod --dry-run   (운영, 출력만)
 *   npx tsx scripts/seed-bank-codes.ts --prod             (운영 적용 — 사용자 지시 후)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';
import { BANK_GROUP_CODE, BANK_GROUP_NAME, INITIAL_BANKS } from '../src/domain/company/banks';

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\s*=\s*"?([^"\n]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

async function main() {
  const isProd = process.argv.includes('--prod');
  const dryRun = process.argv.includes('--dry-run');
  const endpoint = readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT');
  const projectId = isProd ? '6a6bf85e002acb7f71d6' : (readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID'));
  const dbId = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
  const apiKey = isProd
    ? (readEnv('APPWRITE_API_KEY_PROD') ?? readEnv('APPWRITE_API_KEY'))
    : (readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV'));
  if (!endpoint || !projectId || !apiKey) {
    console.error('필수 env 누락: APPWRITE_ENDPOINT / PROJECT_ID / API_KEY');
    process.exit(1);
  }
  const dbs = new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
  console.log(`대상: ${isProd ? '운영' : '개발'} (${projectId})${dryRun ? ' — 출력만' : ''}`);

  const existing = await dbs.listDocuments(dbId, 'commonCodes', [Query.equal('groupCode', BANK_GROUP_CODE), Query.limit(500)]);
  const have = new Set(existing.documents.map((d) => (d as unknown as { code: string }).code));
  const todo = INITIAL_BANKS.map((b, i) => ({ ...b, order: (i + 1) * 10 })).filter((b) => !have.has(b.code));
  console.log(`이미 있음 ${have.size}건 — 건너뜀 / 새로 만들 것 ${todo.length}건`);
  for (const b of todo) {
    console.log(`  + ${b.code} ${b.name}`);
    if (dryRun) continue;
    await dbs.createDocument(dbId, 'commonCodes', `${BANK_GROUP_CODE}__${b.code}`, {
      groupCode: BANK_GROUP_CODE, groupName: BANK_GROUP_NAME, code: b.code, name: b.name, order: b.order, use: true, regBy: '시스템',
    });
  }
  console.log(dryRun ? '출력만 — 바꾼 것 없음' : '완료');
}

main().catch((e) => { console.error(e); process.exit(1); });
