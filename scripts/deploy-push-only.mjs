/**
 * push-notifications 함수만 재배포(코드 deployment 1건). bridge-a2f 등 다른 함수는 건드리지 않는다.
 * 함수/이벤트/스코프/env 는 기존 그대로 두고, 패치된 tar.gz 를 새 deployment 로 업로드·활성화만 한다.
 * 실행: node scripts/deploy-push-only.mjs
 */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n]*)', 'm')) || [])[1];
const { Client, Functions } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

const client = new Client()
  .setEndpoint(get('VITE_APPWRITE_ENDPOINT'))
  .setProject(get('VITE_APPWRITE_PROJECT_ID'))
  .setKey(get('APPWRITE_API_KEY'));
const fn = new Functions(client);

const FN_ID = 'push-notifications';
const TAR = 'appwrite/_deploy_bundles/push-notifications.tar.gz';

// 배포 전 안전 확인: 함수가 이미 존재하는지(신규 생성/이벤트 변경 없음)
const before = await fn.get(FN_ID);
console.log(`▶ 대상 함수: ${before.$id} "${before.name}" runtime=${before.runtime}`);
console.log(`  현재 활성 deployment: ${before.deployment || '(없음)'}`);
console.log(`  이벤트 ${before.events.length}개 (변경하지 않음)`);

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
console.log(`\n결과: 함수 활성 deployment = ${after.deployment}`);
console.log(after.deployment === dep.$id && status === 'ready'
  ? '✅ 재배포 완료 — 새 deployment 활성화됨'
  : `⚠️ 확인 필요 (status=${status}, active=${after.deployment})`);
process.exit(status === 'ready' ? 0 : 1);
