/**
 * 메일 스택 Appwrite Function 배포 — `widdy-login`(토큰 발급) + `mail`(계정·IMAP/SMTP).
 *
 * 왜 둘을 같이 올리는가: 메일 Function은 요청자의 신원을 서명 토큰으로만 판단하는데,
 * 그 토큰을 발급하는 게 `widdy-login`이다. 발급자가 없는 프로젝트에 메일만 올리면 모든
 * 요청이 401로 떨어진다. 두 함수는 같은 `WIDDY_TOKEN_SECRET`을 써야 서명이 검증된다.
 *
 * 실행: node scripts/deploy-mail-stack.mjs [--only=mail|widdy-login]
 *
 * 필요 env (.env.local):
 *   VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_PROJECT_ID / VITE_APPWRITE_DATABASE_ID
 *   APPWRITE_API_KEY (없으면 APPWRITE_API_KEY_DEV) — functions.read/write 스코프 필요
 *   MAIL_CREDENTIALS_KEY  앱 비밀번호 암호화 키(base64url 32바이트)
 *   WIDDY_TOKEN_SECRET    신원 토큰 HMAC 시크릿(두 함수 공통)
 *
 * 멱등: 함수가 있으면 갱신하고, 변수도 있으면 갱신한다. 재실행해도 안전하다.
 */
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const { Client, Functions, ID } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

// ── env ──
const envText = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
function env(key) {
  if (process.env[key]) return process.env[key];
  const m = envText.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm'));
  return m ? m[1].trim() : undefined;
}

const ENDPOINT = env('APPWRITE_ENDPOINT') ?? env('VITE_APPWRITE_ENDPOINT');
const PROJECT = env('APPWRITE_PROJECT_ID') ?? env('VITE_APPWRITE_PROJECT_ID');
const DB_ID = env('APPWRITE_DATABASE_ID') ?? env('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
// 접미어 없는 키가 없으면 dev 로만 폴백한다 — 기본값이 운영이면 배포 사고가 난다.
const API_KEY = env('APPWRITE_API_KEY') ?? env('APPWRITE_API_KEY_DEV');
const MAIL_KEY = env('MAIL_CREDENTIALS_KEY');
const TOKEN_SECRET = env('WIDDY_TOKEN_SECRET');

const missing = Object.entries({ ENDPOINT, PROJECT, API_KEY, MAIL_KEY, TOKEN_SECRET })
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`✗ 필수 설정 누락: ${missing.join(', ')}`);
  process.exit(1);
}
if (Buffer.from(MAIL_KEY, 'base64url').length !== 32) {
  console.error('✗ MAIL_CREDENTIALS_KEY 는 base64url 인코딩된 32바이트여야 합니다.');
  process.exit(1);
}

// ── 배포 대상 ──
const TARGETS = [
  {
    id: 'widdy-login',
    name: 'Widdy Login',
    dir: 'appwrite/functions/widdy-login',
    // users 조회만 한다. 쓰기 스코프를 주지 않는다.
    scopes: ['databases.read', 'documents.read'],
    timeout: 30,
    vars: { WIDDY_TOKEN_SECRET: TOKEN_SECRET, APPWRITE_DATABASE_ID: DB_ID },
    secrets: ['WIDDY_TOKEN_SECRET'],
  },
  {
    id: 'mail',
    name: 'Mail',
    dir: 'appwrite/functions/mail',
    scopes: ['databases.read', 'databases.write', 'documents.read', 'documents.write'],
    // IMAP 확인과 SMTP 확인을 연달아 하므로 기본 30초로는 끊긴다.
    timeout: 90,
    vars: {
      MAIL_CREDENTIALS_KEY: MAIL_KEY,
      WIDDY_TOKEN_SECRET: TOKEN_SECRET,
      APPWRITE_DATABASE_ID: DB_ID,
    },
    secrets: ['MAIL_CREDENTIALS_KEY', 'WIDDY_TOKEN_SECRET'],
  },
];

