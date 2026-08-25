import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEventDraft } from '@/domain/calendarEvent/schema';
import { CalendarEventError, calendarEventRepo, type CalendarEventActor } from './calendarEvent.repo';

const owner: CalendarEventActor = { userId: 'U011', active: true };
const other: CalendarEventActor = { userId: 'U012', active: true };
const defaultDemoUser: CalendarEventActor = { userId: 'U009', active: true };

const draft = (title: string, share: Partial<CalendarEventDraft> = {}): CalendarEventDraft => ({
  title,
  date: '2026-08-20',
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  memo: '',
  visibility: 'PRIVATE',
  deptId: null,
  projectId: null,
  ...share,
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

/* ------------------------------------------------------------------ 공유 */

const sees = async (actor: CalendarEventActor, id: string): Promise<boolean> =>
  (await calendarEventRepo.get(actor, id)) !== null;

test('전사 공개 일정은 남에게도 보인다', async () => {
  const created = await calendarEventRepo.create(owner, draft('전사 공지', { visibility: 'COMPANY' }));
  assert.equal(await sees(other, created.id), true);
  await calendarEventRepo.remove(owner, created.id);
});

test('부서 공유는 같은 부서에게만 보인다', async () => {
  const created = await calendarEventRepo.create(owner, draft('부서 회의', { visibility: 'TEAM', deptId: 'D230' }));
  assert.equal(await sees({ ...other, deptId: 'D230' }, created.id), true);
  assert.equal(await sees({ ...other, deptId: 'D999' }, created.id), false);
  // 소속이 없으면 부서 공유가 닿지 않는다.
  assert.equal(await sees(other, created.id), false);
  await calendarEventRepo.remove(owner, created.id);
});

test('프로젝트 공유는 참여자에게만 보인다', async () => {
  const created = await calendarEventRepo.create(owner, draft('킥오프', { visibility: 'PROJECT', projectId: 'PRJ-0001' }));
  assert.equal(await sees({ ...other, projectIds: ['PRJ-0001'] }, created.id), true);
  assert.equal(await sees({ ...other, projectIds: ['PRJ-0002'] }, created.id), false);
  assert.equal(await sees(other, created.id), false);
  await calendarEventRepo.remove(owner, created.id);
});

test('나만 보기 일정은 어떤 소속으로도 보이지 않는다', async () => {
  const created = await calendarEventRepo.create(owner, draft('개인 메모', { visibility: 'PRIVATE' }));
  assert.equal(await sees({ ...other, deptId: 'D230', projectIds: ['PRJ-0001'] }, created.id), false);
  assert.equal(await sees(owner, created.id), true);
  await calendarEventRepo.remove(owner, created.id);
});

test('공유받아도 고치거나 지우지 못한다', async () => {
  // 공유는 보여주기까지다. 여기가 뚫리면 부서원 아무나 남의 일정을 지울 수 있다.
  const created = await calendarEventRepo.create(owner, draft('전사 공지', { visibility: 'COMPANY' }));
  assert.equal(await sees(other, created.id), true);
  await assert.rejects(() => calendarEventRepo.update(other, created.id, draft('가로채기')));
  await assert.rejects(() => calendarEventRepo.remove(other, created.id));
  await calendarEventRepo.remove(owner, created.id);
});

test('대상 없는 공유는 만들 수 없다', async () => {
  // 공유했다고 표시되는데 아무에게도 안 보이는 상태가 제일 나쁘다.
  await assert.rejects(() => calendarEventRepo.create(owner, draft('부서 없음', { visibility: 'TEAM' })));
  await assert.rejects(() => calendarEventRepo.create(owner, draft('프로젝트 없음', { visibility: 'PROJECT' })));
});

test('공개 범위가 없는 예전 일정은 나만 보기로 읽힌다', async () => {
  // 마이그레이션 없이 읽히되, 기본값이 공유 쪽이면 남의 일정이 통째로 열린다.
  const rows = await calendarEventRepo.list(owner, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(rows.every((row) => row.visibility === 'PRIVATE'), true);
});

test('필수값이 비면 사람이 읽는 문구로 거절한다', async () => {
  // zod가 던지는 ZodError를 그대로 흘리면 화면에 이슈 배열 JSON이 찍힌다.
  await assert.rejects(
    () => calendarEventRepo.create(owner, draft('')),
    (error: Error) => {
      assert.equal(error.name, 'CalendarEventError');
      assert.equal((error as CalendarEventError).code, 'INVALID_INPUT');
      assert.equal(error.message, '일정 제목을 입력하세요.');
      return true;
    },
  );
});
