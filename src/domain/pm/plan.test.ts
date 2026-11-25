import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from './rules';
import { pmActionSchema, pmProjectSchema, pmSubtaskSchema, pmTaskSchema, type PmPlanDay, type PmPlanItem, type PmSubtask, type PmTask } from './schema';
import {
  carryText, nextWorkday, pdfPVal, pdfRowsClean, pdfToPlanApply, planAll, planCarryOf, planCopyText, planCtx, planDay, planHourRows, planLeft,
  planMarkTask, planPickTasks, planPool, planRecentIdx, planReportText, planSuggest, planUpdDates, planWeeks, prevWorkday, teamPlanStatus, type PlanInputs,
} from './plan';
import type { PmTicket } from './ticket';

/**
 * 업무계획 규칙 — 날짜·담당이 있는 **테스트용 작은 데이터**로 데모(plan* 5097~) 규칙을 확인 (가짜 날짜는 테스트 안에서만, §0.1-1).
 * 오늘 = 2026-11-25 (수) → 이번 주 11/23~11/27, 다음 주 11/30~12/4.
 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask =>
  pmTaskSchema.parse({ id: `P9|${o.code}`, projectId: 'P9', name: o.code, ...o });
const S = (o: Partial<PmSubtask> & { id: string; taskId: string }): PmSubtask => pmSubtaskSchema.parse({ text: o.id, ...o });
const projects = [pmProjectSchema.parse({ id: 'P9', company: '테스트' })];
const tk = (o: Partial<PmTicket>): PmTicket => ({ no: 'P9-0001', projectId: 'P9', taskId: '', subtaskId: '', status: '발행', title: '티켓', assigneeId: '', reviewerId: '', approverId: '', reviewOk: false, issuerId: '', due: '', hist: [], legacyKey: '', ...o } as PmTicket);
const day = (who: string, date: string, items: PmPlanItem[]): PmPlanDay => ({ id: `${who}|${date}`, who, date, items });
const short = () => '테스트';

function C(tasks: PmTask[], o: Partial<PlanInputs> = {}) {
  return planCtx({
    today: TODAY, tasks, liveMap: new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)])), projects,
    subtasks: [], plans: [], reps: [], later: [], tickets: [], actions: [], drafts: [], carryFrom: '', ...o,
  });
}
// 오늘 기간 안인 내 업무 4건 (a: 마일스톤 → 가장 급함, b: 2주 안 마감, c·d: 진행 중) + 지연 1 · 남의 업무 1 · 협약 이전 1
const tasks = [
  T({ code: 'a', assigneeIds: ['me'], start: '2026-11-20', end: '2026-12-31', milestone: true }),
  T({ code: 'b', assigneeIds: ['me'], start: '2026-11-20', end: '2026-12-02' }),
  T({ code: 'c', assigneeIds: ['me'], start: '2026-11-20', end: '2026-12-31' }),
  T({ code: 'd', assigneeIds: ['me'], start: '2026-11-24', end: '2026-12-31' }),
  T({ code: 'late', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-20' }),
  T({ code: 'x', assigneeIds: ['other'], start: '2026-11-20', end: '2026-12-31' }),
  T({ code: 'pre', assigneeIds: ['me'], stage: '협약 이전', start: '2026-11-20', end: '2026-12-31' }),
];

test('날짜: 2주 평일 · 앞뒤 근무일 · 넘어온 일 표시', () => {
  const w = planWeeks(TODAY);
  assert.deepEqual([w[0][0], w[0][4], w[1][0], w[1][4]], ['2026-11-23', '2026-11-27', '2026-11-30', '2026-12-04']);
  assert.equal(prevWorkday('2026-11-30'), '2026-11-27', '월요일의 전 근무일 = 금요일');
  assert.equal(nextWorkday('2026-11-27'), '2026-11-30');
  assert.equal(carryText({ text: 'x', from: '2026-11-24' }, TODAY), '어제부터');
  assert.equal(carryText({ text: 'x', from: '2026-11-20' }, TODAY), '4일째', '금 · 월 · 화 · 오늘(수)');
  assert.equal(carryText({ text: 'x', from: TODAY }, TODAY), '');
});

test('계획 후보: 급한 순 (지연 → 마일스톤 → 2주 안 마감 → 진행 중), 남의 업무 · 협약 이전 · 날짜 없는 업무 제외', () => {
  const c = C([...tasks, T({ code: 'nodate', assigneeIds: ['me'] })]);
  assert.deepEqual(planPool(c, 'me').map((t) => t.code), ['late', 'a', 'b', 'c', 'd']);
  // '나중에'로 내린 업무 · 부 담당은 뒤로 (+50)
  const c2 = C(tasks, { later: [{ id: 'me', taskIds: ['P9|a'] }] });
  assert.deepEqual(planPool(c2, 'me').map((t) => t.code), ['late', 'b', 'c', 'd', 'a']);
});

test('자동 초안: 하루 3건씩 돌아가며 · 지연 업무는 안 넣음 · 지난 날은 기록만', () => {
  const c = C(tasks);
  const all = planAll(c, 'me');
  const codes = (d: string) => all[d].map((x) => x.taskId!.split('|')[1]);
  assert.deepEqual(codes(TODAY), ['a', 'b', 'c'], '오늘 = 급한 순 3건');
  assert.deepEqual(codes('2026-11-26'), ['d', 'a', 'b'], '다음 날 = 적게 들어간 것 먼저');
  assert.ok(all[TODAY].every((x) => x.auto), '자동 표시');
  assert.ok(!Object.values(all).flat().some((x) => x.taskId === 'P9|late'), '지연 업무는 추천에만');
  assert.deepEqual(codes('2026-12-03'), ['c', 'd', 'a'], 'b 는 12/2 에 끝남');
});

test('자동 초안: 세부 작업 · 반복 업무 · 직접 고친 날', () => {
  const subs = [S({ id: 's1', taskId: 'P9|c', assigneeId: 'me', estHours: 2 }), S({ id: 's2', taskId: 'P9|b', assigneeId: 'me', due: '2026-11-26', estHours: 1 })];
  const c = C(tasks, { subtasks: subs, reps: [{ id: 'me', items: [{ wd: [3], text: '주간회의' }] }], plans: [day('me', '2026-11-27', [{ text: '고친 날' }])] });
  const all = planAll(c, 'me');
  assert.deepEqual(all[TODAY].map((x) => x.text ?? `${x.taskId}${x.subId ? `/${x.subId}` : ''}`), ['주간회의', 'P9|a', 'P9|b/s2', 'P9|c/s1'], '수요일 반복 업무 맨 앞 · 쪼갠 업무는 내 다음 세부 작업으로 (예정일 상관없이 적은 순서)');
  assert.equal(all[TODAY][3].hours, 2, '세부 작업 예상 시간');
  assert.deepEqual(all['2026-11-26'].slice(0, 1).map((x) => x.subId), ['s2'], '예정일이 정해진 세부 작업은 그날 고정');
  assert.equal(all['2026-11-26'].length, 3);
  assert.deepEqual(all['2026-11-27'], [{ text: '고친 날' }], '고친 날은 그대로');
});

test('넘어온 일: 직전 근무일에 직접 쓴 계획 중 안 끝난 것 → 오늘 초안 맨 앞 (carryFrom 이후)', () => {
  const prev = day('me', '2026-11-24', [
    { text: '반만 함', pct: 50, done: true }, // 체크해도 100% 아니면 넘어감
    { text: '끝냄', done: true }, // 진행률 없이 체크 = 끝
    { taskId: 'P9|c', done: true, memo: '오늘 몫' }, // 업무가 안 끝남 → 넘어감
    { text: '반복', rep: true },
  ]);
  const c = C(tasks, { plans: [prev], carryFrom: '2026-11-25' });
  const carry = planCarryOf(c, 'me', TODAY);
  assert.deepEqual(carry.map((x) => x.text ?? x.taskId), ['반만 함', 'P9|c']);
  assert.ok(carry.every((x) => x.from === '2026-11-24' && x.auto && x.done === undefined && x.memo === undefined));
  const today = planAll(c, 'me')[TODAY];
  assert.deepEqual(today.map((x) => x.text ?? x.taskId), ['반만 함', 'P9|c', 'P9|a', 'P9|b'], '넘어온 업무 1건만큼 새 업무가 줄어듦');
  // 기능이 처음 열린 다음 근무일 전이면 자동으로 안 넘어옴 → 추천의 [어제 남은 일]
  const c2 = C(tasks, { plans: [prev], carryFrom: '2026-11-26' });
  assert.equal(planAll(c2, 'me')[TODAY].length, 3);
  const c3 = C(tasks, { plans: [prev, day('me', TODAY, [{ text: '오늘 고침' }])], carryFrom: '2026-11-26' });
  assert.deepEqual(planLeft(c3, 'me').map((x) => x.text ?? x.taskId), ['반만 함', 'P9|c']);
});

test('추천: 오늘 꼭 · 나를 기다리는 일 · 이번 주 안에 · 지연 — 한 항목은 한 묶음에만', () => {
  const ts = [...tasks, T({ code: 'soon', assigneeIds: ['me'], start: '2026-11-20', end: '2026-11-26' })];
  const c = C(ts, {
    plans: [day('me', TODAY, [{ text: '오늘 고침' }])],
    subtasks: [S({ id: 's9', taskId: 'P9|d', assigneeId: 'me', createdBy: 'boss' })],
    tickets: [
      tk({ no: 'P9-0001', taskId: 'P9|b', assigneeId: 'me', issuerId: 'boss', status: '발행' }),
      tk({ no: 'P9-0002', taskId: 'P9|x', assigneeId: 'other', status: '검토요청', approverId: 'me', title: '남의 것' }),
      tk({ no: 'P9-0003', taskId: 'P9|c', assigneeId: 'me', status: '접수', due: '2026-11-26' }),
    ],
    actions: [pmActionSchema.parse({ id: 'a1', text: '회의 액션', whoId: 'me', due: '2026-12-01' })],
  });
  const g = planSuggest(c, 'me', (id) => id);
  const keys = (a: { key: string }[]) => a.map((x) => x.key);
  assert.deepEqual(keys(g.must), ['tk:P9-0003', 'key:P9|soon'], '내일 마감 티켓 · 업무');
  assert.deepEqual(keys(g.wait), ['rv:P9-0002', 'tk:P9-0001', 'sub:s9'], '승인 차례 · 남이 발행 · 남이 배정');
  assert.deepEqual(keys(g.week), ['act:a1'], '이번 주 안 액션');
  assert.deepEqual(g.must.map((x) => x.why), ['내일 마감', '내일 마감']);
  assert.equal(g.wait[0].item.text, '검토 · 남의 것');
  assert.deepEqual(g.late.map((t) => t.code), ['late']);
  // 업무 고르기 목록: 기간 중 + 세부 작업 있음
  assert.deepEqual(planPickTasks(c, 'me').map((t) => t.code), ['a', 'soon', 'b', 'c', 'd'], '마일스톤이 먼저');
});

test('업무보고 · 2주 복사 · 시간 · 진행률 갱신 · 팀 보고 상태', () => {
  const subs = [S({ id: 's1', taskId: 'P9|c', assigneeId: 'me', text: '화면 API', done: true })];
  const plans = [day('me', TODAY, [{ text: '현장 미팅', pct: 40, hours: 2, memo: '도입기업 방문' }, { taskId: 'P9|c', subId: 's1', hours: 3 }, { taskId: 'P9|a', memo: '설계' }])];
  const c = C(tasks, { subtasks: subs, plans });
  const its = planDay(c, 'me', TODAY);
  const rep = planReportText(c, its, short);
  assert.match(rep, /^1\. 테스트\n - 업무내용: c – 화면 API\n - 비고: \n - 진행률: 0%/, '완료(세부 작업 끝남) 먼저');
  assert.match(rep, /2\. 현장 미팅\n - 업무내용: 현장 미팅\n - 비고: 도입기업 방문\n - 진행률: 40%/);
  assert.match(planCopyText(c, 'me', short), /\[이번 주\] 11\/23 ~ 11\/27\n11\/23\(월\)\n - 테스트 a/);
  assert.deepEqual(planHourRows(c, short).map((r) => [r.h, r.projectId]), [[2, ''], [3, 'P9']]);
  assert.deepEqual([...planUpdDates(c)], [['P9|c', [TODAY]], ['P9|a', [TODAY]]], '체크 · 메모한 업무 줄');
  assert.deepEqual([...planRecentIdx(c)], [['P9|a', { who: 'me', d: TODAY }]], '세부 작업 줄은 빼고');
  assert.deepEqual(teamPlanStatus(c, 'me', TODAY), { own: true, n: 3, done: 1, memo: 2 });
  assert.deepEqual(teamPlanStatus(c, 'other', TODAY), { own: false, n: 1, done: 0, memo: 0 }, '안 고친 사람 = 자동 초안만');
});

test('업무 완료 → 오늘 줄 체크 · 보고 표 → 할 일', () => {
  const c = C(tasks);
  assert.equal(planMarkTask([{ text: 'x' }], 'P9|a', true), null);
  assert.deepEqual(planMarkTask([{ taskId: 'P9|a' }, { taskId: 'P9|a', subId: 's' }], 'P9|a', true), [{ taskId: 'P9|a', done: true }, { taskId: 'P9|a', subId: 's' }]);
  assert.deepEqual([pdfPVal('70'), pdfPVal('75%'), pdfPVal('완료'), pdfPVal('진행 중')], [70, 80, 100, null]);
  assert.deepEqual(pdfRowsClean([[' a ', '', '50'], ['', '', '']]), [['a', '', '50%']]);
  const r = pdfToPlanApply(c, [{ text: '있음', pct: 10 }, { taskId: 'P9|a' }], [['있음', '', '100%'], ['새 일', '', '30'], ['테스트 a', '', '90%'], ['새 일', '', '']], short)!;
  assert.deepEqual([r.add, r.upd], [1, 1], '업무 줄 진행률은 안 바꿈 · 같은 줄은 한 번');
  assert.deepEqual(r.items, [{ text: '있음', pct: 100, done: true }, { taskId: 'P9|a' }, { text: '새 일', pct: 30 }]);
  assert.equal(pdfToPlanApply(c, [{ text: '있음', pct: 100 }], [['있음', '', '100']], short), null);
});
