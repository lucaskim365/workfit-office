import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * caps-ingest 조회의 기준 목록 재사용(loadReference) — 화면이 요청 여러 개를 한꺼번에 보내도
 * 직원·계정·인명관리 등 전량 조회는 한 번만 하고, 잠깐은 다시 쓰며, 적재 뒤에는 버리는지.
 */
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function fixture() {
  let now = 1_000_000;
  const calls = [];
  // 적재 경로의 스키마(zod)는 이 테스트와 상관없다 — 어떤 호출·속성이든 받아 주는 자리 표시
  const anything = new Proxy(function () {}, { get: () => anything, apply: () => anything });
  const context = vm.createContext({
    z: anything,
    Date: { now: () => now },
    Query: {
      limit: (n) => `limit:${n}`,
      cursorAfter: (c) => `after:${c}`,
      equal: (k, v) => `equal:${k}:${v}`,
    },
    affiliationOf: () => ({}),
    headScope: () => ({ deptNames: [], memberNames: new Set() }),
    matchesExecMapping: (m, who) => m.userId === who.uid,
    console,
  });
  const source = read('appwrite/functions/caps-ingest/src/main.js')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace('export default async', 'const entry = async');
  vm.runInContext(`${source}\nglobalThis.resolveViewerScope = resolveViewerScope; globalThis.clearReferenceCache = clearReferenceCache;`, context);
  const rows = {
    employees: [{ $id: 'e1', empId: 7, name: '홍길동' }],
    users: [{ $id: 'u1', id: 'U001', name: '홍길동', empNo: '1' }, { $id: 'u2', id: 'U002', name: '임원' }],
    roleMappings: [{ $id: 'r1', userId: 'U002', roleCode: 'EXEC' }],
  };
  const dbs = {
    listDocuments: async (_db, coll) => {
      calls.push(coll);
      await new Promise((r) => setImmediate(r));
      return { documents: rows[coll] ?? [] };
    },
  };
  return { context, dbs, calls, advance: (ms) => { now += ms; } };
}

test('동시에 온 요청 여러 개는 기준 목록을 한 번만 받는다', async () => {
  const { context, dbs, calls } = fixture();
  const scopes = await Promise.all([1, 2, 3, 4, 5].map(() => context.resolveViewerScope(dbs, 'workfit', 'U001', () => {})));
  assert.equal(calls.length, 7); // 직원·계정·인명관리·부서·직급·직책·임원 매핑 각 1번
  for (const s of scopes) {
    assert.equal(s.myEmpId, 7);
    assert.equal(s.kind, 'self');
  }
});

test('1분 안에는 다시 받지 않고, 지나면 다시 받는다', async () => {
  const { context, dbs, calls, advance } = fixture();
  await context.resolveViewerScope(dbs, 'workfit', 'U001', () => {});
  advance(30_000);
  await context.resolveViewerScope(dbs, 'workfit', 'U002', () => {});
  assert.equal(calls.length, 7);
  advance(31_000);
  await context.resolveViewerScope(dbs, 'workfit', 'U001', () => {});
  assert.equal(calls.length, 14);
});

test('에이전트 적재 뒤(clearReferenceCache)에는 바로 다시 받는다', async () => {
  const { context, dbs, calls } = fixture();
  await context.resolveViewerScope(dbs, 'workfit', 'U001', () => {});
  context.clearReferenceCache();
  await context.resolveViewerScope(dbs, 'workfit', 'U001', () => {});
  assert.equal(calls.length, 14);
});

test('임원 매핑은 기억해 둔 목록으로도 그대로 판정한다', async () => {
  const { context, dbs } = fixture();
  await context.resolveViewerScope(dbs, 'workfit', 'U001', () => {});
  const admin = await context.resolveViewerScope(dbs, 'workfit', 'U002', () => {});
  assert.equal(admin.kind, 'admin');
  assert.equal(admin.empIds, null);
});

test('받다가 실패하면 기억하지 않고 다음 요청이 다시 받는다', async () => {
  const { context, dbs, calls } = fixture();
  let fail = true;
  const flaky = { listDocuments: async (...args) => { if (fail && args[1] === 'users') throw new Error('timeout'); return dbs.listDocuments(...args); } };
  await assert.rejects(() => context.resolveViewerScope(flaky, 'workfit', 'U001', () => {}));
  fail = false;
  const scope = await context.resolveViewerScope(flaky, 'workfit', 'U001', () => {});
  assert.equal(scope.myEmpId, 7);
  assert.ok(calls.length >= 7);
});
