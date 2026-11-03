// 좌석배치도에 '연구소' 한 장을 추가한다(기업부설연구소 사무실 도면 기준). 이미 있으면 아무것도 바꾸지 않는다.
// 실행: node scripts/add-lab-seat-layout.mjs [--prod]
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '\\s*=\\s*"?([^"\\n\\r]*)', 'm')) || [])[1]?.trim();
const isProd = process.argv.includes('--prod');
const [project, key] = isProd
  ? ['6a6bf85e002acb7f71d6', get('APPWRITE_API_KEY_PROD')]
  : [get('VITE_APPWRITE_PROJECT_ID'), get('APPWRITE_API_KEY')];
const H = { 'X-Appwrite-Project': project, 'X-Appwrite-Key': key, 'Content-Type': 'application/json' };
const col = `${get('VITE_APPWRITE_ENDPOINT')}/databases/workfit/collections/seatLayouts/documents`;

// 운영·개발의 사용자 ID 가 달라 이름으로 찾는다. 계정이 없으면 공석에 이름만 메모로 둔다.
const usersUrl = `${get('VITE_APPWRITE_ENDPOINT')}/databases/workfit/collections/users/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [200] }))}`;
const users = (await (await fetch(usersUrl, { headers: H, signal: AbortSignal.timeout(20000) })).json()).documents;
const idOf = (name) => users.find((u) => String(u.name).trim() === name && u.status === '사용')?.id ?? null;

const seat = (id, c, r, cs, rs, name = '') => {
  const userId = name ? idOf(name) : null;
  return { id, kind: 'seat', col: c, row: r, colSpan: cs, rowSpan: rs, userId, label: name && !userId ? name : '' };
};
const blocks = [
  { id: 'L1', kind: 'label', col: 2, row: 2, colSpan: 4, rowSpan: 2, userId: null, label: '출입구' },
  seat('S1', 8, 5, 5, 3),
  seat('S2', 13, 5, 5, 3, '신지웅'),
  seat('S3', 18, 5, 5, 5, '유지승'),
  seat('S4', 0, 11, 3, 4),
  seat('S5', 0, 15, 3, 4),
  { id: 'R1', kind: 'room', col: 9, row: 14, colSpan: 7, rowSpan: 4, userId: null, label: '회의용 테이블' },
  seat('S6', 8, 19, 5, 3),
  seat('S7', 13, 19, 5, 3),
];
const grid = { cols: 23, rows: 22, blocks };

// 칸 밖으로 나가거나 겹치면 저장하지 않는다
for (const [i, a] of blocks.entries()) {
  if (a.col + a.colSpan > grid.cols || a.row + a.rowSpan > grid.rows) throw new Error(`칸 밖: ${a.id}`);
  for (const b of blocks.slice(i + 1)) {
    const apart = a.col + a.colSpan <= b.col || b.col + b.colSpan <= a.col || a.row + a.rowSpan <= b.row || b.row + b.rowSpan <= a.row;
    if (!apart) throw new Error(`겹침: ${a.id} ${b.id}`);
  }
}

const list = (await (await fetch(col, { headers: H, signal: AbortSignal.timeout(20000) })).json()).documents;
const found = list.find((d) => String(d.name).trim() === '연구소');
if (found) {
  console.log(`${isProd ? '운영' : '개발'}: 이미 있음 ${found.$id} — 바꾸지 않습니다`);
  process.exit(0);
}
const documentId = `SL-${Date.now()}`;
const r = await fetch(col, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ documentId, data: { name: '연구소', grid: JSON.stringify(grid), sortOrder: list.length, updatedBy: 'script', updatedAt: new Date().toISOString() } }),
  signal: AbortSignal.timeout(20000),
});
const j = await r.json();
console.log(`${isProd ? '운영' : '개발'}:`, r.status, r.ok ? `${j.$id} ${j.name}` : j.message);
console.log('좌석', blocks.filter((b) => b.kind === 'seat').map((b) => `${b.id}=${b.userId ?? (b.label || '공석')}`).join(' '));
process.exit(r.ok ? 0 : 1);
