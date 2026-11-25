import assert from 'node:assert/strict';
import test from 'node:test';
import { pmProjectSchema, pmTaskSchema } from './schema';
import { alignPre, fitDays, makeTasks, nextProjectKey, prePast, projectCheck, type TplTask } from './master';

/** 기준정보 · 사업 등록 규칙 (데모 fitDays · applyTemplate · alignPre · siteForm validate) — 테스트용 작은 데이터 (§0.1-1) */
const tt = (code: string, off: number, dur: number, stage = '구축'): TplTask => ({ stage, code, name: `업무 ${code}`, output: '', assigneeIds: ['u1'], off, dur, milestone: false });

test('템플릿 일정 맞추기: 앞 90일은 그대로, 그 뒤는 협약 종료일까지 늘림 · 업무 만들기 (담당은 keepPeople 일 때만)', () => {
  const ts = [tt('1', 0, 10), tt('2', 80, 20), tt('3', 150, 30)]; // span = 179
  const f = fitDays(ts, '2027-01-01', '2027-12-31'); // D = 364, P = 90, 배율 (364-90)/(179-90) → 마지막 업무가 협약 종료일(+364)에 끝남
  assert.deepEqual(f.map((x) => [x.off, x.dur]), [[0, 10], [80, 39], [275, 90]]);
  assert.deepEqual(fitDays(ts, '2027-01-01', ''), ts, '종료일 없으면 그대로');
  const p = pmProjectSchema.parse({ id: 'P20', company: '테스트', start: '2027-01-01', end: '', pmName: '박명규 부장' });
  const made = makeTasks(p, ts, false);
  assert.deepEqual(made.map((t) => [t.id, t.start, t.end, t.assigneeIds.length, t.pmName]), [['P20|1', '2027-01-01', '2027-01-10', 0, '박명규 부장'], ['P20|2', '2027-03-22', '2027-04-10', 0, '박명규 부장'], ['P20|3', '2027-05-31', '2027-06-29', 0, '박명규 부장']]);
  assert.equal(makeTasks(p, ts, true)[0].assigneeIds[0], 'u1');
});

test('협약 이전 업무 날짜 맞추기 (alignPre): 뒤에서부터 협약일 전날로 붙이고, 신청 · 평가 업무는 공고 마감 · 선정평가일에 맞춤 / 지난 업무', () => {
  const p = pmProjectSchema.parse({ id: 'P9', company: '테스트', start: '2027-03-01', annDue: '2027-01-20', evalDate: '2027-02-10' });
  const T = (code: string, name: string, start: string, end: string) => pmTaskSchema.parse({ id: `P9|${code}`, projectId: 'P9', stage: '협약 이전', code, name, start, end });
  const ts = [T('0.1', '[제안] 사업계획서 작성', '2027-01-01', '2027-01-10'), T('0.2', '[제안] 온라인 신청·접수', '2027-01-11', '2027-01-12'), T('0.3', '[평가] 평가 발표·질의응답', '2027-01-15', '2027-01-15'), T('0.4', '[계약] 협약 체결', '2027-02-01', '2027-02-05')];
  const r = alignPre(p, ts, () => false);
  assert.deepEqual(r, [
    { id: 'P9|0.4', start: '2027-02-24', end: '2027-02-28' },
    { id: 'P9|0.3', start: '2027-02-10', end: '2027-02-10' },
    { id: 'P9|0.2', start: '2027-01-19', end: '2027-01-20' },
    { id: 'P9|0.1', start: '2027-01-09', end: '2027-01-18' },
  ]);
  assert.deepEqual(prePast(p, ts, () => false, '2027-01-13').map((t) => t.code), ['0.1', '0.2']);
});

test('사업 입력 확인 · 다음 사업키', () => {
  const v = { id: 'P14', company: '㈜테스트', biz: '정부일반형', start: '2027-01-01', end: '2027-09-30', bizRegNo: '', contactEmail: '', budget: 400000000, subsidy: 200000000 };
  assert.equal(projectCheck(v, true, () => false), null);
  assert.equal(projectCheck({ ...v, id: 'X1' }, true, () => false)?.[1], 'id');
  assert.equal(projectCheck(v, true, () => true)?.[0], '이미 사용 중인 사업키입니다');
  assert.equal(projectCheck({ ...v, end: '2026-12-31' }, true, () => false)?.[1], 'end');
  assert.equal(projectCheck({ ...v, bizRegNo: '12-3' }, true, () => false)?.[1], 'bizRegNo');
  assert.equal(projectCheck({ ...v, subsidy: 500000000 }, true, () => false)?.[1], 'subsidy');
  assert.equal(nextProjectKey([pmProjectSchema.parse({ id: 'P13', company: 'a' })], [pmTaskSchema.parse({ id: 'P15|1', projectId: 'P15', code: '1', name: 'x' })]), 'P16');
});

test('코드 지우기 막는 까닭 (codeDelBlock): 기본 상태 → 쓰는 중 → 단계 남음 → 표준 업무 남음, 통과해야 묻기', async () => {
  const { codeDelBlock } = await import('./masterLink');
  const code = (o: Record<string, unknown>) => ({ id: 'x', group: 'stage', name: '', track: '', biz: '', ord: 1, note: '', auto: false, ...o }) as Parameters<typeof codeDelBlock>[0];
  const biz = code({ id: 'b1', group: 'biz', name: 'A형' });
  const stg = code({ id: 's1', group: 'stage', name: '설계', biz: 'A형' });
  const st = code({ id: 't1', group: 'status', name: '완료' });
  const st2 = code({ id: 't2', group: 'status', name: '보류' });
  const prj = { id: 'P1', biz: 'A형' } as never;
  const task = { projectId: 'P1', stage: '설계', status: '보류', name: 'x' } as never;
  const std = { id: 'd1', biz: 'A형', stage: '설계', ord: 1, name: 'y' } as never;
  const S = { codes: [biz, stg, st, st2], tasks: [task], projects: [prj], stdTasks: [std] };
  assert.equal(codeDelBlock(st, S), '기본 상태는 지울 수 없습니다');
  assert.equal(codeDelBlock(st2, S), '업무 1건에서 쓰는 중이라 지울 수 없습니다');
  assert.equal(codeDelBlock(biz, S), '사업 1개에서 쓰는 중이라 지울 수 없습니다');
  assert.equal(codeDelBlock(biz, { ...S, projects: [] }), '이 사업구분의 단계를 먼저 지우세요');
  assert.equal(codeDelBlock(stg, { ...S, tasks: [] }), '이 단계의 표준 세부 업무 1개를 먼저 지우세요');
  assert.equal(codeDelBlock(stg, { ...S, tasks: [], stdTasks: [] }), '');
  assert.equal(codeDelBlock(st2, { ...S, tasks: [] }), '');
});
