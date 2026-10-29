import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * caps-ingest 조회의 열람 범위(resolveViewerScope) — 필요한 문서만 조건으로 묻고도 예전 규칙과 같은 결과를 내는지.
 * 가짜 DB 는 equal·limit·cursorAfter 를 실제처럼 적용하고, 조건 없는 전량 조회가 있었는지 기록한다.
 */
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const DATA = {
  users: [
    { $id: 'a1', id: 'U001', name: '홍길동', empNo: '1001' },
    { $id: 'a2', id: 'U002', name: '김임원', empNo: '1002' },
    { $id: 'a3', id: 'U033', name: '이부장', empNo: '1003' },
    { $id: 'a4', id: 'U004', name: '박팀장', empNo: '1004' },
    { $id: 'a5', id: 'U005', name: '최사원', empNo: '1005' },
    { $id: 'a6', id: 'U006', name: '정상무', empNo: '1006' },
    { $id: 'a7', id: 'U007', name: '옛사원', empNo: '1007' },
  ],
  employeeProfiles: [
    { $id: 'p1', userId: 'U001', deptId: 'D1', positionId: 'P1', jobTitleId: null },
    { $id: 'p3', userId: 'U033', deptId: 'D1', positionId: 'P1', jobTitleId: null },
    { $id: 'p4', userId: 'U004', deptId: 'D2', positionId: 'P1', jobTitleId: 'J1' },
    { $id: 'p5', userId: 'U005', deptId: 'D2', positionId: 'P1', jobTitleId: null },
    { $id: 'p6', userId: 'U006', deptId: 'D9', positionId: 'P9', jobTitleId: null },
    // ID 를 아직 안 채운 예전 프로필 — 부서 이름으로 찾는다
    { $id: 'p7', userId: 'U007', dept: '개발1팀', position: '사원', jobTitle: '' },
  ],
  departments: [
    { $id: 'D1', name: '개발1팀', headUserId: 'U033' },
    { $id: 'D2', name: '개발2팀', headUserId: null },
    { $id: 'D9', name: '경영지원', headUserId: null },
  ],
  positions: [{ $id: 'P1', name: '사원' }, { $id: 'P9', name: '상무이사' }],
  jobTitles: [{ $id: 'J1', name: '팀장' }],
  employees: [
    { $id: 'e1', empId: 11, name: '홍길동' },
    { $id: 'e3', empId: 13, name: '이부장' },
    { $id: 'e4', empId: 14, name: '박팀장' },
    { $id: 'e5', empId: 15, name: '최사원' },
    { $id: 'e7', empId: 17, name: '옛사원' },
  ],
  roleMappings: [{ $id: 'r1', roleCode: 'EXEC', targetType: 'USER', targetId: 'U002' }],
  attendance: [
    { $id: 'a11', empId: 11, date: '2026-10-01', inAt: '09:00', status: 'normal' },
    { $id: 'a12', empId: 11, date: '2026-10-02', inAt: '09:05', status: 'late' },
    { $id: 'a13', empId: 13, date: '2026-10-01', inAt: '08:50', status: 'normal' },
    { $id: 'a14', empId: 11, date: '2026-09-30', inAt: '09:00', status: 'normal' },
  ],
};

function fixture() {
  const calls = [];
  const Query = {
    equal: (key, value) => ({ t: 'equal', key, values: Array.isArray(value) ? value : [value] }),
    limit: (n) => ({ t: 'limit', n }),
    cursorAfter: (id) => ({ t: 'after', id }),
    greaterThanEqual: (key, value) => ({ t: 'gte', key, value }),
    lessThanEqual: (key, value) => ({ t: 'lte', key, value }),
  };
  let uid = null;
  const extra = {
    resolveUserId: () => uid,
    Client: class { setEndpoint() { return this; } setProject() { return this; } setKey() { return this; } },
    Databases: class { constructor() { return dbs; } },
  };
  // 적재 경로의 스키마(zod)는 이 테스트와 상관없다 — 어떤 호출·속성이든 받아 주는 자리 표시
  const anything = new Proxy(function () {}, { get: () => anything, apply: () => anything });
  const context = vm.createContext({ z: anything, Query, console, ...extra });
  const scope = read('appwrite/functions/caps-ingest/src/scope.js').replace(/^export /gm, '');
  const source = read('appwrite/functions/caps-ingest/src/main.js')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace('export default async', 'const entry = async');
  vm.runInContext(`${scope}\n${source}\nglobalThis.resolveViewerScope = resolveViewerScope; globalThis.handleAppRead = handleAppRead;`, context);
  const dbs = {
    listDocuments: async (_db, coll, queries) => {
      const filters = queries.filter((q) => q.t === 'equal');
      calls.push({ coll, filtered: filters.length > 0 });
      let rows = (DATA[coll] ?? []).filter((r) => filters.every((f) => f.values.includes(r[f.key])));
      for (const q of queries) {
        if (q.t === 'gte') rows = rows.filter((r) => r[q.key] >= q.value);
        if (q.t === 'lte') rows = rows.filter((r) => r[q.key] <= q.value);
      }
      const after = queries.find((q) => q.t === 'after');
      if (after) rows = rows.slice(rows.findIndex((r) => r.$id === after.id) + 1);
      const limit = queries.find((q) => q.t === 'limit');
      return { documents: limit ? rows.slice(0, limit.n) : rows };
    },
  };
  const resolve = async (uid) => {
    const s = await context.resolveViewerScope(dbs, 'workfit', uid, () => {});
    return { kind: s.kind, empIds: s.empIds === null ? null : [...s.empIds].sort(), deptNames: [...s.deptNames], myEmpId: s.myEmpId };
  };
  /** 화면 조회 요청 하나를 그대로 보낸다 — { status, body } */
  const request = async (who, action, payload = {}) => {
    uid = who;
    let out;
    const res = { json: (body, status = 200) => { out = { status, body: JSON.parse(JSON.stringify(body)) }; return out; } };
    await context.handleAppRead({ req: { bodyJson: { action, payload } }, res, log: () => {}, error: () => {}, endpoint: '', projectId: '', apiKey: '', DB: 'workfit' });
    return out;
  };
  return { resolve, calls, request };
}

