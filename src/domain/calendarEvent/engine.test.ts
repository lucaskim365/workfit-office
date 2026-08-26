import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MASKED_EVENT_TITLE,
  isMaskedForSupervisor,
  maskEventForSupervisor,
  resolveCalendarSupervisor,
} from './engine';
import { calendarEventSchema, type CalendarEvent } from './schema';

/** 판정 함수가 받는 최소 사용자 모양. 실제 User의 부분집합이라 리터럴로 만든다. */
const person = (over: Partial<Parameters<typeof resolveCalendarSupervisor>[0]> = {}) => ({
  id: 'U100',
  name: '일반사원',
  dept: '품질심사팀',
  position: '사원',
  jobTitle: '팀원',
  status: '사용' as const,
  ...over,
});

const DEPTS = [
  { name: '데이터플랫폼 개발팀', headUserId: 'U011' },
  { name: '품질심사팀', headUserId: 'U006' },
  { name: 'AX PMO팀', headUserId: null },
];

test('경영진 직급·지정 인원은 전 직원 범위를 받는다', () => {
  // 직급으로: 대표·상무는 접미어(이사)가 붙어도 걸린다.
  assert.deepEqual(resolveCalendarSupervisor(person({ position: '대표이사' }), DEPTS), { kind: 'all' });
  assert.deepEqual(resolveCalendarSupervisor(person({ position: '상무이사' }), DEPTS), { kind: 'all' });
  // 이름으로: 김경일은 시드에 없어 ID를 모른다 — 이름 매칭이 잡아야 한다.
  assert.deepEqual(resolveCalendarSupervisor(person({ name: '김경일' }), DEPTS), { kind: 'all' });
  // ID로: 지정 개발 담당자.
  assert.deepEqual(resolveCalendarSupervisor(person({ id: 'U012' }), DEPTS), { kind: 'all' });
});

test('부서장은 맡은 부서 범위, 직책 팀장은 소속 부서로 대신한다', () => {
  const head = resolveCalendarSupervisor(person({ id: 'U006' }), DEPTS);
  assert.deepEqual(head, { kind: 'depts', deptNames: ['품질심사팀'] });
  // headUserId에 안 걸려도 직책이 팀장이면 본인 부서로.
  const fallback = resolveCalendarSupervisor(person({ jobTitle: '팀장', dept: 'AX PMO팀' }), DEPTS);
  assert.deepEqual(fallback, { kind: 'depts', deptNames: ['AX PMO팀'] });
});

test('직책 팀장 폴백은 headUserId가 이미 딴 사람으로 채워진 부서에는 안 걸린다', () => {
  // 품질심사팀은 DEPTS에서 headUserId=U006 — 다른 사람이 정본 부서장이다.
  const notTheHead = resolveCalendarSupervisor(person({ id: 'U999', jobTitle: '팀장', dept: '품질심사팀' }), DEPTS);
  assert.equal(notTheHead, null);
});

test('일반 사원과 비활성 계정에는 범위가 없다', () => {
  assert.equal(resolveCalendarSupervisor(person(), DEPTS), null);
  // 도메인 실제 비활성 상태는 '잠금'·'미사용' 둘뿐이다(USER_STATUS) — 둘 다 확인한다.
  assert.equal(resolveCalendarSupervisor(person({ position: '대표이사', status: '잠금' }), DEPTS), null);
  assert.equal(resolveCalendarSupervisor(person({ position: '대표이사', status: '미사용' }), DEPTS), null);
});

const eventOf = (over: Partial<CalendarEvent>): CalendarEvent => calendarEventSchema.parse({
  id: 'CAL-20260820-0001',
  ownerUserId: 'U777',
  title: '개인 병원 진료',
  date: '2026-08-20',
  allDay: false,
  startTime: '10:00',
  endTime: '11:00',
  memo: '민감한 내용',
  visibility: 'PRIVATE',
  deptId: null,
  projectId: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

test('남의 나만 보기 일정은 제목·메모가 가려지고, 공유·본인 일정은 그대로다', () => {
  const privateEvent = eventOf({});
  const masked = maskEventForSupervisor('U100', privateEvent);
  assert.equal(masked.title, MASKED_EVENT_TITLE);
  assert.equal(masked.memo, '');
  // 시간대는 남는다 — "그 시간에 바쁘다"는 정보가 종합 조회의 목적이다.
  assert.equal(masked.startTime, '10:00');
  assert.equal(isMaskedForSupervisor('U100', privateEvent), true);

  // 본인 것은 안 가린다.
  assert.equal(maskEventForSupervisor('U777', privateEvent).title, '개인 병원 진료');
  // 이미 집단에 공개된 범위는 안 가린다.
  const teamEvent = eventOf({ visibility: 'TEAM', deptId: 'D240' });
  assert.equal(maskEventForSupervisor('U100', teamEvent).title, '개인 병원 진료');
});
