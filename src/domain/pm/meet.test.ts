import assert from 'node:assert/strict';
import test from 'node:test';
import { pmActionSchema, pmMeetingSchema, type PmAction, type PmMeeting } from './schema';
import { actBuckets, actCheck, meetCheck, meetList } from './meet';
import { gsFind } from './search';
import { myAlerts } from './alerts';

/** 회의록 · 액션 아이템 규칙 (데모 docMeet · mtForm · actForm) — 테스트용 작은 데이터 (§0.1-1). 오늘 = 2026-11-25 (수) */
const TODAY = '2026-11-25';
const M = (o: Partial<PmMeeting> & { id: string }): PmMeeting => pmMeetingSchema.parse({ title: o.id, ...o });
const A = (o: Partial<PmAction> & { id: string }): PmAction => pmActionSchema.parse({ text: o.id, ...o });

test('회의 기록: 사업으로 거르고 날짜 최근 순 · 달이 바뀌면 달 머리 (날짜 없으면 맨 뒤 "날짜 없음")', () => {
  const L = [M({ id: 'a', date: '2026-10-30', projectId: 'P2' }), M({ id: 'b', date: '2026-11-20', projectId: 'P2' }), M({ id: 'c', date: '2026-11-03' }), M({ id: 'd', projectId: 'P2' })];
  assert.deepEqual(meetList(L, 'all').map((x) => [x.m.id, x.month]), [['b', '2026년 11월'], ['c', null], ['a', '2026년 10월'], ['d', '날짜 없음']]);
  assert.deepEqual(meetList(L, 'P2').map((x) => x.m.id), ['b', 'a', 'd'], '공통 회의(사업 없음)는 사업으로 거르면 빠짐');
});

test('할 일 4칸: 기한 지남 · 이번 주(오늘~7일 뒤) · 그 뒤 · 기한 없음 · 끝낸 일 / 사업 · 담당 거르기', () => {
  const L = [
    A({ id: 'od', due: '2026-11-24', whoId: 'u1', projectId: 'P2' }),
    A({ id: 'today', due: '2026-11-25', whoId: 'u1', projectId: 'P2' }),
    A({ id: 'w7', due: '2026-12-02', whoId: 'u2', projectId: 'P2' }),
    A({ id: 'w8', due: '2026-12-03', whoId: 'u1' }),
    A({ id: 'nodue', whoId: 'u1', projectId: 'P2' }),
    A({ id: 'done', due: '2026-11-01', whoId: 'u1', done: true, projectId: 'P2' }),
  ];
  const b = actBuckets(L, 'all', 'all', TODAY);
  assert.deepEqual([b.od, b.week, b.later, b.done].map((x) => x.map((a) => a.id)), [['od'], ['today', 'w7'], ['w8', 'nodue'], ['done']]);
  assert.equal(b.n, 6);
  const u1 = actBuckets(L, 'P2', 'u1', TODAY);
  assert.deepEqual([u1.n, u1.week.map((a) => a.id), u1.later.map((a) => a.id)], [4, ['today'], ['nodue']]);
});

test('입력 확인: 회의록 = 회의명 · 일자 · 참석자 · 회의 내용 / 액션 = 할 일 · 담당 · 기한', () => {
  const m = { title: '주간 회의', date: TODAY, attIds: ['u1'], content: '진척 공유' };
  assert.equal(meetCheck(m), null);
  assert.deepEqual(meetCheck({ ...m, attIds: [] })?.[1], 'attIds');
  assert.deepEqual(meetCheck({ ...m, content: ' ' })?.[1], 'content');
  assert.equal(actCheck({ text: 'I/O 리스트 요청', whoId: 'u1', due: TODAY }), null);
  assert.deepEqual(actCheck({ text: 'x', whoId: '', due: TODAY })?.[1], 'whoId');
});

test('🔔 새 회의록(참석자 · 남이 작성 · 7일) · 액션 알림 · 검색 → 그 회의 / 그 액션 창', () => {
  const meetings = [
    M({ id: 'M1', title: 'PLC 연동 범위 협의', date: '2026-11-24', attIds: ['me', 'u'], by: 'u', at: '2026-11-24', projectId: 'P9', decision: 'I/O 리스트 먼저 받기' }),
    M({ id: 'M2', title: '내가 쓴 회의', date: '2026-11-24', attIds: ['me'], by: 'me', at: '2026-11-24' }),
    M({ id: 'M3', title: '오래된 회의', date: '2026-11-01', attIds: ['me'], by: 'u', at: '2026-11-01' }),
  ];
  const actions = [A({ id: 'A1', text: 'I/O 리스트 요청', whoId: 'me', by: 'u', due: '2026-12-01', meetingId: 'M1' })];
  const base = {
    tasks: [], liveMap: new Map(), projects: [], today: TODAY, logs: [], checks: [], tickets: [], baseDate: '2026-11-17', sitePm: () => '', subtasks: [], issues: [],
    msOk: new Map(), updReq: [], sites: [], pmOf: () => [], shortOf: () => '테스트', nameOf: (x: string) => (x === 'u' ? '김철수' : x),
  };
  const a = myAlerts('me', { ...base, actions, meetings }).map((x) => [x.txt, x.go]);
  assert.deepEqual(a, [
    ['새 액션 아이템 · I/O 리스트 요청 (김철수 등록 · 12/1까지)', { kind: 'view', v: 'doc/meet', params: { act: 'A1' } }],
    ['새 회의록 · 테스트 PLC 연동 범위 협의 (김철수 작성 · 11/24)', { kind: 'view', v: 'doc/meet', params: { mt: 'M1' } }],
  ]);
  const S = { today: TODAY, screens: [], projects: [], tasks: [], liveMap: new Map(), tickets: [], issues: [], actions, meetings, people: [], shortOf: () => '테스트', nameOf: (x: string) => x };
  assert.deepEqual(gsFind('I/O 리스트', S).map((x) => [x.grp, x.go]), [['회의록', { kind: 'view', v: 'doc/meet', params: { mt: 'M1' } }], ['액션 아이템', { kind: 'view', v: 'doc/meet', params: { act: 'A1' } }]], '결정 사항에서도 찾음');
});
