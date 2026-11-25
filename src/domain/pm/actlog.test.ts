import assert from 'node:assert/strict';
import test from 'node:test';
import { actFilter, activityAll, type ActInputs } from './actlog';
import { liveOf, type Live } from './rules';
import {
  pmActionSchema, pmAgreementChangeSchema, pmChangeLogSchema, pmChangeRequestSchema, pmDocSchema, pmGovRecordSchema, pmIssueSchema, pmMeetingSchema,
  pmPlanCheckSchema, pmProjectSchema, pmReportSchema, pmSubtaskSchema, pmTaskSchema, pmWeekCheckSchema,
} from './schema';
import type { PmTicket } from './ticket';

/** 데모 activityAll 8128 의 줄 글자 · 종류 · 갈 곳 · 순서를 그대로 (종류 'WBS' → '업무 목록') */
const names: Record<string, string> = { u1: '홍길동', u2: '김철수' };
function inputs(): ActInputs {
  const p = pmProjectSchema.parse({ id: 'P9', company: '테스트', biz: '정부일반형', start: '2026-07-01', end: '2027-03-31', bidRes: '선정', bidAt: { date: '2026-06-20', by: 'u1' } });
  const t = pmTaskSchema.parse({ id: 'P9|01-01', projectId: 'P9', code: '01-01', name: '요구사항 정의서 작성', output: '요구사항 정의서' });
  return {
    tasks: [t], liveMap: new Map<string, Live>([[t.id, liveOf(t)]]), plans: {}, govLinks: [], baselines: [],
    projects: [p],
    logs: [pmChangeLogSchema.parse({ id: 'l1', projectId: 'P9', code: '01-01', kind: '수정', text: '종료일 11/30 → 12/5', date: '2026-11-20', by: 'u1' }),
      pmChangeLogSchema.parse({ id: 'l2', projectId: 'P9', code: '-', kind: '기준선', text: '기준선 저장', date: '2026-11-01', by: 'u2' })],
    tickets: [{ no: 'T-001', projectId: 'P9', title: '요구사항 정의서 작성 지원 요청', hist: [{ date: '2026-11-21', by: 'system', text: '발행' }, { date: '2026-11-22', by: 'u2', text: '' }] } as unknown as PmTicket],
    gov: [pmGovRecordSchema.parse({ id: 'P9|g_mid', projectId: 'P9', itemId: 'g_mid', v: '보완', date: '2026-10-10', by: 'u1', memo: '보고서 보완',
      items: [{ id: 'i1', text: '사업비 사용실적 누락', whoId: 'u2', st: '조치 완료', hist: [{ date: '2026-10-15', by: 'u2', a: '조치 완료', note: '첨부함' }] }] }),
    pmGovRecordSchema.parse({ id: 'P9|g_start', projectId: 'P9', itemId: 'g_start', date: '2026-07-10', by: 'u1', bulk: '2026-11-02' })],
    planChecks: [pmPlanCheckSchema.parse({ id: 'P9|d1', projectId: 'P9', dutyId: 'd1', date: '2026-09-01', by: 'u1' })],
    agreements: [pmAgreementChangeSchema.parse({ id: 'a1', projectId: 'P9', date: '2026-11-03', kind: 'ext', st: '신청함', text: '1개월', by: 'u1' })],
    reports: [pmReportSchema.parse({ id: 'P9|2026-11-16', projectId: 'P9', week: '2026-11-16', note: '현장 설치 완료', req: '네트워크 개방', by: 'u1', at: '2026-11-19' })],
    weekChecks: [pmWeekCheckSchema.parse({ id: '2026-11-16|P9|01-01', projectId: 'P9', taskId: 'P9|01-01', week: '2026-11-16', date: '2026-11-18', by: 'u2' })],
    docs: [pmDocSchema.parse({ id: 'P9|01-01', projectId: 'P9', st: '제출완료', file: '정의서.pdf', date: '2026-11-17', by: 'u2' })],
    issues: [pmIssueSchema.parse({ id: 'I-001', projectId: 'P9', title: '설비 통신 끊김', sev: '높음', by: 'u1', date: '2026-11-10', at: '2026-11-11' })],
    crs: [pmChangeRequestSchema.parse({ id: 'CR-001', projectId: 'P9', title: '불량 보고서 추가', by: 'u1', at: '2026-11-05', status: '승인', reviewer: 'u2', revD: '2026-11-06' })],
    meetings: [pmMeetingSchema.parse({ id: 'm1', projectId: 'P9', title: '주간 회의', date: '2026-11-12', by: 'u1' })],
    actions: [pmActionSchema.parse({ id: 'x1', projectId: 'P9', text: '회선 신청', whoId: 'u2', by: 'u1', at: '2026-11-12', done: true, doneDate: '2026-11-14', doneBy: 'u2' })],
    subtasks: [pmSubtaskSchema.parse({ id: 's1', taskId: 'P9|01-01', text: '화면 목록 정리', assigneeId: 'u2', createdBy: 'u1', createdDate: '2026-11-13', done: true, doneDate: '2026-11-15' }),
      pmSubtaskSchema.parse({ id: 's2', taskId: 'P2|5.24', text: '옛 업무 작업', createdBy: 'u1', createdDate: '2026-11-01', legacyKey: 'P2|5.24' })],
    today: '2026-11-25',
    nameOf: (id) => names[id] ?? '',
  };
}

