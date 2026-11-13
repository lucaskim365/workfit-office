/**
 * 기업분류 초기값(도입기업 — 프로젝트당 한 곳, 매입기업 — 여러 곳)을 넣는다.
 * 없는 것만 만든다. 이미 있는 행은 고치지 않는다(관리자가 바꾼 이름·사용 여부 보존).
 *
 *   npx tsx scripts/seed-company-classes.ts --dry-run          (개발, 출력만)
 *   npx tsx scripts/seed-company-classes.ts                    (개발 적용)
 *   npx tsx scripts/seed-company-classes.ts --prod --dry-run   (운영, 출력만)
 *   npx tsx scripts/seed-company-classes.ts --prod             (운영 적용 — 사용자 지시 후)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases } from 'node-appwrite';
import { INITIAL_COMPANY_CLASSES } from '../src/domain/company/masters';

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
  const now = new Date().toISOString();
  for (const c of INITIAL_COMPANY_CLASSES) {
    const exists = await dbs.getDocument(dbId, 'companyClasses', c.id).then(() => true, (e) => (e?.code === 404 ? false : Promise.reject(e)));
    if (exists) { console.log(`  = ${c.name} — 이미 있음, 건너뜀`); continue; }
    console.log(`  + ${c.name} (${c.singlePerProject ? '프로젝트당 한 곳' : '여러 곳'})`);
    if (dryRun) continue;
    await dbs.createDocument(dbId, 'companyClasses', c.id, { ...c, use: true, note: '', createdBy: '시스템', createdAt: now, updatedBy: '시스템', updatedAt: now });
  }
  console.log(dryRun ? '출력만 — 바꾼 것 없음' : '완료');
}

main().catch((e) => { console.error(e); process.exit(1); });
