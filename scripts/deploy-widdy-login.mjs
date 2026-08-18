/**
 * widdy-login Appwrite Function 단독 배포(uid 하드닝). 다른 함수는 건드리지 않는다.
 * (통합 스크립트는 제거된 bridge-a2f 를 되살리므로 사용 금지)
 *
 * 실행: WIDDY_TOKEN_SECRET=<64hex> node scripts/deploy-widdy-login.mjs
 *   - WIDDY_TOKEN_SECRET: widdy-chat 과 동일한 HMAC 시크릿(둘 다 같아야 검증됨).
 *   - scopes: databases.read, documents.read (users 조회, 동적 키 사용)
 */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n]*)', 'm')) || [])[1];
const { Client, Functions, ID } = await import('node-appwrite');
const { InputFile } = await import('node-appwrite/file');

const SECRET = process.env.WIDDY_TOKEN_SECRET || '';
if (!SECRET || SECRET.length < 32) {
  console.error('✗ WIDDY_TOKEN_SECRET(≥32자) 를 환경변수로 전달하세요.');
  process.exit(1);
}
const DB_ID = get('VITE_APPWRITE_DATABASE_ID') || 'workfit';

const client = new Client()
  .setEndpoint(get('VITE_APPWRITE_ENDPOINT'))
  .setProject(get('VITE_APPWRITE_PROJECT_ID'))
  .setKey(get('APPWRITE_API_KEY'));
const fn = new Functions(client);

const FN_ID = 'widdy-login';
const TAR = 'appwrite/_deploy_bundles/widdy-login.tar.gz';
const SCOPES = ['databases.read', 'documents.read'];
const isCode = (e, c) => e && e.code === c;

// 1) 함수 생성/갱신 (execute any, node-22, timeout 30, scopes)
try {
  await fn.create(FN_ID, 'Widdy Login', 'node-22', ['any'], [], undefined, 30, true, true, 'src/main.js', 'npm install', SCOPES);
  console.log('  ✓ function 생성');
} catch (e) {
  if (!isCode(e, 409)) throw e;
  await fn.update(FN_ID, 'Widdy Login', 'node-22', ['any'], [], undefined, 30, true, true, 'src/main.js', 'npm install', SCOPES);
  console.log('  • function 존재 → 갱신');
}

// 2) env 변수 (멱등)
async function setVar(key, value) {
  try {
    await fn.createVariable(FN_ID, ID.unique(), key, value);
    console.log(`  ✓ var ${key}`);
  } catch (e) {
    if (!isCode(e, 409)) throw e;
    const list = await fn.listVariables(FN_ID);
    const found = list.variables.find((x) => x.key === key);
    if (found) { await fn.updateVariable(FN_ID, found.$id, key, value); console.log(`  • var ${key} 갱신`); }
  }
}
await setVar('WIDDY_TOKEN_SECRET', SECRET);
await setVar('APPWRITE_DATABASE_ID', DB_ID);

// 3) 코드 배포(tar.gz) + 활성화
const dep = await fn.createDeployment(FN_ID, InputFile.fromPath(TAR, `${FN_ID}.tar.gz`), true, 'src/main.js', 'npm install');
console.log(`  ✓ deployment 업로드 ${dep.$id} (status=${dep.status})`);
console.log('\n배포 요청 완료 — 콘솔 Deployments 에서 빌드 성공 확인.');
process.exit(0);
