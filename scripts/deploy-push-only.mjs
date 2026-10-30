/**
 * push-notifications 함수만 재배포(코드 deployment 1건). bridge-a2f 등 다른 함수는 건드리지 않는다.
 * 1) 함수 폴더를 tar.gz 로 묶는다(appwrite/_deploy_bundles — gitignore)
 * 2) 실행 권한(execute)을 appwrite.json 값으로, 변수 AUTH_TOKEN_SECRET 을 .env.local 값으로 맞춘다 — 화면이 직접
 *    부르는 회수 요청에 필요. deployment 를 올려도 함수 설정은 안 바뀌므로 따로 맞춰야 한다. 이벤트·스코프·다른 변수는 그대로 둔다.
 * 3) 새 deployment 업로드·활성화
 *
 * 실행: node scripts/deploy-push-only.mjs           (.env.local 의 프로젝트 = 개발)
 *       node scripts/deploy-push-only.mjs --prod    (운영 프로젝트, APPWRITE_API_KEY_PROD)
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const env = readFileSync('.env.local', 'utf8');
// .env.local 은 줄 끝이 \r\n 이라 \r 까지 값으로 읽히지 않게 뺀다 — 비밀값에 붙으면 서명이 안 맞아 회수 요청이 모두 401 이 됐다
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n\\r]*)', 'm')) || [])[1]?.trim();
const { Client, Functions, ID } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

const isProd = process.argv.includes('--prod');
const client = new Client()
  .setEndpoint(get('VITE_APPWRITE_ENDPOINT'))
  // 운영 프로젝트 ID 는 scripts/appwrite-schema.ts --prod 와 같은 값
  .setProject(isProd ? '6a6bf85e002acb7f71d6' : get('VITE_APPWRITE_PROJECT_ID'))
  .setKey(isProd ? get('APPWRITE_API_KEY_PROD') : get('APPWRITE_API_KEY'));
const fn = new Functions(client);

const FN_ID = 'push-notifications';
const SRC = `appwrite/functions/${FN_ID}`;
const TAR = `appwrite/_deploy_bundles/${FN_ID}.tar.gz`;
const spec = JSON.parse(readFileSync(`${SRC}/appwrite.json`, 'utf8')).functions.find((f) => f.$id === FN_ID);

console.log(`▶ 대상: ${isProd ? '운영' : '개발'} 프로젝트`);

// 배포 전 안전 확인: 함수가 이미 존재하는지(신규 생성/이벤트 변경 없음)
const before = await fn.get(FN_ID);
console.log(`▶ 대상 함수: ${before.$id} "${before.name}" runtime=${before.runtime}`);
console.log(`  이벤트 ${before.events.length}개 (변경하지 않음)`);

/**
 * 회수 요청의 부른 사람 확인용 서명 시크릿 — widdy-login·mail 과 같은 값이어야 한다(scripts/deploy-mail-stack.mjs 와 같은 키 이름).
 * .env.local 에 없으면 함수에 이미 있는 값을 그대로 둔다(secret 이라 읽을 수 없다).
 * 둘 다 없으면 아무것도 바꾸지 않고 멈춘다 — 그대로 배포하면 회수 요청이 모두 거절된다.
 */
const TOKEN_SECRET = isProd ? get('AUTH_TOKEN_SECRET_PROD') : get('WIDDY_TOKEN_SECRET');
const existingSecret = (await fn.listVariables(FN_ID)).variables.find((v) => v.key === 'AUTH_TOKEN_SECRET');
if (!TOKEN_SECRET && !existingSecret) {
  console.error(`✗ 함수에 AUTH_TOKEN_SECRET 이 없고 .env.local 에 ${isProd ? 'AUTH_TOKEN_SECRET_PROD' : 'WIDDY_TOKEN_SECRET'} 도 없습니다.`);
  console.error('  widdy-login·mail 함수와 같은 값을 .env.local 에 넣고 다시 실행하세요. (아무것도 바꾸지 않았습니다)');
  process.exit(1);
}

mkdirSync('appwrite/_deploy_bundles', { recursive: true });
execSync(`tar -czf ${TAR} -C ${SRC} --exclude=node_modules .`);
console.log(`  ✓ 압축: ${TAR}`);

if (TOKEN_SECRET) {
  if (existingSecret) await fn.updateVariable(FN_ID, existingSecret.$id, 'AUTH_TOKEN_SECRET', TOKEN_SECRET, true);
  else await fn.createVariable(FN_ID, ID.unique(), 'AUTH_TOKEN_SECRET', TOKEN_SECRET, true);
  console.log(`  ✓ 변수 AUTH_TOKEN_SECRET ${existingSecret ? '갱신' : '추가'}`);
} else {
  console.log('  변수 AUTH_TOKEN_SECRET: 함수에 있는 값 유지(.env.local 에 없음)');
}

const execute = spec?.execute ?? [];
if (JSON.stringify(before.execute) !== JSON.stringify(execute)) {
  // update 는 빠진 값을 기본값으로 되돌리므로 현재 설정을 그대로 넘기고 execute 만 바꾼다
  await fn.update({
    functionId: FN_ID,
    name: before.name,
    runtime: before.runtime,
    execute,
    events: before.events,
    schedule: before.schedule,
    timeout: before.timeout,
    enabled: before.enabled,
    logging: before.logging,
    entrypoint: before.entrypoint,
    commands: before.commands,
    scopes: before.scopes,
    ...(before.buildSpecification ? { buildSpecification: before.buildSpecification } : {}),
    ...(before.runtimeSpecification ? { runtimeSpecification: before.runtimeSpecification } : {}),
    ...(before.deploymentRetention !== undefined ? { deploymentRetention: before.deploymentRetention } : {}),
  });
  console.log(`  ✓ 실행 권한: ${JSON.stringify(before.execute)} → ${JSON.stringify(execute)}`);
} else {
  console.log(`  실행 권한 ${JSON.stringify(execute)} (변경 없음)`);
}

console.log(`\n▶ 새 deployment 업로드(활성화) — ${TAR}`);
const dep = await fn.createDeployment(FN_ID, InputFile.fromPath(TAR, `${FN_ID}.tar.gz`), true, 'src/main.js', 'npm install');
console.log(`  ✓ deployment 생성: ${dep.$id} (status=${dep.status})`);

// 빌드 상태 폴링(간이 sleep, Date.now 미사용).
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
let status = dep.status;
for (let i = 0; i < 40 && !['ready', 'failed'].includes(status); i++) {
  await sleep(3000);
  const d = await fn.getDeployment(FN_ID, dep.$id);
  status = d.status;
  process.stdout.write(`  … ${status}${d.buildLogs ? '' : ''}\r`);
  if (status === 'ready' || status === 'failed') {
    console.log(`\n  빌드 상태: ${status}`);
    if (status === 'failed') console.log((d.buildLogs || '').slice(-1500));
  }
}

const after = await fn.get(FN_ID);
const active = after.deploymentId ?? after.deployment;
console.log(`\n결과: 함수 활성 deployment = ${active}, 실행 권한 = ${JSON.stringify(after.execute)}`);
console.log(active === dep.$id && status === 'ready'
  ? '✅ 재배포 완료 — 새 deployment 활성화됨'
  : `⚠️ 확인 필요 (status=${status}, active=${active})`);
process.exit(status === 'ready' ? 0 : 1);
