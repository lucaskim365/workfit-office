/**
 * 로그인 토큰 서명 비밀값 교체 — widdy-login 이 서명하고 각 함수가 검증하는 HMAC 비밀값을 새 값으로 맞춘다.
 *
 * 같은 비밀값이 역사적 이유로 두 이름에 들어 있다(2026-08-18 WIDDY_TOKEN_SECRET → 08-19 AUTH_TOKEN_SECRET 로 정리,
 * 옛 이름도 호환용으로 남김). 함수마다 읽는 이름이 달라(widdy-chat 은 WIDDY_TOKEN_SECRET 만 읽는다) 두 칸 모두 같은 값으로 맞춘다.
 *   - AUTH_TOKEN_SECRET: 아래 함수 모두
 *   - WIDDY_TOKEN_SECRET: 이미 그 칸이 있는 함수 + widdy-login·widdy-chat
 * 메일 계정 암호화 키(MAIL_CREDENTIALS_KEY) 등 다른 변수는 건드리지 않는다 — deploy-mail-stack.mjs 를 쓰면 그것까지 덮어쓴다.
 *
 * 변수만 바꾸면 이미 떠 있는 함수에는 반영되지 않는다. 바꾼 함수는 지금 활성 배포를 같은 코드로 다시 만들어 적용한다.
 * 교체하는 순간 이미 발급된 토큰은 모두 무효가 된다(다시 로그인하면 새 토큰).
 *
 * 값은 .env.local 에서 읽는다: 개발 WIDDY_TOKEN_SECRET, 운영 AUTH_TOKEN_SECRET_PROD (다른 배포 스크립트와 같은 이름).
 * 실행: node scripts/rotate-token-secret.mjs [--prod] [--dry-run]
 */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n\\r]*)', 'm')) || [])[1];
const { Client, Functions, ID, Query } = await import('node-appwrite');

const isProd = process.argv.includes('--prod');
const dryRun = process.argv.includes('--dry-run');
const SECRET = isProd ? get('AUTH_TOKEN_SECRET_PROD') : get('WIDDY_TOKEN_SECRET');
if (!SECRET || SECRET.length < 32) {
  console.error(`✗ .env.local 에 ${isProd ? 'AUTH_TOKEN_SECRET_PROD' : 'WIDDY_TOKEN_SECRET'} 가 없거나 너무 짧습니다.`);
  process.exit(1);
}

const fn = new Functions(
  new Client()
    .setEndpoint(get('VITE_APPWRITE_ENDPOINT'))
    // 운영 프로젝트 ID 는 scripts/appwrite-schema.ts --prod 와 같은 값
    .setProject(isProd ? '6a6bf85e002acb7f71d6' : get('VITE_APPWRITE_PROJECT_ID'))
    .setKey(isProd ? get('APPWRITE_API_KEY_PROD') : get('APPWRITE_API_KEY')),
);

/** 토큰을 발급·검증하는 함수(없는 함수는 건너뛴다 — survey 는 개발에만 있다) */
const TOKEN_FUNCTIONS = ['widdy-login', 'widdy-chat', 'mail', 'caps-ingest', 'push-notifications', 'survey'];
const ALWAYS_WIDDY = new Set(['widdy-login', 'widdy-chat']);

console.log(`▶ ${isProd ? '운영' : '개발'} 프로젝트${dryRun ? ' (dry-run: 바꾸지 않음)' : ''}`);

const changed = [];
for (const id of TOKEN_FUNCTIONS) {
  let f;
  try {
    f = await fn.get(id);
  } catch {
    console.log(`  - ${id}: 함수 없음 — 건너뜀`);
    continue;
  }
  const vars = (await fn.listVariables(id)).variables;
  const keys = ['AUTH_TOKEN_SECRET'];
  if (ALWAYS_WIDDY.has(id) || vars.some((v) => v.key === 'WIDDY_TOKEN_SECRET')) keys.push('WIDDY_TOKEN_SECRET');
  for (const key of keys) {
    const found = vars.find((v) => v.key === key);
    console.log(`  • ${id}: ${key} ${found ? '갱신' : '추가'}`);
    if (dryRun) continue;
    if (found) {
      await fn.updateVariable(id, found.$id, key, SECRET, true);
      continue;
    }
    try {
      await fn.createVariable(id, ID.unique(), key, SECRET, true);
    } catch (e) {
      /*
        함수를 지웠다 만들면 옛 변수가 고아로 남아 목록에도 안 보이고 같은 이름으로 만들 수도 없다(409 variable_already_exists,
        deploy-caps-ingest.mjs 와 같은 현상). WIDDY_TOKEN_SECRET 은 AUTH_TOKEN_SECRET 이 없을 때만 읽는 옛 이름이라
        widdy-chat 이 아니면 없어도 된다 — 경고만 남기고 넘어간다. widdy-chat 은 이 이름만 읽으므로 멈춘다.
      */
      if (e?.code !== 409 || (key === 'WIDDY_TOKEN_SECRET' && id === 'widdy-chat') || key === 'AUTH_TOKEN_SECRET') throw e;
      console.log(`    ⚠ ${id}: ${key} 는 고아 변수라 추가할 수 없음 — AUTH_TOKEN_SECRET 으로 동작하므로 건너뜀`);
    }
  }
  changed.push({ id, deploymentId: f.deploymentId });
}

if (dryRun) {
  console.log('\n✅ dry-run 끝 — 아무것도 바꾸지 않았습니다.');
  process.exit(0);
}

/** 같은 코드로 다시 배포해 새 변수를 적용한다. 빌드가 끝날 때까지 기다린다. */
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitReady(id, depId) {
  for (let i = 0; i < 40; i += 1) {
    const d = await fn.getDeployment(id, depId);
    if (d.status === 'ready' || d.status === 'failed') return d.status;
    await sleep(5000);
  }
  return 'timeout';
}

console.log('\n▶ 새 값 적용(같은 코드로 다시 배포)');
let failed = 0;
for (const { id, deploymentId } of changed) {
  if (!deploymentId) {
    console.log(`  - ${id}: 활성 배포 없음 — 다음 배포 때 적용`);
    continue;
  }
  const dup = await fn.createDuplicateDeployment(id, deploymentId);
  const status = await waitReady(id, dup.$id);
  const active = (await fn.get(id)).deploymentId;
  if (status === 'ready' && active !== dup.$id) await fn.updateFunctionDeployment(id, dup.$id);
  const ok = status === 'ready';
  if (!ok) failed += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${id}: ${dup.$id} ${status}${ok ? '' : ' — 이전 배포가 그대로 활성(옛 값으로 동작 중일 수 있음)'}`);
}

const recent = await fn.listDeployments('widdy-login', [Query.orderDesc('$createdAt'), Query.limit(1)]).catch(() => null);
if (recent) console.log(`\n(widdy-login 최근 배포 ${recent.deployments[0]?.$id} ${recent.deployments[0]?.status})`);
console.log(failed === 0 ? '\n✅ 교체 완료 — 이미 발급된 토큰은 무효. 다시 로그인하면 새 토큰을 받는다.' : `\n⚠️ ${failed}개 함수가 다시 배포되지 않았습니다. 위 목록을 확인하세요.`);
process.exit(failed === 0 ? 0 : 1);
