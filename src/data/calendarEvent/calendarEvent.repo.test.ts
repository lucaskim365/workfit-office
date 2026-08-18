import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEventDraft } from '@/domain/calendarEvent/schema';
import { CalendarEventError, calendarEventRepo, type CalendarEventActor } from './calendarEvent.repo';

const owner: CalendarEventActor = { userId: 'U011', active: true };
const other: CalendarEventActor = { userId: 'U012', active: true };
const defaultDemoUser: CalendarEventActor = { userId: 'U009', active: true };

const draft = (title: string): CalendarEventDraft => ({
  title,
  date: '2026-08-20',
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  memo: '',
});

test('본인 일정만 날짜 범위와 표시 순서에 맞게 조회한다', async () => {
  const rows = await calendarEventRepo.list(owner, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(rows.some((row) => row.ownerUserId !== owner.userId), false);
  assert.equal(rows[0].allDay, true);
  assert.equal(await calendarEventRepo.get(owner, 'CAL-20260812-0002'), null);
});

test('기본 데모 사용자에게 월간 샘플 일정을 제공한다', async () => {
  const rows = await calendarEventRepo.list(defaultDemoUser, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(rows.length >= 2, true);
  assert.equal(rows.every((row) => row.ownerUserId === defaultDemoUser.userId), true);
});

test('개인 일정을 생성·수정·삭제한다', async () => {
  const created = await calendarEventRepo.create(owner, draft('저장소 일정'));
  assert.equal(created.ownerUserId, owner.userId);
  const updated = await calendarEventRepo.update(owner, created.id, { ...draft('수정된 일정'), allDay: true, startTime: null, endTime: null });
  assert.equal(updated.title, '수정된 일정');
  await calendarEventRepo.remove(owner, created.id);
  assert.equal(await calendarEventRepo.get(owner, created.id), null);
});

test('다른 사용자 일정 변경과 비활성 계정 쓰기를 차단한다', async () => {
  const created = await calendarEventRepo.create(owner, draft('권한 검증 일정'));
  await assert.rejects(
    () => calendarEventRepo.update(other, created.id, draft('권한 없는 수정')),
    (error) => error instanceof CalendarEventError && error.code === 'NOT_FOUND',
  );
  await assert.rejects(() => calendarEventRepo.remove(other, created.id));
  await assert.rejects(() => calendarEventRepo.create({ ...owner, active: false }, draft('비활성 계정 일정')));
});

test('잘못된 조회 범위를 차단한다', async () => {
  await assert.rejects(() => calendarEventRepo.list(owner, { from: '2026-08-31', to: '2026-08-01' }));
  await assert.rejects(() => calendarEventRepo.list(owner, { from: '2026-02-30' }));
});
