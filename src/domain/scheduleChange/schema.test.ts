import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalDocSchema, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { extractApprovedSchedules, extractScheduleInfo, splitUserIds } from '@/domain/approvalDoc/scheduleEngine';
import { buildApprovalDayIndex } from '@/domain/commute/approvalDayIndex';
import { buildScheduleEvents } from '@/domain/calendarEvent/scheduleEvents';
import { indexDayEntries, type DayEntryInput } from '@/domain/workPlan/dayEntries';
import { changesOfDoc, latestChangeByDoc, scheduleRangeText, validateScheduleChange, type ScheduleChange } from './schema';

function doc(over: Partial<ApprovalDoc> & Pick<ApprovalDoc, 'id' | 'docType'>): ApprovalDoc {
  return approvalDocSchema.parse({ docNo: over.id, title: `${over.docType} 신청`, drafterId: 'U1', drafterName: '홍길동', status: '완료', ...over });
}

function change(over: Partial<ScheduleChange> & Pick<ScheduleChange, 'docId' | 'startDate' | 'endDate'>): ScheduleChange {
  return {
    id: 'SC-aaaa-0001',
    startTime: null,
    endTime: null,
    prevStartDate: '2026-11-12',
    prevEndDate: '2026-11-12',
    prevStartTime: null,
    prevEndTime: null,
    reason: '고객사 요청',
    changedBy: 'U1',
    changedByName: '홍길동',
    createdAt: '2026-11-10T01:00:00.000Z',
    ...over,
  };
}

const outside = doc({ id: 'AP-1', docType: '외근', fieldValues: { period: '2026-11-12', period__end: '2026-11-12', companions: 'U2,U3,U1' } });

test('다중사용자 값은 id 목록으로 나누고 빈 칸·중복을 뺀다', () => {
  assert.deepEqual(splitUserIds('a, b,,a'), ['a', 'b']);
  assert.deepEqual(splitUserIds(''), []);
  assert.deepEqual(splitUserIds(undefined), []);
});

test('동행자 id 는 기안자를 빼고 일정 정보에 담긴다', () => {
  assert.deepEqual(extractScheduleInfo(outside)?.companionIds, ['U2', 'U3']);
});

test('휴가는 동행자를 두지 않는다', () => {
  const leave = doc({ id: 'AP-2', docType: '휴가', form: { leaveType: '연차', startDate: '2026-11-12', endDate: '2026-11-12', days: 1 } as ApprovalDoc['form'], fieldValues: { companions: 'U2' } });
  assert.deepEqual(extractScheduleInfo(leave)?.companionIds ?? [], []);
});

test('동행자도 근태에 같은 외근으로 인정된다', () => {
  const index = buildApprovalDayIndex([outside]);
  assert.deepEqual(index.lookup({ id: 'U2' }).get('2026-11-12')?.map((e) => e.category), ['OUTSIDE']);
  assert.deepEqual(index.lookup({ id: 'U3' }).get('2026-11-12')?.map((e) => e.category), ['OUTSIDE']);
});

test('일정 변경은 마지막 기록을 따르고, 원래 일정을 남긴다', () => {
  const changes = latestChangeByDoc([
    change({ id: 'SC-aaaa-0001', docId: 'AP-1', startDate: '2026-11-13', endDate: '2026-11-13', createdAt: '2026-11-10T01:00:00.000Z' }),
    change({ id: 'SC-aaaa-0002', docId: 'AP-1', startDate: '2026-11-14', endDate: '2026-11-15', startTime: '10:00', endTime: '15:00', createdAt: '2026-11-10T02:00:00.000Z' }),
  ]);
  const s = extractScheduleInfo(outside, changes)!;
  assert.equal(s.startDate, '2026-11-14');
  assert.equal(s.endDate, '2026-11-15');
  assert.equal(s.startTime, '10:00');
  assert.equal(s.days, 2);
  assert.equal(s.changedFrom?.startDate, '2026-11-12');
  assert.equal(s.changedFrom?.reason, '고객사 요청');
});

