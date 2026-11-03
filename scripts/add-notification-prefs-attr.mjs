// users 컬렉션에 빈 칸 notificationPrefs(알림 설정 JSON) 하나만 추가한다. 문서는 건드리지 않는다.
// 실행: node scripts/add-notification-prefs-attr.mjs [--prod]
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n\\r]*)', 'm')) || [])[1]?.trim();
const isProd = process.argv.includes('--prod');
const [project, key] = isProd
  ? ['6a6bf85e002acb7f71d6', get('APPWRITE_API_KEY_PROD')]
  : [get('VITE_APPWRITE_PROJECT_ID'), get('APPWRITE_API_KEY')];
const name = isProd ? '운영' : '개발';
const ep = `${get('VITE_APPWRITE_ENDPOINT')}/databases/workfit/collections/users/attributes`;
const H = { 'X-Appwrite-Project': project, 'X-Appwrite-Key': key, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const r = await fetch(`${ep}/string`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ key: 'notificationPrefs', size: 200, required: false }),
  signal: AbortSignal.timeout(15000),
});
const j = await r.json();
console.log(name, 'create', r.status, j.status ?? j.message);
if (!r.ok && r.status !== 409) process.exit(1);

for (let i = 0; i < 30; i++) {
  const a = await (await fetch(`${ep}/notificationPrefs`, { headers: H, signal: AbortSignal.timeout(15000) })).json();
  if (a.status === 'available') {
    console.log(name, 'available');
    process.exit(0);
  }
  if (a.status === 'failed') {
    console.log(name, 'failed', a.error);
    process.exit(1);
  }
  await sleep(1000);
}
console.log(name, '시간 초과 — 상태를 다시 확인하세요');
process.exit(1);