test('활동 기록 (activityAll): 기록마다 한 줄 · 데모 글자 · 최근 순', () => {
  const L = activityAll(inputs());
  const line = (cat: string, txt: string) => L.find((x) => x.cat === cat && x.txt === txt);
  assert.deepEqual(line('업무 목록', '01-01 수정 — 종료일 11/30 → 12/5')?.go, { kind: 'task', id: 'P9|01-01' });
  assert.equal(line('업무 목록', '기준선 — 기준선 저장')?.go, null);
  assert.equal(line('티켓', 'T-001 요구사항 정의서 작성 지원 요청 — 발행')?.who, 'system');
  assert.ok(line('티켓', 'T-001 요구사항 정의서 작성 지원 요청 — 댓글'));
  assert.ok(line('점검 결과', '중간보고서(사업비 사용실적 포함) 등록 · 중간점검 — 보완 · 보고서 보완'));
  // 지난 기한 정리로 체크한 것은 정리한 날에, 글자에 완료한 날
  assert.equal(line('관리기준', '착수계 · 기업부담금 납부 · 이행보증보험 제출 완료 체크 (지난 기한 정리 · 완료한 날 7/10)')?.d, '2026-11-02');
  assert.ok(line('보완 지적', '사업비 사용실적 누락 — 조치 완료 · 첨부함'));
  assert.ok(line('계획서 약속', 'd1 완료 체크'), '계획서가 없으면 약속 id 그대로');
  assert.deepEqual(line('협약변경', '구축기간 연장 · 신청함 · 1개월')?.go, { kind: 'view', v: 'dash/site', params: { k: 'P9' } });
  assert.deepEqual(line('주간 특이사항', '현장 설치 완료 / 협조 요청: 네트워크 개방')?.go, { kind: 'view', v: 'doc/check', params: { k: 'P9' } });
  assert.equal(line('수주', "선정 결과 '선정'")?.d, '2026-06-20');
  assert.ok(line('진행률', '01-01 요구사항 정의서 작성 — 변동 없음 확인'));
  assert.ok(line('산출물', '요구사항 정의서 — 제출완료 · 정의서.pdf'));
  assert.equal(line('이슈', 'I-001 설비 통신 끊김 등록 (높음)')?.d, '2026-11-11');
  assert.equal(line('CR', 'CR-001 승인')?.who, 'u2');
  assert.ok(line('CR', 'CR-001 불량 보고서 추가 접수'));
  assert.deepEqual(line('회의록', '주간 회의 작성')?.go, { kind: 'view', v: 'doc/meet', params: { mt: 'm1' } });
  assert.ok(line('액션 아이템', '회선 신청 등록 → 김철수'));
  assert.equal(line('액션 아이템', '회선 신청 완료')?.who, 'u2');
  assert.ok(line('세부 작업', '화면 목록 정리 추가 → 김철수'));
  assert.equal(line('세부 작업', '화면 목록 정리 완료')?.who, 'u2');
  const legacy = line('세부 작업', '옛 업무 작업 추가');
  assert.equal(legacy?.k, '');
  assert.equal(legacy?.go, null);
  assert.equal(L.length, 22);
  assert.deepEqual(L.map((x) => x.d), [...L.map((x) => x.d)].sort().reverse(), '최근 순');
});

