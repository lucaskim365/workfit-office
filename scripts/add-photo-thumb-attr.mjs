// users 컬렉션에 빈 칸 photoThumbUrl 하나만 추가한다. 문서는 건드리지 않는다. 실행: node scripts/add-photo-thumb-attr.mjs [--prod]
import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n\\r]*)', 'm')) || [])[1]?.trim();
const ep = get('VITE_APPWRITE_ENDPOINT') + '/databases/workfit/collections/users/attributes';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const target = process.argv.includes('--prod') ? ['운영', '6a6bf85e002acb7f71d6', get('APPWRITE_API_KEY_PROD')] : ['개발', get('VITE_APPWRITE_PROJECT_ID'), get('APPWRITE_API_KEY')];
for (const [name, project, key] of [target]) {
  const H = { 'X-Appwrite-Project': project, 'X-Appwrite-Key': key, 'Content-Type': 'application/json' };
  const before = await (await fetch(`${ep}/photoUrl`, { headers: H, signal: AbortSignal.timeout(15000) })).json();
  console.log(name, 'photoUrl 기준', before.type, before.size, 'required', before.required);
  const r = await fetch(`${ep}/string`, { method: 'POST', headers: H, body: JSON.stringify({ key: 'photoThumbUrl', size: 512, required: false, default: null, array: false }), signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  console.log(name, 'create', r.status, j.status ?? j.message);
  if (!r.ok && r.status !== 409) process.exit(1);
  for (let i = 0; i < 30; i++) {
    const a = await (await fetch(`${ep}/photoThumbUrl`, { headers: H, signal: AbortSignal.timeout(15000) })).json();
    if (a.status === 'available') { console.log(name, 'available'); break; }
    if (a.status === 'failed') { console.log(name, 'failed', a.error); process.exit(1); }
    await sleep(1000);
  }
}
process.exit(0);
