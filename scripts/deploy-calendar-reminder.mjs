/**
 * 일정 리마인더 Function 배포 — 스케줄(cron) 실행, HTTP 호출 대상 아님.
 *
 * 실행: node scripts/deploy-calendar-reminder.mjs [--prod] [--skip-vars]
 *   --prod       운영 프로젝트에 올린다(생략하면 dev).
 *   --skip-vars  코드만 올리고 함수 변수는 건드리지 않는다.
 *
 * 필요 env (.env.local):
 *   VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_DATABASE_ID
 *   APPWRITE_PROJECT_ID(없으면 VITE_) · APPWRITE_API_KEY(없으면 APPWRITE_API_KEY_DEV)
 *
 * 이 함수는 신원 토큰이나 별도 시크릿이 없다 — 클라이언트가 부르는 함수가 아니라
 * Appwrite 스케줄러만 깨우고, DB 접근은 실행마다 주입되는 동적 키(x-appwrite-key)로 한다.
 */
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const { Client, Functions, Query } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

const envText = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
function env(key) {
  if (process.env[key]) return process.env[key];
  const m = envText.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm'));
  return m ? m[1].trim() : undefined;
}

const IS_PROD = process.argv.includes('--prod');
const SKIP_VARS = process.argv.includes('--skip-vars');
const FUNCTION_ID = 'calendar-reminder';
const DIR = 'appwrite/functions/calendar-reminder';

const ENDPOINT = env('APPWRITE_ENDPOINT') ?? env('VITE_APPWRITE_ENDPOINT');
const PROJECT = IS_PROD
  ? (env('APPWRITE_PROJECT_ID_PROD') ?? '6a6bf85e002acb7f71d6')
  : (env('APPWRITE_PROJECT_ID') ?? env('VITE_APPWRITE_PROJECT_ID'));
const API_KEY = IS_PROD ? env('APPWRITE_API_KEY_PROD') : (env('APPWRITE_API_KEY') ?? env('APPWRITE_API_KEY_DEV'));
const DB_ID = env('APPWRITE_DATABASE_ID') ?? env('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';

const missing = Object.entries({ ENDPOINT, PROJECT, API_KEY }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`✗ 필수 설정 누락: ${missing.join(', ')}`);
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const fn = new Functions(client);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isCode = (e, c) => e && e.code === c;

/** 이 인스턴스는 간헐 nginx 504(60초)를 뱉는다. 502/503/504만 재시도한다. */
async function retry(label, task, attempts = 4) {
  for (let i = 1; ; i += 1) {
    try { return await task(); } catch (e) {
      if (![502, 503, 504].includes(e?.code) || i >= attempts) throw e;
      console.log(`  … ${label} ${e.code} — ${i}/${attempts - 1} 재시도`);
      await sleep(3000 * i);
    }
  }
}

console.log(`▶ ${ENDPOINT} / project ${PROJECT} / db ${DB_ID}${IS_PROD ? '  [운영]' : ''}`);

const spec = {
  functionId: FUNCTION_ID,
  name: 'Calendar Reminder',
  runtime: 'node-22',
  // 클라이언트가 직접 실행할 일이 없다 — 스케줄러만 깨운다.
  execute: [],
  events: [],
  schedule: '*/5 * * * *',
  timeout: 60,
  enabled: true,
  logging: true,
  entrypoint: 'src/main.js',
  commands: 'npm install',
  scopes: ['databases.read', 'databases.write', 'documents.read', 'documents.write'],
};

try {
  await retry('create', () => fn.create(spec));
  console.log(`  ✓ function 생성 (schedule ${spec.schedule})`);
} catch (e) {
  if (!isCode(e, 409)) throw e;
  await retry('update', () => fn.update(spec));
  console.log(`  • function 존재 → 갱신 (schedule ${spec.schedule})`);
}

async function setVar(key, value, secret) {
  const { ID } = await import('node-appwrite');
  try {
    await retry(`var ${key}`, () => fn.createVariable({ functionId: FUNCTION_ID, variableId: ID.unique(), key, value, secret }));
    console.log(`  ✓ var ${key}${secret ? ' (secret)' : ''}`);
  } catch (e) {
    if (!isCode(e, 409)) throw e;
    const list = await retry('listVariables', () => fn.listVariables({ functionId: FUNCTION_ID }));
    const found = list.variables.find((v) => v.key === key);
    if (!found) { console.warn(`  ⚠ var ${key} — 고아 변수. 콘솔에서 확인 필요`); return; }
    await retry(`var ${key} 갱신`, () => fn.updateVariable({ functionId: FUNCTION_ID, variableId: found.$id, key, value, secret }));
    console.log(`  • var ${key} 갱신${secret ? ' (secret)' : ''}`);
  }
}

if (SKIP_VARS) {
  console.log('  • 변수 건드리지 않음 (--skip-vars)');
} else {
  await setVar('APPWRITE_DATABASE_ID', DB_ID, false);
  await setVar('APPWRITE_ENDPOINT', ENDPOINT, false);
}

const BUNDLE_DIR = 'appwrite/_deploy_bundles';
mkdirSync(BUNDLE_DIR, { recursive: true });
const tar = resolve(BUNDLE_DIR, `${FUNCTION_ID}.tar.gz`);
rmSync(tar, { force: true });
execFileSync('tar', ['--force-local', '-czf', tar, '--exclude=*.test.js', '--exclude=node_modules', '-C', DIR, '.'], { stdio: 'inherit' });

let dep = await retry('deployment', () => fn.createDeployment({
  functionId: FUNCTION_ID, code: InputFile.fromPath(tar, `${FUNCTION_ID}.tar.gz`), activate: true,
}));
console.log(`  ✓ deployment ${dep.$id} (${dep.status})`);

/** 이 인스턴스는 배포가 waiting에 멈추거나 성공 후 failed로 뒤집히는 일이 잦다 — 재빌드로 복구. */
async function waitReady(id, rounds = 20) {
  for (let i = 0; i < rounds; i += 1) {
    const d = await retry('getDeployment', () => fn.getDeployment(FUNCTION_ID, id));
    if (d.status === 'ready' || d.status === 'failed') return d.status;
    await sleep(8000);
  }
  return 'timeout';
}

let status = await waitReady(dep.$id);
if (status !== 'ready') {
  console.log(`  • 빌드가 ${status} — 같은 소스로 재빌드`);
  dep = await retry('duplicate', () => fn.createDuplicateDeployment(FUNCTION_ID, dep.$id));
  status = await waitReady(dep.$id);
}

if (status !== 'ready') {
  console.error(`✗ 배포 실패(${status}). 활성 배포는 그대로 두었다.`);
  process.exit(1);
}

const current = await retry('get', () => fn.get(FUNCTION_ID));
if (current.deploymentId !== dep.$id) {
  await retry('activate', () => fn.updateFunctionDeployment(FUNCTION_ID, dep.$id));
  console.log(`  ✓ 활성 전환 ${dep.$id}`);
}

const deps = await retry('list', () => fn.listDeployments(FUNCTION_ID, [Query.orderDesc('$createdAt'), Query.limit(3)]));
console.log('\n최근 배포:');
for (const d of deps.deployments) console.log(`  ${d.$id} ${d.status}${d.$id === dep.$id ? ' ← 활성' : ''}`);
console.log('\n✅ 완료. 스케줄은 5분마다 — 다음 실행까지 기다리거나 콘솔에서 수동 실행해 로그 확인할 것.');
