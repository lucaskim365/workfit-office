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
    pmSubtaskSchema.parse({ id: 's0', taskId: 'P9|a', text: '예정일 없음', assigneeId: 'me', createdBy: 'u' }),
    pmSubtaskSchema.parse({ id: 's1', taskId: 'P9|a', text: '화면 시안', assigneeId: 'me', createdBy: 'u', due: '2026-11-24' }),
    pmSubtaskSchema.parse({ id: 's2', taskId: 'P9|a', text: '내가 쓴 것', assigneeId: 'me', createdBy: 'me' }),
    pmSubtaskSchema.parse({ id: 's3', taskId: 'P9|a', text: '맡긴 일', assigneeId: 'u', createdBy: 'me', done: true, doneDate: '2026-11-24' }),
  ];
  assert.deepEqual(txt('me', X({ tasks: ts, subtasks: subs })), [
    "bad|내가 담당한 지연 TASK 1건 — 내 업무 › [전체 업무] '지금 할 일' (지연 우선)|dash/my",
    'bad|새로 배정된 일 · 테스트 화면 시안 (김철수 배정 · 11/24)|dash/plan',
    'warn|새로 배정된 일 · 테스트 예정일 없음 (김철수 배정 · 예정일 없음)|dash/plan',
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

test('4단계 CR: 사업 PM 에게 검토 대기(내가 접수한 건 빼고) · 접수자에게 결과 7일 — 누르면 그 CR 창', async () => {
  const { pmChangeRequestSchema } = await import('./schema');
  const { siteCtxOf } = await import('./site');
  const p = pmProjectSchema.parse({ id: 'P9', company: '테스트', pmUserId: 'pm' });
  const c = siteCtxOf(p, { tasks: [], liveMap: new Map(), plans: {}, gov: [], planChecks: [], govLinks: [], agreements: [], baselines: [], issues: [] }, TODAY);
  const crs = [
    pmChangeRequestSchema.parse({ id: 'CR-001', projectId: 'P9', title: '바코드 라벨 추가', by: 'u' }),
    pmChangeRequestSchema.parse({ id: 'CR-002', projectId: 'P9', title: 'PM 이 직접 접수', by: 'pm' }),
    pmChangeRequestSchema.parse({ id: 'CR-003', projectId: 'P9', title: '설비 추가', by: 'u', status: '승인', reviewer: 'pm', revD: '2026-11-24' }),
    pmChangeRequestSchema.parse({ id: 'CR-004', projectId: 'P9', title: '오래된 반려', by: 'u', status: '반려', reviewer: 'pm', revD: '2026-11-10' }),
  ];
  const x = X({ projects: [p], sites: [c], crs, pmOf: (q) => [q.pmUserId] });
  assert.deepEqual(txt('pm', x), ['warn|CR 검토 대기 · CR-001 바코드 라벨 추가 (김철수 접수)|site/cr']);
  assert.deepEqual(myAlerts('pm', x)[0].go, { kind: 'view', v: 'site/cr', params: { cr: 'CR-001', review: '1' } });
  assert.deepEqual(txt('u', x), ['ok|CR 승인 · CR-003 설비 추가 (pm)|site/cr'], '7일 지난 반려는 안 뜸');
});

test('5단계 이슈 알림: 누르면 그 이슈 창 (issueEdit)', () => {
  const issues = [pmIssueSchema.parse({ id: 'I-001', projectId: 'P9', title: '통신 끊김', ownerId: 'me', by: 'u', sev: '긴급' })];
  const a = myAlerts('me', X({ issues }));
  assert.deepEqual(a.map((x) => [x.txt, x.go]), [['긴급 이슈 · I-001 통신 끊김 (내 담당 · 열림)', { kind: 'view', v: 'risk/issue', params: { issue: 'I-001' } }]]);
});
