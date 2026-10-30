import assert from 'node:assert/strict';
import test from 'node:test';
import type { StandardScheduleInfo } from '@/domain/approvalDoc/scheduleEngine';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import type { OutsideWork } from '@/domain/outsideWork/schema';
import type { Reservation } from '@/domain/reservation/schema';
import { buildDayEntries, indexDayEntries, type DayEntryInput } from './dayEntries';
import type { WorkPlanItem } from './item';

const D = '2026-10-20';
const NOW = '2026-10-20T00:00:00.000Z';

const empty = (): DayEntryInput => ({
  items: [], tags: [], events: [], outsideWorks: [], approvedSchedules: [], legacyPlans: [], reservations: [],
  members: [{ id: 'U011', name: '홍길동' }, { id: 'U012', name: '김철수' }],
});

const item = (o: Partial<WorkPlanItem> = {}): WorkPlanItem => ({
  id: 'WI-20261020-0001', ownerUserId: 'U011', date: D, allDay: false, startTime: '09:00', endTime: '10:00',
  tagId: 'WT-0001', title: '보고서', memo: '', createdBy: 'U011', createdAt: NOW, updatedAt: NOW, ...o,
});

const event = (o: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'CAL-20261020-0001', ownerUserId: 'U011', title: '[회의] 주간 회의', date: D, allDay: false,
  startTime: '09:00', endTime: '10:00', memo: '', visibility: 'COMPANY', eventType: 'MEETING',
  attendeeUserIds: ['U012'], deptId: null, projectId: null, createdAt: NOW, updatedAt: NOW, reminded: false,
  location: null, reservationId: null, ...o,
});

const outside = (o: Partial<OutsideWork> = {}): OutsideWork => ({
  id: 'OW-20261020-0001', ownerUserId: 'U011', category: 'OUTSIDE', subType: '종일 외근',
  startDate: '2026-10-19', endDate: '2026-10-21', allDay: true, startTime: null, endTime: null,
  destination: '부산 고객사', purpose: '', companionUserIds: ['U012'], transportation: '', contact: '', memo: '',
  linkedApprovalDocId: null, createdAt: NOW, updatedAt: NOW, ...o,
});

const schedule = (o: Partial<StandardScheduleInfo> = {}): StandardScheduleInfo => ({
  category: 'LEAVE', docType: '휴가', docId: 'AP-1', docNo: 'AP-1', docTitle: '연차', drafterId: 'U011',
  startDate: D, endDate: D, days: 1, ...o,
});

const reservation = (status: Reservation['status']): Reservation => ({ id: 'R-1', status } as Reservation);

test('내 항목만 내 칸에', () => {
  const input = { ...empty(), items: [item(), item({ id: 'WI-20261020-0002', ownerUserId: 'U012' })] };
  const cell = buildDayEntries('U011', D, input);
  assert.deepEqual(cell.entries.map((e) => e.item?.id), ['WI-20261020-0001']);
});

test('회의는 주최자와 참석자 칸 모두에', () => {
  const input = { ...empty(), events: [event()] };
  for (const u of ['U011', 'U012']) {
    const cell = buildDayEntries(u, D, input);
    assert.equal(cell.entries.length, 1);
    assert.equal(cell.entries[0].source, 'MEETING');
    assert.equal(cell.entries[0].title, '주간 회의');
  }
  assert.equal(buildDayEntries('U099', D, input).entries.length, 0);
});

test('WP-SYNC 일정은 빠진다', () => {
  const input = { ...empty(), events: [event({ memo: '[WP-SYNC:P1:0]' })] };
  assert.equal(buildDayEntries('U011', D, input).entries.length, 0);
});

test('사내행사·휴가 등 회의 외 캘린더 일정은 CALENDAR로 보인다', () => {
  const input = {
    ...empty(),
    events: [
      event({ id: 'CAL-20261020-0002', eventType: 'COMPANY_EVENT', title: '워크숍' }),
      event({ id: 'CAL-20261020-0003', eventType: 'VACATION', title: '휴가' }),
      event({ id: 'CAL-20261020-0004', eventType: 'GENERAL', title: '개인 메모' }),
    ],
  };
  const cell = buildDayEntries('U011', D, input);
  assert.deepEqual(cell.entries.map((e) => e.source), ['CALENDAR', 'CALENDAR']);
});

