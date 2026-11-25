import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from './rules';
import { pmActionSchema, pmIssueSchema, pmProjectSchema, pmSubtaskSchema, pmTaskSchema, type PmTask } from './schema';
import { alertSeen, myAlerts, type AlertInputs } from './alerts';
import type { PmTicket } from './ticket';

/**
 * 🔔 알림 규칙 — 담당 · 날짜가 있는 테스트용 작은 데이터 (가짜 날짜는 테스트 안에서만, §0.1-1). 오늘 = 2026-11-25 (수).
 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask => pmTaskSchema.parse({ id: `P9|${o.code}`, projectId: 'P9', name: o.code, ...o });
const tk = (o: Partial<PmTicket>): PmTicket => ({ no: 'P9-0001', projectId: 'P9', taskId: '', subtaskId: '', legacyKey: '', title: '티켓', status: '진행중', assigneeId: '', reviewerId: '', approverId: '', issuerId: '', reviewOk: false, hist: [], ...o } as PmTicket);
const X = (o: Partial<AlertInputs>): AlertInputs => {
  const tasks = o.tasks ?? [];
  return {
    tasks, liveMap: new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)])), projects: [pmProjectSchema.parse({ id: 'P9', company: '테스트' })], today: TODAY,
    logs: [], checks: [], tickets: [], baseDate: '2026-11-17', sitePm: () => '', subtasks: [], actions: [], issues: [], msOk: new Map(), updReq: [],
    sites: [], pmOf: () => [], shortOf: () => '테스트', nameOf: (x) => ({ u: '김철수', me: '나' }[x] ?? x), ...o,
  };
};
const txt = (me: string, x: AlertInputs) => myAlerts(me, x).map((a) => `${a.lv}|${a.txt}|${a.go?.kind === 'view' ? a.go.v : a.go?.kind ?? ''}`);

test('지연 업무 · 남이 배정한 세부 작업 · 맡긴 일 완료', () => {
  const ts = [T({ code: 'a', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-20' })];
  const subs = [
    pmSubtaskSchema.parse({ id: 's1', taskId: 'P9|a', text: '화면 시안', assigneeId: 'me', createdBy: 'u', due: '2026-11-24' }),
    pmSubtaskSchema.parse({ id: 's2', taskId: 'P9|a', text: '내가 쓴 것', assigneeId: 'me', createdBy: 'me' }),
    pmSubtaskSchema.parse({ id: 's3', taskId: 'P9|a', text: '맡긴 일', assigneeId: 'u', createdBy: 'me', done: true, doneDate: '2026-11-24' }),
  ];
  assert.deepEqual(txt('me', X({ tasks: ts, subtasks: subs })), [
    "bad|내가 담당한 지연 TASK 1건 — 내 업무 › [전체 업무] '지금 할 일' (지연 우선)|dash/my",
    'bad|새로 배정된 일 · 테스트 화면 시안 (김철수 배정 · 11/24)|dash/plan',
    'ok|맡긴 일 완료 · 테스트 맡긴 일 (김철수 · 11/24)|dash/plan',
  ]);
});

test('티켓: 새 티켓 · 반려 · 완료 승인(7일) · 검토 차례', () => {
  const tickets = [
    tk({ no: 'P9-0001', assigneeId: 'me', status: '발행', issuerId: 'u', title: '새 일' }),
    tk({ no: 'P9-0002', assigneeId: 'me', status: '진행중', title: '다시', hist: [{ date: '2026-11-24', by: 'u', text: '반려 — 재작업 요청 — 화면 깨짐' }] }),
    tk({ no: 'P9-0003', assigneeId: 'me', status: '완료', title: '끝', hist: [{ date: '2026-11-20', by: 'u', text: '승인 · 완료' }] }),
    tk({ no: 'P9-0004', assigneeId: 'me', status: '완료', title: '오래됨', hist: [{ date: '2026-11-01', by: 'u', text: '승인 · 완료' }] }),
    tk({ no: 'P9-0005', assigneeId: 'u', status: '검토요청', reviewerId: 'me', title: '봐 주세요' }),
    tk({ no: 'P9-0006', assigneeId: 'me', status: '발행', issuerId: 'me', title: '내가 발행' }),
  ];
  assert.deepEqual(txt('me', X({ tickets })), [
    'warn|새 티켓 · P9-0001 새 일 (김철수 발행 · 접수 대기)|ticket',
    'bad|반려된 티켓 · P9-0002 다시 — 화면 깨짐|ticket',
    'ok|완료 승인됨 · P9-0003 끝 (김철수)|ticket',
    'warn|검토 대기 티켓 · P9-0005 봐 주세요|ticket',
  ]);
});

test('액션 아이템 · 이슈', () => {
  const actions = [
    pmActionSchema.parse({ id: 'a1', text: '새로 맡음', whoId: 'me', by: 'u', due: '2026-12-01' }),
    pmActionSchema.parse({ id: 'a2', text: '오늘까지', whoId: 'me', due: '2026-11-25' }),
  ];
  const issues = [pmIssueSchema.parse({ id: 'I-1', projectId: 'P9', title: '설비 멈춤', sev: '긴급', status: '열림', ownerId: 'me', by: 'u' })];
  assert.deepEqual(txt('me', X({ actions, issues })), [
    'warn|새 액션 아이템 · 새로 맡음 (김철수 등록 · 12/1까지)|doc/meet',
    'warn|액션 아이템 · 오늘까지 (D-Day)|doc/meet',
    'bad|긴급 이슈 · I-1 설비 멈춤 (내 담당 · 열림)|risk/issue',
  ]);
});

test('확인한 알림은 문구로 기억 — 문구가 바뀌면 다시 뜸 (alertSeen)', () => {
  const a = { lv: 'warn' as const, txt: '새 티켓 · P9-0001' };
  assert.equal(alertSeen({ '새 티켓 · P9-0001': '2026-11-25' }, a), true);
  assert.equal(alertSeen({ '새 티켓 · P9-0001': '2026-11-25' }, { ...a, txt: '새 티켓 · P9-0002' }), false);
  assert.equal(alertSeen(undefined, a), false);
});