test('일반 사원: 본인만', async () => {
  const { resolve } = fixture();
  assert.deepEqual(await resolve('U001'), { kind: 'self', empIds: [11], deptNames: [], myEmpId: 11 });
});

test('임원·운영자 매핑에 있으면 전사(직원 데이터가 없어도)', async () => {
  const { resolve } = fixture();
  assert.deepEqual(await resolve('U002'), { kind: 'admin', empIds: null, deptNames: [], myEmpId: null });
});

test('직급이 임원 명칭(상무이사)이면 전사', async () => {
  const { resolve } = fixture();
  assert.equal((await resolve('U006')).kind, 'admin');
});

test('부서장(headUserId): 맡은 부서 전원 — 인명관리 ID 가 없는 예전 프로필도 부서 이름으로 포함', async () => {
  const { resolve } = fixture();
  assert.deepEqual(await resolve('U033'), { kind: 'head', empIds: [11, 13, 17], deptNames: ['개발1팀'], myEmpId: 13 });
});

test('부서장 지정이 없어도 팀장 직책이면 자기 부서 전원', async () => {
  const { resolve } = fixture();
  assert.deepEqual(await resolve('U004'), { kind: 'head', empIds: [14, 15], deptNames: ['개발2팀'], myEmpId: 14 });
});

test('예전 프로필(ID 없음)도 이름 칸으로 소속을 풀어 본인 범위', async () => {
  const { resolve } = fixture();
  assert.deepEqual(await resolve('U007'), { kind: 'self', empIds: [17], deptNames: [], myEmpId: 17 });
});

test('모르는 계정은 아무것도 못 본다', async () => {
  const { resolve } = fixture();
  assert.deepEqual(await resolve('U999'), { kind: 'self', empIds: [], deptNames: [], myEmpId: null });
});

test('어떤 경우에도 조건 없는 전량 조회를 하지 않는다', async () => {
  for (const uid of ['U001', 'U002', 'U033', 'U004', 'U006', 'U007', 'U999']) {
    const { resolve, calls } = fixture();
    await resolve(uid);
    assert.deepEqual(calls.filter((c) => !c.filtered).map((c) => c.coll), [], uid);
  }
});

test('bootstrap: 한 번에 받는 내용이 따로 받을 때(viewerScope·listEmployees·listMonth)와 같다 — 일반 사원', async () => {
  const { request } = fixture();
  const boot = await request('U001', 'bootstrap', { month: '2026-10', includeAll: false });
  assert.equal(boot.status, 200);
  assert.deepEqual(boot.body.data.viewer, (await request('U001', 'viewerScope')).body.data);
  assert.deepEqual(boot.body.data.employees, (await request('U001', 'listEmployees')).body.data);
  assert.deepEqual(boot.body.data.myMonth, (await request('U001', 'listMonth', { empId: 11, month: '2026-10' })).body.data);
  assert.deepEqual(boot.body.data.myMonth.map((r) => r.date), ['2026-10-01', '2026-10-02']);
  assert.equal(boot.body.data.monthAll, null);
});

test('bootstrap: includeAll 이어도 볼 수 있는 사람 것만 — 일반 사원은 남의 근태가 안 섞인다', async () => {
  const { request } = fixture();
  const boot = await request('U001', 'bootstrap', { month: '2026-10', includeAll: true });
  assert.deepEqual(boot.body.data.monthAll.map((r) => r.empId), [11, 11]);
  assert.deepEqual(boot.body.data.monthAll, (await request('U001', 'listMonthAll', { month: '2026-10' })).body.data);
});

test('bootstrap: 관리자는 전 직원·전 직원 한 달, 내 사번이 없으면 내 한 달은 null', async () => {
  const { request } = fixture();
  const boot = await request('U002', 'bootstrap', { month: '2026-10', includeAll: true });
  assert.equal(boot.body.data.viewer.kind, 'admin');
  assert.equal(boot.body.data.employees.length, 5);
  assert.equal(boot.body.data.myMonth, null);
  assert.deepEqual(boot.body.data.monthAll.map((r) => r.empId).sort(), [11, 11, 13]);
});

test('bootstrap: 조회 월 형식이 틀리면 400', async () => {
  const { request } = fixture();
  assert.equal((await request('U001', 'bootstrap', { month: '2026/10' })).status, 400);
});