test('활동 기록: 세부 작업 완료 = 완료 체크한 사람 · 액션 담당 빔 = 미지정 · 같은 날은 데모 순서', () => {
  const X = inputs();
  const q = pmProjectSchema.parse({ id: 'P8', company: '둘째', biz: '정부일반형', start: '2026-07-01', end: '2027-03-31' });
  const D = '2026-11-24';
  const L = activityAll({
    ...X,
    projects: [X.projects[0], q],
    logs: [], tickets: [], weekChecks: [], docs: [], issues: [], crs: [], meetings: [], reports: [],
    gov: [pmGovRecordSchema.parse({ id: 'P9|g_mid', projectId: 'P9', itemId: 'g_mid', v: '적합', date: D, by: 'u1' }),
      pmGovRecordSchema.parse({ id: 'P8|g_mid', projectId: 'P8', itemId: 'g_mid', v: '적합', date: D, by: 'u1' })],
    planChecks: [pmPlanCheckSchema.parse({ id: 'P9|d1', projectId: 'P9', dutyId: 'd1', date: D, by: 'u1' }),
      pmPlanCheckSchema.parse({ id: 'P8|d1', projectId: 'P8', dutyId: 'd1', date: D, by: 'u1' })],
    agreements: [pmAgreementChangeSchema.parse({ id: 'a1', projectId: 'P9', date: D, kind: 'ext', st: '신청함', by: 'u1' }),
      pmAgreementChangeSchema.parse({ id: 'a2', projectId: 'P8', date: D, kind: 'ext', st: '신청함', by: 'u1' })],
    actions: [pmActionSchema.parse({ id: 'x2', projectId: 'P9', text: '담당 빈 일', by: 'u1', at: '2026-11-12' })],
    subtasks: [
      pmSubtaskSchema.parse({ id: 's1', taskId: 'P9|01-01', text: '남이 맡은 일', assigneeId: 'u2', createdBy: 'u2', createdDate: '2026-11-13', done: true, doneDate: '2026-11-15', doneBy: 'u1' }),
      pmSubtaskSchema.parse({ id: 's3', taskId: 'P9|01-01', text: '담당 없는 일', createdBy: 'u2', createdDate: '2026-11-13', done: true, doneDate: '2026-11-15', doneBy: 'u1' }),
      pmSubtaskSchema.parse({ id: 's4', taskId: 'P9|01-01', text: '예전 완료', assigneeId: 'u2', createdBy: 'u2', createdDate: '2026-11-13', done: true, doneDate: '2026-11-15' }),
    ],
  });
  const line = (txt: string) => L.find((x) => x.cat === '세부 작업' && x.txt === txt);
  assert.equal(line('남이 맡은 일 완료')?.who, 'u1', '담당(u2)이 아니라 체크한 사람');
  assert.equal(line('담당 없는 일 완료')?.who, 'u1');
  assert.equal(line('예전 완료 완료')?.who, 'u2', '완료한 사람 기록이 없으면 담당');
  assert.ok(L.some((x) => x.cat === '액션 아이템' && x.txt === '담당 빈 일 등록 → 미지정'));
  // 같은 날: 점검(모든 사업) → 약속(모든 사업) → 사업마다 협약변경 (데모 activityAll 순)
  assert.deepEqual(L.filter((x) => x.d === D).map((x) => `${x.cat}:${x.k}`), ['점검 결과:P9', '점검 결과:P8', '계획서 약속:P9', '계획서 약속:P8', '협약변경:P9', '협약변경:P8']);
});

test('활동 기록 거르기 (pActLog): 기간 · 사람 · 사업 · 종류 · 검색', () => {
  const L = activityAll(inputs());
  const label = (id: string) => names[id] ?? '';
  const f = { per: '30', who: 'all', k: 'all', cat: 'all', q: '' } as const;
  // 11/25 기준 30일 = 10/26 부터
  assert.equal(actFilter(L, f, '2026-11-25', label, () => '테스트').length, L.filter((x) => x.d >= '2026-10-26').length);
  assert.equal(actFilter(L, { ...f, per: 'all' }, '2026-11-25', label, () => '').length, 22);
  assert.ok(actFilter(L, { ...f, per: 'all', who: 'u2' }, '2026-11-25', label, () => '').every((x) => x.who === 'u2'));
  assert.equal(actFilter(L, { ...f, per: 'all', k: 'P9' }, '2026-11-25', label, () => '').length, 21);
  assert.equal(actFilter(L, { ...f, per: 'all', cat: 'CR' }, '2026-11-25', label, () => '').length, 2);
  assert.equal(actFilter(L, { ...f, per: 'all', q: '김철수' }, '2026-11-25', label, () => '').length, L.filter((x) => x.who === 'u2' || x.txt.includes('김철수')).length);
  assert.equal(actFilter(L, { ...f, per: 'all', q: '신광' }, '2026-11-25', label, (k) => (k === 'P9' ? '신광' : '')).length, 21, '사업 이름으로도 찾음');
});
