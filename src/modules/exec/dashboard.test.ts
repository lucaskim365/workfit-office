import assert from 'node:assert/strict';
import test from 'node:test';
import { bucketOf, companyEventsOn, elapsedPercent, firstWeekday, monthDates, shiftMonth, todayKst } from './dashboard';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';

test('근태 판정을 4분류로 묶는다', () => {
  assert.equal(bucketOf('normal'), 'work');
  assert.equal(bucketOf('outside'), 'work');
  assert.equal(bucketOf('trip'), 'work');
  assert.equal(bucketOf('late'), 'late');
  assert.equal(bucketOf('leave'), 'leave');
  assert.equal(bucketOf('off'), 'pending');
  assert.equal(bucketOf('absent'), 'pending');
  assert.equal(bucketOf('unknown'), 'pending');
});

test('한국 시간 오늘 — UTC 15시는 다음 날', () => {
  assert.equal(todayKst(new Date('2026-11-09T15:30:00Z')), '2026-11-10');
  assert.equal(todayKst(new Date('2026-11-09T14:59:00Z')), '2026-11-09');
});

test('달 날짜·첫 요일·달 이동', () => {
  assert.equal(monthDates('2026-02').length, 28);
  assert.equal(monthDates('2026-11')[29], '2026-11-30');
  assert.equal(firstWeekday('2026-11'), 0); // 2026-11-01 일요일
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

const ev = (p: Partial<CalendarEvent>): CalendarEvent =>
  ({ id: 'CAL-20261110-0001', ownerUserId: 'u', title: 't', date: '2026-11-10', allDay: false, startTime: '10:00', endTime: null, memo: '', visibility: 'PRIVATE', eventType: 'GENERAL', attendeeUserIds: [], deptId: null, projectId: null, createdAt: '', updatedAt: '', reminded: false, location: null, reservationId: null, ...p }) as CalendarEvent;

test('회사 주요 일정 — 그날 전사 공개·회사 행사만, 종일 먼저 시간순', () => {
  const rows = companyEventsOn([
    ev({ id: 'a', visibility: 'COMPANY', startTime: '14:00' }),
    ev({ id: 'b', eventType: 'COMPANY_EVENT', startTime: '09:00' }),
    ev({ id: 'c', visibility: 'COMPANY', allDay: true, startTime: null }),
    ev({ id: 'd', visibility: 'TEAM' }),
    ev({ id: 'e', visibility: 'COMPANY', date: '2026-11-11' }),
  ], '2026-11-10');
  assert.deepEqual(rows.map((r) => r.id), ['c', 'b', 'a']);
});

test('프로젝트 기간 경과율', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  assert.equal(elapsedPercent({ startAt: '2026-01-01T00:00:00Z', dueAt: '2026-12-31T00:00:00Z', contractStartAt: null, contractEndAt: null }, now), 41);
  assert.equal(elapsedPercent({ startAt: null, dueAt: null, contractStartAt: '2025-01-01T00:00:00Z', contractEndAt: '2025-12-31T00:00:00Z' }, now), 100);
  assert.equal(elapsedPercent({ startAt: null, dueAt: null, contractStartAt: null, contractEndAt: null }, now), null);
});