// ── 상태 조회 모드 ──
if (process.argv.includes('--status')) {
  const fnStatus = new Functions(
    new (await import('node-appwrite')).Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY),
  );
  for (const t of TARGETS) {
    try {
      const f = await fnStatus.get({ functionId: t.id });
      const deps = await fnStatus.listDeployments({ functionId: t.id });
      const active = deps.deployments.find((d) => d.$id === f.deploymentId) ?? deps.deployments[0];
      console.log(`[${t.id}] timeout ${f.timeout}s · enabled ${f.enabled}`);
      console.log(`  활성 배포: ${active ? `${active.$id} status=${active.status}` : '없음'}`);
      // 빌드가 깨지면 로그에만 원인이 남는다. 앞부분만 보여 준다.
      if (active && active.status !== 'ready' && active.buildLogs) {
        console.log(`  빌드 로그: ${String(active.buildLogs).slice(0, 600)}`);
      }
    } catch (e) {
      console.log(`[${t.id}] 조회 실패: ${e.message}`);
    }
  }
  process.exit(0);
}

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const targets = only ? TARGETS.filter((t) => t.id === only) : TARGETS;
if (targets.length === 0) {
  console.error(`✗ --only=${only} 에 해당하는 대상이 없습니다.`);
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const fn = new Functions(client);
const isCode = (e, c) => e && e.code === c;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 게이트웨이 일시 장애 재시도.
 *
 * 이 인스턴스는 간헐적으로 nginx 504(60초 타임아웃)를 뱉는다. 배포 중간에 한 번 나면
 * 함수만 생기고 변수·코드가 안 올라간 어중간한 상태가 남아 원인 찾기가 번거롭다.
 * 502/503/504만 재시도한다 — 4xx는 재시도해도 같은 결과다.
 */
async function retry(label, task, attempts = 3) {
  for (let i = 1; ; i += 1) {
    try {
      return await task();
    } catch (e) {
      const transient = [502, 503, 504].includes(e?.code);
      if (!transient || i >= attempts) throw e;
      console.log(`  … ${label} ${e.code} — ${i}/${attempts - 1} 재시도`);
      await sleep(3000 * i);
    }
  }
}

const BUNDLE_DIR = 'appwrite/_deploy_bundles';

/** 함수 디렉터리 → tar.gz. 테스트 파일은 런타임에 쓰지 않으므로 뺀다. */
function bundle(target) {
  if (!existsSync(target.dir)) throw new Error(`디렉터리 없음: ${target.dir}`);
  mkdirSync(BUNDLE_DIR, { recursive: true });
  const out = resolve(BUNDLE_DIR, `${target.id}.tar.gz`);
  rmSync(out, { force: true });
  // `--force-local`이 없으면 GNU tar가 `C:\...`의 콜론을 원격 호스트로 읽어 실패한다.
  execFileSync(
    'tar',
    ['--force-local', '-czf', out, '--exclude=*.test.js', '--exclude=node_modules', '-C', target.dir, '.'],
    { stdio: 'inherit' },
  );
  return out;
}

async function setVar(functionId, key, value, secret) {
  try {
    await retry(`var ${key}`, () => fn.createVariable({ functionId, variableId: ID.unique(), key, value, secret }));
    console.log(`  ✓ var ${key}${secret ? ' (secret)' : ''}`);
  } catch (e) {
    if (!isCode(e, 409)) throw e;
    const list = await retry(`listVariables ${functionId}`, () => fn.listVariables({ functionId }));
    const found = list.variables.find((v) => v.key === key);
    if (!found) throw e;
    await retry(`var ${key} 갱신`, () => fn.updateVariable({ functionId, variableId: found.$id, key, value, secret }));
    console.log(`  • var ${key} 갱신${secret ? ' (secret)' : ''}`);
  }
}

console.log(`▶ ${ENDPOINT} / project ${PROJECT} / db ${DB_ID}`);
console.log(`  대상: ${targets.map((t) => t.id).join(', ')}\n`);

for (const t of targets) {
  console.log(`[${t.id}] ${t.name}`);

  const spec = {
    functionId: t.id,
    name: t.name,
    runtime: 'node-22',
    execute: ['any'],
    events: [],
    timeout: t.timeout,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm install',
    scopes: t.scopes,
  };

  try {
    await retry(`${t.id} create`, () => fn.create(spec));
    console.log(`  ✓ function 생성 (timeout ${t.timeout}s)`);
  } catch (e) {
    if (!isCode(e, 409)) throw e;
    await retry(`${t.id} update`, () => fn.update(spec));
    console.log(`  • function 존재 → 갱신 (timeout ${t.timeout}s)`);
  }

  for (const [key, value] of Object.entries(t.vars)) {
    await setVar(t.id, key, value, t.secrets.includes(key));
  }

  const tar = bundle(t);
  const dep = await retry(`${t.id} deployment`, () => fn.createDeployment({
    functionId: t.id,
    code: InputFile.fromPath(tar, `${t.id}.tar.gz`),
    activate: true,
    entrypoint: 'src/main.js',
    commands: 'npm install',
  }));
  console.log(`  ✓ deployment ${dep.$id} (status=${dep.status})\n`);
}

console.log('배포 요청 완료 — 빌드가 끝나야 실행된다. 상태 확인: node scripts/deploy-mail-stack.mjs --status');
