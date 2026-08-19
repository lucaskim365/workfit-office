/**
 * Appwrite 함수 배포(API) — push-notifications + bridge-a2f. Console/CLI 없이 프로그램 배포.
 * 필요: API 키에 functions.read/write + (푸시용) databases 스코프.
 * 실행: node scripts/appwrite-deploy-functions.mjs
 */
// import { readFileSync } from 'node:fs'; // (기존 코드 보존)
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n]*)', 'm')) || [])[1];
const { Client, Functions, ID } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

const client = new Client()
  .setEndpoint(get('VITE_APPWRITE_ENDPOINT'))
  .setProject(get('VITE_APPWRITE_PROJECT_ID'))
  .setKey(get('APPWRITE_API_KEY'));
const fn = new Functions(client);
const DB = get('VITE_APPWRITE_DATABASE_ID');

// FCM 서비스계정 JSON(파일 전체 내용) — 함수 env 로 주입.
// const keyFile = 'workfit-office-app-firebase-adminsdk-fbsvc-0b470346f3.json'; // (기존 코드 보존)
const keyFile = 'service-account.json';
const FCM = readFileSync(resolve(process.cwd(), keyFile), 'utf8');

const evChat = (act) => `databases.${DB}.collections.chatMessages.documents.*.${act}`;
const evNoti = (act) => `databases.${DB}.collections.notifications.documents.*.${act}`;
const bridgeColls = ['chatMessages', 'chatRooms', 'notifications', 'documentExecutions', 'approvalDocs', 'users'];
const bridgeEvents = bridgeColls.flatMap((c) =>
  ['create', 'update', 'delete'].map((a) => `databases.${DB}.collections.${c}.documents.*.${a}`),
);

const isCode = (e, c) => e && e.code === c;

async function ensureFunction(spec) {
  console.log(`\n[${spec.id}] ${spec.name}`);
  
  // 0) 실시간 코드 압축 (tar.gz 자동 생성)
  const bundleDir = 'appwrite/_deploy_bundles';
  if (!existsSync(bundleDir)) {
    mkdirSync(bundleDir, { recursive: true });
  }
  const sourceDir = `appwrite/functions/${spec.id}`;
  console.log(`  [Bundle] 압축 중: ${sourceDir} -> ${spec.tar}`);
  try {
    execSync(`tar -czf ${spec.tar} -C ${sourceDir} .`);
    console.log(`  ✓ 압축 완료`);
  } catch (e) {
    console.error(`  ✗ 압축 실패:`, e.message);
    throw e;
  }

  // 1) 함수 생성(있으면 업데이트로 이벤트/스코프 반영)
  try {
    await fn.create(
      spec.id, spec.name, 'node-22', [], spec.events, undefined, 30, true, true, spec.entrypoint, 'npm install', spec.scopes,
    );
    console.log('  ✓ function 생성');
  } catch (e) {
    if (!isCode(e, 409)) throw e;
    await fn.update(spec.id, spec.name, 'node-22', [], spec.events, undefined, 30, true, true, spec.entrypoint, 'npm install', spec.scopes);
    console.log('  • function 존재 → 이벤트/스코프 업데이트');
  }
  // 2) env 변수(멱등: 있으면 갱신)
  for (const [k, v, secret] of spec.vars) {
    try {
      await fn.createVariable(spec.id, ID.unique(), k, v, secret);
      console.log(`  ✓ var ${k}`);
    } catch (e) {
      if (!isCode(e, 409)) throw e;
      // 기존 변수 id 찾아 업데이트
      const list = await fn.listVariables(spec.id);
      const found = list.variables.find((x) => x.key === k);
      if (found) {
        await fn.updateVariable(spec.id, found.$id, k, v, secret);
        console.log(`  • var ${k} 갱신`);
      }
    }
  }
  // 3) 코드 배포(tar.gz 업로드) + 활성화
  const dep = await fn.createDeployment(
    spec.id, InputFile.fromPath(spec.tar, `${spec.id}.tar.gz`), true, spec.entrypoint, 'npm install',
  );
  console.log(`  ✓ deployment 업로드 (${dep.$id}) — 빌드 진행됨(콘솔 로그에서 확인)`);
}

async function main() {
  console.log(`▶ Appwrite 함수 배포 — db ${DB}`);
  await ensureFunction({
    id: 'push-notifications',
    name: 'Push Notifications',
    entrypoint: 'src/main.js',
    events: [evChat('create'), evNoti('create')],
    scopes: ['databases.read', 'documents.read', 'documents.write'],
    vars: [['FCM_SERVICE_ACCOUNT', FCM, true], ['APPWRITE_DATABASE_ID', DB, false]],
    tar: 'appwrite/_deploy_bundles/push-notifications.tar.gz',
  });
  /*
  await ensureFunction({
    id: 'bridge-a2f',
    name: 'Dual-Write Bridge A->F',
    entrypoint: 'src/main.js',
    events: bridgeEvents,
    scopes: [], // A→F 는 Firestore(firebase-admin)만 씀 — Appwrite 스코프 불필요
    vars: [['FCM_SERVICE_ACCOUNT', FCM, true], ['APPWRITE_DATABASE_ID', DB, false]],
    tar: 'appwrite/_deploy_bundles/bridge-a2f.tar.gz',
  });
  */
  // 근태 인제스트는 DB 이벤트가 아니라 사내 C# 에이전트의 HTTP POST로 깨어난다.
  // secret이 없으면 모든 요청이 401이 되므로 배포 전에 .env.local에 채워야 한다.
  const capsSecret = get('CAPS_INGEST_SECRET');
  if (!capsSecret) {
    console.warn('\n⚠ CAPS_INGEST_SECRET 이 .env.local 에 없어 caps-ingest 배포를 건너뜁니다.');
    console.warn('  에이전트 secret.txt 와 같은 값을 넣고 다시 실행하세요.');
  } else {
    await ensureFunction({
      id: 'caps-ingest',
      name: 'CAPS Attendance Ingest',
      entrypoint: 'src/main.js',
      events: [], // HTTP 트리거 전용
      scopes: ['databases.read', 'documents.read', 'documents.write'],
      vars: [['CAPS_INGEST_SECRET', capsSecret, true], ['APPWRITE_DATABASE_ID', DB, false]],
      tar: 'appwrite/_deploy_bundles/caps-ingest.tar.gz',
    });
  }
  console.log('\n✅ 배포 요청 완료. 각 함수 콘솔 Deployments 에서 빌드 성공 확인 후 활성 상태인지 점검.');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n✗ 배포 실패:', e.code || '', e.type || '', e.message);
  process.exit(1);
});
