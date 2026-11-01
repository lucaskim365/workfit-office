import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { collectDayRows, countRows, peopleLabel } from './dayAgenda';

const user = (id: string, name: string) => ({ id, name }) as User;
const A = user('U1', '홍길동');
const B = user('U2', '김철수');
const D = '2026-11-02';

const entry = (over: Partial<DayEntry>): DayEntry => ({
  key: over.key ?? 'k',
  source: 'ITEM',
  allDay: false,
  startTime: null,
  endTime: null,
  title: '',
  tag: null,
  roomStatus: null,
  ...over,
});

const meeting = (key: string) =>
  entry({ key, source: 'MEETING', startTime: '10:00', endTime: '11:00', title: '주간회의', event: { id: 'EV-1' } as DayEntry['event'] });

test('하루 목록 — 같은 회의는 한 줄로 묶고, 종일·미정이 먼저, 그다음 시각 순', () => {
  const cells: Record<string, DayEntry[]> = {
    U1: [meeting('m-u1'), entry({ key: 'i1', startTime: '09:00', title: '보고서', item: { id: 'WI-1' } as DayEntry['item'] })],
    U2: [meeting('m-u2'), entry({ key: 'i2', allDay: true, title: '집중', item: { id: 'WI-2' } as DayEntry['item'] })],
  };
  const cellOf = (id: string): DayCell => ({ entries: cells[id] ?? [], memo: null, memoPlan: null });
  const rows = collectDayRows([A, B], D, cellOf);
  assert.deepEqual(rows.map((r) => r.entry.title), ['집중', '보고서', '주간회의']);
  assert.deepEqual(rows[2].people.map((p) => p.name), ['홍길동', '김철수']);
  assert.deepEqual(countRows(rows), { meeting: 1, outside: 0, trip: 0, leave: 0, item: 2 });
});

test('사람 이름 — 넷 이상이면 첫 사람 외 N명', () => {
  assert.equal(peopleLabel([A, B]), '홍길동, 김철수');
  assert.equal(peopleLabel([A, B, A, B]), '홍길동 외 3명');
});
