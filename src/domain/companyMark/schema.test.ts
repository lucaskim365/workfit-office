import assert from 'node:assert/strict';
import test from 'node:test';
import { companyMarkSchema, markUrlOf, marksOf, newMarkId, type CompanyMark } from './schema';

const M = (o: Partial<CompanyMark>): CompanyMark => ({ id: 'MK-aaaa', kind: 'seal', name: '회사 직인', url: 'https://f/a.png', path: '', order: 0, ...o });
const marks = [
  M({ id: 'MK-s2', name: '본부장 직인', url: 'https://f/s2.png', order: 2 }),
  M({ id: 'MK-s1', name: '회사 직인', url: 'https://f/s1.png', order: 1 }),
  M({ id: 'MK-l1', kind: 'logo', name: '기본 로고', url: 'https://f/l1.png' }),
];

test('marksOf — 종류별, 순서대로', () => {
  assert.deepEqual(marksOf(marks, 'seal').map((m) => m.id), ['MK-s1', 'MK-s2']);
  assert.deepEqual(marksOf(marks, 'logo').map((m) => m.id), ['MK-l1']);
});

test('markUrlOf — 고른 것, 없으면 대표', () => {
  assert.equal(markUrlOf(marks, 'seal', 'MK-s2', 'https://rep'), 'https://f/s2.png');
  assert.equal(markUrlOf(marks, 'seal', undefined, 'https://rep'), 'https://rep');
  // 지워진 id, 다른 종류 id 는 대표로
  assert.equal(markUrlOf(marks, 'seal', 'MK-gone', 'https://rep'), 'https://rep');
  assert.equal(markUrlOf(marks, 'seal', 'MK-l1', 'https://rep'), 'https://rep');
  assert.equal(markUrlOf(marks, 'logo', null, null), '');
});

test('newMarkId — 스키마 형식', () => {
  const id = newMarkId(1784089071758, 0.5);
  assert.ok(companyMarkSchema.shape.id.safeParse(id).success, id);
  assert.notEqual(newMarkId(1, 0.1), newMarkId(1, 0.2));
});
