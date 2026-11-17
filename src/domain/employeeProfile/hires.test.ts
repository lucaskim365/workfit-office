import assert from 'node:assert/strict';
import test from 'node:test';
import { hiresInMonth } from './hires';

test('이달의 입사자 — 그 달에 입사한 사람만 날짜순(다른 해 같은 달·날짜 없음·잘못된 값 제외)', () => {
  const people = [
    { userId: 'b', hireDate: '2026-11-20' },
    { userId: 'a', hireDate: '2026-11-03' },
    { userId: 'c', hireDate: '2025-11-03' },
    { userId: 'd', hireDate: null },
    { userId: 'e', hireDate: '2026-11' },
    { userId: 'f', hireDate: ' 2026-11-03 ' },
  ];
  assert.deepEqual(hiresInMonth(people, '2026-11').map((x) => [x.person.userId, x.date]), [['a', '2026-11-03'], ['f', '2026-11-03'], ['b', '2026-11-20']]);
  assert.deepEqual(hiresInMonth(people, '2026-12'), []);
});
