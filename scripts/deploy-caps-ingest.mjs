/**
 * CAPS 근태 Function 배포 — 적재(에이전트) + 조회(그룹웨어 화면) 한 벌.
 *
 * ⚠ `scripts/appwrite-deploy-functions.mjs`를 쓰면 안 된다 — 제거된 `bridge-a2f`(Firestore
 *   듀얼 라이트)를 함께 되살린다. 그래서 근태 전용 스크립트를 따로 둔다.
 *
 * 실행: node scripts/deploy-caps-ingest.mjs [--prod] [--skip-vars]
 *   --prod       운영 프로젝트에 올린다(생략하면 dev).
 *   --skip-vars  코드만 올리고 함수 변수는 건드리지 않는다. 이미 돌고 있는 곳에 코드만
 *                반영할 때 쓴다 — 시크릿을 덮어쓰면 되돌릴 수 없다(값을 읽을 수 없으므로).
 *
 * 필요 env (.env.local):
 *   VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_DATABASE_ID
 *   APPWRITE_PROJECT_ID(없으면 VITE_) · APPWRITE_API_KEY(없으면 APPWRITE_API_KEY_DEV)
 *   WIDDY_TOKEN_SECRET   조회 신원 토큰 HMAC(= widdy-login 발급 키). 함수에는 AUTH_TOKEN_SECRET 으로 올린다.
 *   CAPS_INGEST_SECRET   에이전트 secret.txt 와 같은 값. **없으면 적재 경로는 401로 닫힌 채 배포된다**
 *                        (조회는 정상). 에이전트를 붙일 때 채워 넣을 것.
 */
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const { Client, Functions, Query, ID } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

const envText = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
function env(key) {
  if (process.env[key]) return process.env[key];
  const m = envText.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm'));
  return m ? m[1].trim() : undefined;
}

const IS_PROD = process.argv.includes('--prod');
const SKIP_VARS = process.argv.includes('--skip-vars');
const FUNCTION_ID = 'caps-ingest';
const DIR = 'appwrite/functions/caps-ingest';

const ENDPOINT = env('APPWRITE_ENDPOINT') ?? env('VITE_APPWRITE_ENDPOINT');
// 접미어 없는 키가 없으면 dev 로만 폴백한다 — 기본값이 운영이면 배포 사고가 난다.
const PROJECT = IS_PROD
  ? (env('APPWRITE_PROJECT_ID_PROD') ?? '6a6bf85e002acb7f71d6')
  : (env('APPWRITE_PROJECT_ID') ?? env('VITE_APPWRITE_PROJECT_ID'));
const API_KEY = IS_PROD ? env('APPWRITE_API_KEY_PROD') : (env('APPWRITE_API_KEY') ?? env('APPWRITE_API_KEY_DEV'));
const DB_ID = env('APPWRITE_DATABASE_ID') ?? env('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
const TOKEN_SECRET = IS_PROD ? env('AUTH_TOKEN_SECRET_PROD') : env('WIDDY_TOKEN_SECRET');
const CAPS_SECRET = IS_PROD ? env('CAPS_INGEST_SECRET_PROD') : env('CAPS_INGEST_SECRET');

const missing = Object.entries({ ENDPOINT, PROJECT, API_KEY, TOKEN_SECRET })
  .filter(([, v]) => !v).map(([k]) => k);
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
  name: 'CAPS Ingest',
  runtime: 'node-22',
  execute: ['any'],
  events: [],
  // 창 단위 적재라 한 번에 수백 건을 쓴다. 조회는 훨씬 짧다.
  timeout: 120,
  enabled: true,
  logging: true,
  entrypoint: 'src/main.js',
  commands: 'npm install',
  scopes: ['databases.read', 'databases.write', 'documents.read', 'documents.write'],
};

try {
  await retry('create', () => fn.create(spec));
  console.log(`  ✓ function 생성 (timeout ${spec.timeout}s)`);
} catch (e) {
  if (!isCode(e, 409)) throw e;
  await retry('update', () => fn.update(spec));
  console.log(`  • function 존재 → 갱신 (timeout ${spec.timeout}s)`);
}

async function setVar(key, value, secret) {
  try {
    await retry(`var ${key}`, () => fn.createVariable({ functionId: FUNCTION_ID, variableId: ID.unique(), key, value, secret }));
    console.log(`  ✓ var ${key}${secret ? ' (secret)' : ''}`);
  } catch (e) {
    if (!isCode(e, 409)) throw e;
    const list = await retry('listVariables', () => fn.listVariables({ functionId: FUNCTION_ID }));
    const found = list.variables.find((v) => v.key === key);
    // 함수를 지웠다 만들면 옛 변수가 고아로 남아 만들 수도 고칠 수도 없다. 경고만 남기고 진행한다.
    if (!found) { console.warn(`  ⚠ var ${key} — 고아 변수. 콘솔에서 확인 필요`); return; }
    await retry(`var ${key} 갱신`, () => fn.updateVariable({ functionId: FUNCTION_ID, variableId: found.$id, key, value, secret }));
    console.log(`  • var ${key} 갱신${secret ? ' (secret)' : ''}`);
  }
}

if (SKIP_VARS) {
  console.log('  • 변수 건드리지 않음 (--skip-vars)');
} else {
  await setVar('AUTH_TOKEN_SECRET', TOKEN_SECRET, true);
  await setVar('APPWRITE_DATABASE_ID', DB_ID, false);
  // 주입되는 APPWRITE_FUNCTION_API_ENDPOINT 가 평문 http 라서 POST 가 301 로 GET 이 된다.
  await setVar('APPWRITE_ENDPOINT', ENDPOINT, false);
  if (CAPS_SECRET) await setVar('CAPS_INGEST_SECRET', CAPS_SECRET, true);
  else console.log('  ⚠ CAPS_INGEST_SECRET 없음 — 적재 경로는 401로 닫힌 채 배포된다(조회는 정상)');
}

const BUNDLE_DIR = 'appwrite/_deploy_bundles';
mkdirSync(BUNDLE_DIR, { recursive: true });
const tar = resolve(BUNDLE_DIR, `${FUNCTION_ID}.tar.gz`);
rmSync(tar, { force: true });
// `--force-local`이 없으면 GNU tar가 `C:\...`의 콜론을 원격 호스트로 읽어 실패한다.
execFileSync('tar', ['--force-local', '-czf', tar, '--exclude=*.test.js', '--exclude=node_modules', '-C', DIR, '.'], { stdio: 'inherit' });

let dep = await retry('deployment', () => fn.createDeployment({
  functionId: FUNCTION_ID, code: InputFile.fromPath(tar, `${FUNCTION_ID}.tar.gz`), activate: true,
}));
console.log(`  ✓ deployment ${dep.$id} (${dep.status})`);

/**
 * 빌드 대기 — 이 인스턴스는 업로드 배포가 `waiting`에서 안 움직이거나, 빌드 성공 후
 * `Receive timeout`으로 `failed`로 뒤집히는 일이 잦다(2026-08-25 dev·운영 모두 발생).
 * 그게 **활성 배포**면 함수 호출이 전부 거부되므로, 같은 소스로 재빌드해 살린다.
 * 재빌드는 두 번 다 즉시 성공했다.
 */
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
console.log('\n✅ 완료. 배포 직후 상태가 ready여도 몇 분 뒤 뒤집힐 수 있으니 실제 호출로 한 번 확인할 것.');