test('외근은 기간 안의 날마다, 동행자 칸에는 companionOf', () => {
  const input = { ...empty(), outsideWorks: [outside()] };
  const idx = indexDayEntries(input, ['2026-10-18', '2026-10-19', D, '2026-10-21', '2026-10-22']);
  assert.equal(idx('U011', '2026-10-18').entries.length, 0);
  assert.equal(idx('U011', '2026-10-19').entries.length, 1);
  assert.equal(idx('U011', '2026-10-21').entries.length, 1);
  assert.equal(idx('U011', '2026-10-22').entries.length, 0);
  const mine = idx('U011', D).entries[0];
  assert.equal(mine.title, '부산 고객사');
  assert.equal(mine.companionOf, undefined);
  const mate = idx('U012', D).entries[0];
  assert.equal(mate.companionOf, 'U011');
});

test('결재와 연결된 직접 등록 외근은 빠진다', () => {
  const input = { ...empty(), outsideWorks: [outside({ linkedApprovalDocId: 'AP-1' })] };
  assert.equal(buildDayEntries('U011', D, input).entries.length, 0);
});

test('기안자 id가 다르면 이름으로 잇는다', () => {
  const input = { ...empty(), approvedSchedules: [schedule({ drafterId: 'OLD-1', drafterName: '홍 길동' })] };
  const cell = buildDayEntries('U011', D, input);
  assert.equal(cell.entries.length, 1);
  assert.equal(cell.entries[0].source, 'APPROVAL');
  assert.equal(cell.entries[0].outside, undefined);
  assert.equal(cell.entries[0].schedule?.docId, 'AP-1');
  assert.equal(buildDayEntries('OLD-1', D, input).entries.length, 0);
});

test('정렬: 종일 → 시각 → 출처', () => {
  const input = {
    ...empty(),
    items: [item()],
    events: [event({ attendeeUserIds: [] })],
    outsideWorks: [outside({ companionUserIds: [] })],
  };
  const cell = buildDayEntries('U011', D, input);
  assert.deepEqual(cell.entries.map((e) => e.source), ['OUTSIDE', 'MEETING', 'ITEM']);
});

test('연결 예약이 PENDING이면 roomStatus PENDING, CONFIRMED면 null', () => {
  const ev = event({ reservationId: 'R-1' });
  const pending = buildDayEntries('U011', D, { ...empty(), events: [ev], reservations: [reservation('PENDING')] });
  assert.equal(pending.entries[0].roomStatus, 'PENDING');
  const confirmed = buildDayEntries('U011', D, { ...empty(), events: [ev], reservations: [reservation('CONFIRMED')] });
  assert.equal(confirmed.entries[0].roomStatus, null);
});

test('메모는 서식 없이, 원본 문서 참조와 함께 — 빈 글이어도 문서는 알려 준다', () => {
  const plan = (content: string, ownerUserId = 'U011', id = 'WP-20261020-0001') =>
    ({ id, ownerUserId, date: D, content, createdAt: NOW, updatedAt: NOW });
  const withMemo = buildDayEntries('U011', D, { ...empty(), legacyPlans: [plan('첫 줄\n두 번째')] });
  assert.equal(withMemo.memo, '첫 줄\n두 번째');
  assert.deepEqual(withMemo.memoPlan, { id: 'WP-20261020-0001', updatedAt: NOW });
  const blank = buildDayEntries('U011', D, { ...empty(), legacyPlans: [plan('__c__:0')] });
  assert.equal(blank.memo, null);
  assert.deepEqual(blank.memoPlan, { id: 'WP-20261020-0001', updatedAt: NOW });
  const none = buildDayEntries('U011', D, empty());
  assert.equal(none.memo, null);
  assert.equal(none.memoPlan, null);
  assert.equal(buildDayEntries('__COMPANY__', D, { ...empty(), legacyPlans: [plan('공지', '__COMPANY__')] }).memo, null);
  // 같은 날 문서가 둘이면 글이 있는 쪽
  const twice = buildDayEntries('U011', D, {
    ...empty(),
    legacyPlans: [plan('글 있음'), plan('__c__:0', 'U011', 'WP-20261020-0002')],
  });
  assert.equal(twice.memo, '글 있음');
  assert.equal(twice.memoPlan?.id, 'WP-20261020-0001');
});

test('못 찾는 태그는 기타', () => {
  const cell = buildDayEntries('U011', D, { ...empty(), items: [item({ tagId: 'WT-9999' })] });
  assert.deepEqual(cell.entries[0].tag, { name: '기타', colorId: 'slate', unknown: true });
});
