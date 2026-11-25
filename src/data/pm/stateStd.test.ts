import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { makeTasks, prePast, stdTplTasks, type Master } from '@/domain/pm/master';
import { isPre } from '@/domain/pm/site';
import { pmProjectSchema, type PmCode, type PmStdTask } from '@/domain/pm/schema';

/**
 * 7단계 전 확인용 (팀장 11/25): 실제 저장분 state.json 의 표준 업무(codes.task 823건, 옛 WBS 기준 · 날짜 있음)로 새 사업을 등록하면?
 * 지금 메모리 저장소는 내장 새 업무 목록으로 만든 178건(날짜 없음 → off 0 · dur 1)이라 결과가 다름 → 설계 7장 열린 질문 15.
 * 파일은 저장소 밖(C:\dev\pm-migration) — 없으면 건너뜀.
 */
const FILE = 'C:/dev/pm-migration/state-20261124.json';
type Raw = { biz: Array<{ id: string; name: string; track?: string }>; stage: Array<{ id: string; biz: string; name: string; ord: number }>; status: Array<{ id: string; name: string }>; task: Array<{ id: string; biz: string; stage: string; ord: number; wbs?: string; name: string; out?: string; off: number; dur: number; ms?: number; from?: string }> };
function masterFromState(C: Raw): Master {
  const code = (group: PmCode['group'], x: { id: string; name: string; track?: string; biz?: string; ord?: number }): PmCode => ({ id: x.id, group, name: x.name, track: x.track ?? '', biz: x.biz ?? '', ord: x.ord ?? 0, note: '', auto: true });
  const std: PmStdTask[] = C.task.map((t) => ({ id: t.id, biz: t.biz, stage: t.stage, ord: +t.ord || 0, code: t.wbs ?? '', name: t.name, output: t.out ?? '', off: +t.off || 0, dur: +t.dur || 1, milestone: !!t.ms, from: t.from ?? '' }));
  return { orgs: [], codes: [...C.biz.map((x) => code('biz', x)), ...C.stage.map((x) => code('stage', x)), ...C.status.map((x) => code('status', x))], stdTasks: std, templates: [] };
}

test('state.json 표준 업무(823건)로 부처협업형 사업 등록 → 151건 · 협약 이전은 협약일 앞 · 마지막 끝 = 협약 종료일 · 지난 협약 이전 업무 확인', { skip: !existsSync(FILE) && '저장소 밖 state.json 없음' }, () => {
  const C = (JSON.parse(readFileSync(FILE, 'utf8')) as { state: { codes: Raw } }).state.codes;
  const m = masterFromState(C);
  assert.equal(m.stdTasks.length, 823);
  const by = (b: string) => m.stdTasks.filter((t) => t.biz === b).length;
  assert.deepEqual([by('부처협업형(산업보안)'), by('자율형공장 (2025년)'), by('제조AI'), by('제조AI 특화 물류'), by('정부일반형'), by('AX공통솔루션'), by('AX단계별고도화')], [151, 44, 179, 179, 136, 68, 66]);
  const p = pmProjectSchema.parse({ id: 'P14', company: '㈜새회사', biz: '부처협업형(산업보안)', start: '2027-01-04', end: '2027-09-30', pmName: '박명규 부장' });
  const ts = makeTasks(p, stdTplTasks(m, p.biz), false);
  assert.equal(ts.length, 151);
  const pre = ts.filter(isPre);
  assert.ok(pre.length > 0 && pre.every((t) => t.start < p.start), '협약 이전 업무는 협약 시작일 앞 (off 음수)');
  assert.equal(pre.reduce((a, t) => (t.start < a ? t.start : a), '9'), '2026-11-05', '가장 이른 = 협약 60일 전');
  assert.equal(ts.reduce((a, t) => (t.end > a ? t.end : a), ''), p.end, 'fitDays 뒤 마지막 업무 종료 = 협약 종료일');
  // 오늘(11/25) 기준 이미 끝났어야 할 협약 이전 업무 → 등록 때 '이미 한 일이면 완료' 확인 창이 뜸
  assert.ok(prePast(p, ts, () => false, '2026-11-25').length > 0);
  // 비교: 지금 메모리 저장소(새 업무 목록 기준 178건)는 날짜가 없어 72건이 모두 협약 시작일 하루짜리
});