test('일정 변경은 근태·업무계획·캘린더에 모두 반영된다(동행자 포함)', () => {
  const changes = latestChangeByDoc([change({ docId: 'AP-1', startDate: '2026-11-14', endDate: '2026-11-14' })]);
  // 근태
  const index = buildApprovalDayIndex([outside], [], changes);
  assert.equal(index.lookup({ id: 'U1' }).has('2026-11-12'), false);
  assert.equal(index.lookup({ id: 'U1' }).has('2026-11-14'), true);
  assert.equal(index.lookup({ id: 'U2' }).has('2026-11-14'), true);
  // 업무계획
  const input: DayEntryInput = {
    items: [], tags: [], events: [], outsideWorks: [], legacyPlans: [], reservations: [],
    approvedSchedules: extractApprovedSchedules([outside], changes),
    members: [{ id: 'U1', name: '홍길동' }, { id: 'U2', name: '김동행' }],
  };
  const cellOf = indexDayEntries(input, ['2026-11-12', '2026-11-14']);
  assert.equal(cellOf('U1', '2026-11-12').entries.length, 0);
  assert.equal(cellOf('U1', '2026-11-14').entries.length, 1);
  const companion = cellOf('U2', '2026-11-14').entries[0];
  assert.equal(companion.companionOf, 'U1');
  assert.equal(companion.outside?.companions, '김동행, U3');
  // 캘린더
  const { scheduleEvents } = buildScheduleEvents([outside], [], new Map([['U1', { name: '홍길동' }]]), new Set(['U1', 'U2']), changes);
  assert.deepEqual(scheduleEvents.map((e) => e.date), ['2026-11-14']);
  assert.deepEqual(scheduleEvents[0].attendeeUserIds, ['U2']);
  assert.match(scheduleEvents[0].title, /외 1명/);
});

test('휴가는 일정 변경 기록이 있어도 바꾸지 않는다', () => {
  const leave = doc({ id: 'AP-2', docType: '휴가', form: { leaveType: '연차', startDate: '2026-11-12', endDate: '2026-11-12', days: 1 } as ApprovalDoc['form'] });
  const s = extractScheduleInfo(leave, latestChangeByDoc([change({ docId: 'AP-2', startDate: '2026-11-20', endDate: '2026-11-20' })]))!;
  assert.equal(s.startDate, '2026-11-12');
});

test('변경 입력 확인', () => {
  const ok = { startDate: '2026-11-12', endDate: '2026-11-13', allDay: true, startTime: null, endTime: null, reason: '사유' };
  assert.equal(validateScheduleChange(ok), null);
  assert.match(validateScheduleChange({ ...ok, endDate: '2026-11-11' })!, /종료일/);
  assert.match(validateScheduleChange({ ...ok, reason: ' ' })!, /사유/);
  assert.match(validateScheduleChange({ ...ok, endDate: '2026-11-12', allDay: false, startTime: '15:00', endTime: '10:00' })!, /종료 시각/);
});

test('이력은 오래된 것부터, 한 줄 글', () => {
  const list = [change({ id: 'SC-b-2', docId: 'X', startDate: '2026-11-14', endDate: '2026-11-14', createdAt: '2' }), change({ id: 'SC-b-1', docId: 'X', startDate: '2026-11-13', endDate: '2026-11-13', createdAt: '1' })];
  assert.deepEqual(changesOfDoc(list, 'X').map((c) => c.id), ['SC-b-1', 'SC-b-2']);
  assert.equal(scheduleRangeText('2026-11-12', '2026-11-14', null, null), '11/12 ~ 11/14 종일');
  assert.equal(scheduleRangeText('2026-11-12', '2026-11-12', '10:00', '15:00'), '11/12 10:00~15:00');
});
