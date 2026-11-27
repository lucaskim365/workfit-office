/**
 * PM 스크립트 운영 길 문 (설계 5.7.20 · 11/27 총괄 검수 P1 · P2 · P4 · P8 · P9) — 네트워크 · .env 읽기 없음 (가짜 env 글만).
 *   npx tsx --test scripts/pm-env.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compareRows, confirmError, PM_COLL_NAMES, PROD_PROJECT_ID, prodLogName, resolveDb, sharedArgs, sharedEnv, sharedHeadError, type DevDb } from './pm-env';

const DEV_ID = 'devproject000000';
const ENV = [
  'VITE_APPWRITE_ENDPOINT=https://aw.example/v1',
  `VITE_APPWRITE_PROJECT_ID=${DEV_ID}`,
  'VITE_APPWRITE_DATABASE_ID=workfit',
  'APPWRITE_API_KEY=dev-key',
  'APPWRITE_API_KEY_PROD=prod-key',
].join('\n');
const NO_PROD_KEY = ENV.replace(/^APPWRITE_API_KEY_PROD=.*$/m, '');
const argv = (...a: string[]) => ['node', 'scripts/pm-import.ts', ...a];
const PP = `--prod-project=${PROD_PROJECT_ID}`;

test('--prod 한 단어 (와 --prod=…) 는 언제나 거절', () => {
  for (const a of ['--prod', '--prod=1', '--production']) {
    const r = resolveDb(argv('--dry-run', a), [ENV], { prodOk: true });
    assert.equal(r.ok, false, a);
  }
  assert.equal(resolveDb(argv('--prod', PP), [ENV], { prodOk: true }).ok, false);
});

test('--prod-project 값이 운영 ID 와 글자 그대로 다르면 거절', () => {
  for (const a of ['--prod-project=', '--prod-project', `--prod-project=${PROD_PROJECT_ID} `, `--prod-project=${PROD_PROJECT_ID.toUpperCase()}`, `--prod-project=${DEV_ID}`]) {
    const r = resolveDb(argv(a), [ENV], { prodOk: true });
    assert.equal(r.ok, false, a);
  }
  assert.equal(resolveDb(argv(PP, PP), [ENV], { prodOk: true }).ok, false, '두 번');
});

test('운영 길: 운영 열쇠만 · 프로젝트는 상수 · 없으면 개발 열쇠로 안 넘어가고 멈춤', () => {
  const r = resolveDb(argv(PP), [ENV], { prodOk: true });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.db, { endpoint: 'https://aw.example/v1', project: PROD_PROJECT_ID, database: 'workfit', key: 'prod-key', prod: true });
  const n = resolveDb(argv(PP), [NO_PROD_KEY], { prodOk: true });
  assert.equal(n.ok, false);
  if (!n.ok) assert.match(n.msg, /APPWRITE_API_KEY_PROD/);
});

test('prodOk 없는 스크립트(pm-k5)는 --prod-project 자체를 거절', () => {
  assert.equal(resolveDb(argv(PP), [ENV]).ok, false);
  assert.equal(resolveDb(argv(PP), [ENV], { prodOk: false }).ok, false);
  const src = readFileSync('scripts/pm-k5.ts', 'utf8');
  assert.ok(!/prodOk/.test(src.replace(/\/\/.*$/gm, '')), 'pm-k5 는 prodOk 를 주지 않음');
});

test('개발 길 그대로: 개발 열쇠 · .env 의 개발 ID · 운영 ID 면 거절 · 값 없으면 거절', () => {
  const r = resolveDb(argv('--dry-run'), [ENV]);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.db, { endpoint: 'https://aw.example/v1', project: DEV_ID, database: 'workfit', key: 'dev-key', prod: false });
  assert.equal(resolveDb(argv(), [ENV.replace(DEV_ID, PROD_PROJECT_ID)], { prodOk: true }).ok, false, '.env 가 운영 ID');
  assert.equal(resolveDb(argv(), [ENV.replace(/^APPWRITE_API_KEY=.*$/m, '')]).ok, false, '개발 열쇠 없음 — 운영 열쇠로 안 넘어감');
  // 먼저 나온 파일 값 · 따옴표 · 주석
  const r2 = resolveDb(argv(), ['VITE_APPWRITE_ENDPOINT="https://a/v1"\nVITE_APPWRITE_PROJECT_ID=p1 # 주석\nAPPWRITE_API_KEY=\'k1\'', ENV]);
  assert.ok(r2.ok);
  if (r2.ok) assert.deepEqual([r2.db.endpoint, r2.db.project, r2.db.key, r2.db.database], ['https://a/v1', 'p1', 'k1', 'workfit']);
});

test('쓰기 문 --confirm: 없음 · 다름 → 이유, 같음 → null', () => {
  assert.match(confirmError(argv('--write'), 23, '운영 쓰기 수') ?? '', /없음/);
  assert.match(confirmError(argv('--write', '--confirm=22'), 23, '운영 쓰기 수') ?? '', /--confirm=23/);
  assert.notEqual(confirmError(argv('--write', '--confirm=023'), 23, 'x'), null);
  assert.equal(confirmError(argv('--write', '--confirm=23'), 23, 'x'), null);
});

test('자식 인자: --only 없는 길 없음 · 23개 밖 이름 거절 · 운영이면 --prod', () => {
  assert.throws(() => sharedArgs([], { dryRun: false, prod: true }));
  assert.throws(() => sharedArgs(['pmProjects', 'creditLimits'], { dryRun: false, prod: true }));
  const all = sharedArgs(PM_COLL_NAMES, { dryRun: false, prod: true });
  assert.deepEqual(all, ['--import', 'tsx', 'scripts/appwrite-schema.ts', `--only=${PM_COLL_NAMES.join(',')}`, '--new-only', '--prod']);
  assert.deepEqual(sharedArgs(['pmMoney'], { dryRun: true, prod: false }), ['--import', 'tsx', 'scripts/appwrite-schema.ts', '--only=pmMoney', '--new-only', '--dry-run']);
  assert.equal(PM_COLL_NAMES.length, 23);
  // pm-schema 는 자식 인자를 sharedArgs 로만 만든다
  const src = readFileSync('scripts/pm-schema.ts', 'utf8');
  assert.ok(!src.includes("'scripts/appwrite-schema.ts'"), 'pm-schema 안에 자식 인자를 따로 쓰지 않음');
});

test('자식 환경: 운영이면 두 열쇠 이름 모두 운영 열쇠, 개발이면 _PROD 를 지움', () => {
  const prod: DevDb = { endpoint: 'e', project: PROD_PROJECT_ID, database: 'workfit', key: 'prod-key', prod: true };
  const dev: DevDb = { endpoint: 'e', project: DEV_ID, database: 'workfit', key: 'dev-key', prod: false };
  const base = { PATH: 'x', APPWRITE_API_KEY: 'shell-dev', APPWRITE_API_KEY_PROD: 'shell-prod' };
  const p = sharedEnv(base, prod);
  assert.deepEqual([p.APPWRITE_API_KEY, p.APPWRITE_API_KEY_PROD, p.APPWRITE_PROJECT_ID], ['prod-key', 'prod-key', PROD_PROJECT_ID]);
  const d = sharedEnv(base, dev);
  assert.deepEqual([d.APPWRITE_API_KEY, d.APPWRITE_API_KEY_PROD, d.APPWRITE_PROJECT_ID], ['dev-key', undefined, DEV_ID]);
});

test('자식 dry-run 첫 줄 확인', () => {
  const prod: DevDb = { endpoint: 'e', project: PROD_PROJECT_ID, database: 'workfit', key: 'k', prod: true };
  const ok = `▶ Appwrite 스키마 적용 — e / project ${PROD_PROJECT_ID} / db workfit\n  대상 한정: pmA, pmB\n  모드: 새 컬렉션 생성만(기존 컬렉션·데이터 무변경)\n  모드: dry-run(조회만, 쓰기 없음)`;
  assert.equal(sharedHeadError(ok, prod, ['pmA', 'pmB']), null);
  assert.notEqual(sharedHeadError(ok.replace(PROD_PROJECT_ID, DEV_ID), prod, ['pmA', 'pmB']), null);
  assert.notEqual(sharedHeadError(ok, prod, ['pmA']), null);
  assert.notEqual(sharedHeadError(ok.replace('새 컬렉션 생성만', ''), prod, ['pmA', 'pmB']), null);
});

test('넣을 줄 vs DB 대조: 없음 · 줄에 없음 · 내용 다름 · 같음 (없음 = null)', () => {
  const want = new Map<string, Record<string, unknown>>([
    ['a', { id: 'a', kind: '', at: 0, seq: 0, body: '{"x":1}', projectId: undefined }],
    ['b', { id: 'b', kind: '', at: 0, seq: 1, body: '{"x":2}' }],
    ['c', { id: 'c', kind: '', at: 0, seq: 2, body: '{"x":3}', tags: ['t'] }],
  ]);
  const got = new Map<string, Record<string, unknown>>([
    ['a', { $id: 'a', $createdAt: 'z', id: 'a', kind: '', at: 0, seq: 0, body: '{"x":1}', projectId: null }],
    ['c', { $id: 'c', id: 'c', kind: '', at: 0, seq: 2, body: '{"x":9}', tags: ['t'] }],
    ['z', { $id: 'z', id: 'z' }],
  ]);
  assert.deepEqual(compareRows(want, got), { missing: ['b'], extra: ['z'], changed: ['c(body)'], same: 1 });
});

test('쓰기 · 지우기 호출 목록 고정 — 넣기 = createDocument 하나, 확인 스크립트 = 읽기만', () => {
  const calls = (f: string) => [...new Set([...readFileSync(`scripts/${f}`, 'utf8').matchAll(/\bdbs\.(\w+)\(/g)].map((m) => m[1]))].sort();
  assert.deepEqual(calls('pm-import.ts'), ['createDocument', 'listDocuments']);
  assert.deepEqual(calls('pm-zz-check.ts'), ['listDocuments']);
  assert.deepEqual(calls('pm-drop.ts'), ['deleteCollection', 'deleteDocument', 'listCollections', 'listDocuments']);
  assert.deepEqual(calls('pm-schema.ts'), ['createIndex', 'getCollection', 'listAttributes', 'listCollections', 'listDocuments', 'updateCollection']);
  // Databases 를 다른 이름으로 들고 다니지 않음 (위 목록이 빠짐없게)
  for (const f of ['pm-import.ts', 'pm-zz-check.ts', 'pm-drop.ts', 'pm-schema.ts']) {
    const src = readFileSync(`scripts/${f}`, 'utf8');
    assert.equal([...src.matchAll(/new Databases\(/g)].length, 1, f);
    assert.ok(/const dbs = new Databases\(/.test(src), f);
  }
});

test('운영 기록 파일 이름', () => {
  assert.equal(prodLogName(new Date('2026-12-01T00:05:09Z'), 'pm-import', '쓰기'), '20261201-090509-pm-import-쓰기.log');
});
