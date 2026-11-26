import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pmSchemaTotals, pmSchemaWant, resumePlan, type PmCollGot, type PmCollWant } from './pmSchemaPlan';

/** 7-4 --resume 대조 (팀장 통과 조건 7) — 가짜 '읽은 값'으로 */
const want = pmSchemaWant();
/** 정의 그대로 다 만들어진 모양 */
const built = (w: PmCollWant): PmCollGot => ({
  $id: w.id, name: w.name, documentSecurity: false, $permissions: [...w.permissions],
  attributes: w.attributes.map((a) => ({ key: a.key, type: a.type, status: 'available', required: a.required, array: false, ...(a.size != null ? { size: a.size } : { min: -9007199254740991, max: 9007199254740991 }) })),
  indexes: w.indexes.map((i) => ({ key: i.key, type: i.type, status: 'available', attributes: [...i.attributes] })),
});
const all = () => want.map(built);
const without = (got: PmCollGot[], ...ids: string[]) => got.filter((g) => !ids.includes(g.$id));
const edit = (got: PmCollGot[], id: string, fn: (g: PmCollGot) => void) => { const g = got.find((x) => x.$id === id)!; fn(g); return got; };

test('맞아야 할 숫자: PM 23 · 속성 140 · 인덱스 25', () => {
  assert.deepEqual(pmSchemaTotals(), { colls: 23, attrs: 140, indexes: 25 });
});

test('공용 appwrite-schema.ts 의 pmCollections() 글자가 이 정의와 같은 규칙', () => {
  const src = readFileSync('scripts/appwrite-schema.ts', 'utf8');
  const block = src.slice(src.indexOf('function pmCollections()'), src.indexOf('}));', src.indexOf('function pmCollections()')));
  for (const s of ["S('id', 128, true)", "S('kind', 32)", "INT('at', true)", "INT('seq', true)", "S('body', 1_000_000, true)", 'c.idx.map((f) => S(f, 128))', 'c.idx.map((f) => IX(f, [f]))', 'name: `프로젝트 관리 ${c.name}`', 'id: c.name']) assert.ok(block.includes(s), s);
  assert.ok(/const IX = \(name: string, attributes: string\[\]\): IndexDef => \(\{\s*key: `idx_\$\{name\}`,\s*type: DatabasesIndexType\.Key,/.test(src), 'IX = idx_<칸> · Key');
  assert.ok(src.includes('Permission.read(Role.any()),') && src.includes('Permission.delete(Role.any()),'), 'POC_PERMISSIONS = any 4개');
});

test('다 같음 → 빠진 것 없음 · 쓰기 0', () => {
  const p = resumePlan(want, all());
  assert.deepEqual([p.existing.length, p.diffs, p.createColls, p.createIndexes, p.attrs, p.indexCount], [23, [], [], [], 0, 0]);
});

test('지금 상태(7-4 실패 뒤): 있는 것 20 · 차이 0 · 만들 컬렉션 3 · 속성 18 · 인덱스 4', () => {
  const got = edit(without(all(), 'pmMoneyItems', 'pmMoneyContracts', 'pmChangeLogs'), 'pmMoney', (g) => { g.indexes = []; });
  const p = resumePlan(want, got);
  assert.equal(p.existing.length, 20);
  assert.deepEqual(p.diffs, []);
  assert.deepEqual(p.createColls, ['pmMoneyItems', 'pmMoneyContracts', 'pmChangeLogs']);
  assert.deepEqual(p.createIndexes.map((i) => `${i.coll}.${i.key}:${i.attributes.join()}`), ['pmMoney.idx_projectId:projectId']);
  assert.deepEqual([p.attrs, p.indexCount], [18, 4]);
});

test('속성 크기 다름 → 차이 (멈춤)', () => {
  const p = resumePlan(want, edit(all(), 'pmTasks', (g) => { g.attributes.find((a) => a.key === 'body')!.size = 65535; }));
  assert.match(p.diffs.join('\n'), /pmTasks: 속성 body 크기 65535 ≠ 1000000/);
});

test('정의에 없는 속성 → 차이 (멈춤)', () => {
  const p = resumePlan(want, edit(all(), 'pmMarks', (g) => { g.attributes.push({ key: 'extra', type: 'string', status: 'available', required: false, size: 10 }); }));
  assert.match(p.diffs.join('\n'), /pmMarks: 정의에 없는 속성 extra/);
});

test('속성 processing → 차이 (멈춤) · 인덱스 failed · 정의에 없는 인덱스 · 속성 빠짐 · 권한 · documentSecurity 도', () => {
  const got = all();
  edit(got, 'pmIssues', (g) => { g.attributes.find((a) => a.key === 'projectId')!.status = 'processing'; });
  edit(got, 'pmTickets', (g) => { g.indexes[0].status = 'failed'; g.indexes.push({ key: 'idx_x', type: 'key', status: 'available', attributes: ['x'] }); });
  edit(got, 'pmSubtasks', (g) => { g.attributes = g.attributes.filter((a) => a.key !== 'taskId'); });
  edit(got, 'pmPersonal', (g) => { g.$permissions = ['read("any")']; g.documentSecurity = true; });
  const t = resumePlan(want, got).diffs.join('\n');
  for (const re of [/pmIssues: 속성 projectId 상태 processing/, /pmTickets: 인덱스 idx_projectId 상태 failed/, /pmTickets: 정의에 없는 인덱스 idx_x/, /pmSubtasks: 속성 taskId 빠짐/, /pmPersonal: 권한/, /pmPersonal: documentSecurity/]) assert.match(t, re);
});
