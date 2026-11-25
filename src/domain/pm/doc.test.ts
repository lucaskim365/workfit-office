import assert from 'node:assert/strict';
import test from 'node:test';
import { pmTaskSchema, type PmDoc, type PmTask } from './schema';
import { DOC_FILTER_DEFAULT, docDueTone, docFilter, docOf, docSummary, docTasks } from './doc';
import type { PmTicket } from './ticket';

/**
 * 산출물 규칙 (데모 pDoc · docOf) — 산출물 칸 · 날짜가 있는 **테스트용 작은 데이터** (§0.1-1).
 * 지금 내장 업무 목록엔 산출물 칸이 하나도 없어 화면은 0건 (데모도 같음, 4단계 확인).
 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask => pmTaskSchema.parse({ id: `P9|${o.code}`, projectId: 'P9', name: `업무 ${o.code}`, stage: '구축', ...o });
const doc = (id: string, st: PmDoc['st'], file = ''): PmDoc => ({ id: `P9|${id}`, projectId: 'P9', st, file, date: TODAY, by: 'me' });
const tk = (files: number): PmTicket => ({ no: 'P9-0001', files: Array.from({ length: files }, (_, i) => ({ name: `f${i}.pdf`, date: TODAY, by: 'me' })) } as unknown as PmTicket);

test('산출물 상태: 고른 기록 → 업무 티켓 파일이 있으면 작성중 → 미작성', () => {
  const t = T({ code: 'a', output: '설계서' });
  assert.deepEqual(docOf(t, new Map(), undefined), { st: '미작성', file: '', auto: true });
  assert.equal(docOf(t, new Map(), tk(1)).st, '작성중', '티켓에 파일 있음');
  assert.equal(docOf(t, new Map(), tk(0)).st, '미작성', '티켓은 있는데 파일 없음');
  const m = new Map([[t.id, doc('a', '제출완료', 'x.pdf')]]);
  const r = docOf(t, m, tk(1));
  assert.equal(r.st, '제출완료', '고른 기록이 티켓 파일보다 먼저');
  assert.equal(r.file, 'x.pdf');
  assert.equal(r.auto, false);
});

test('산출물 목록: 산출물 칸 있는 업무만 · 미제출 기본 · 단계 main(협약 이후) · 마일스톤 · 검색', () => {
  const ts = [
    T({ code: '01', output: '요구사항 정의서', stage: '분석' }),
    T({ code: '02', output: '화면 설계서', stage: '설계', milestone: true }),
    T({ code: '03', output: '착수계', stage: '협약 이전' }),
    T({ code: '04', output: '', stage: '설계' }), // 산출물 없음 — 목록에 없음
    T({ code: '05', output: '시험 결과서', stage: '시험' }),
  ];
  const all = docTasks(ts);
  assert.deepEqual(all.map((t) => t.code), ['01', '02', '03', '05']);
  const D = new Map([['P9|01', doc('01', '제출완료')], ['P9|05', doc('05', '작성중')]]);
  const st = (t: PmTask) => docOf(t, D).st;
  assert.deepEqual(docFilter(all, DOC_FILTER_DEFAULT, st).map((t) => t.code), ['02', '05'], '미제출 · 협약 이후');
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, st: 'all' }, st).map((t) => t.code), ['01', '02', '05']);
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, st: 'all', stage: 'all' }, st).map((t) => t.code), ['01', '02', '03', '05'], '단계 all = 협약 이전 포함');
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, st: 'all', stage: '협약 이전' }, st).map((t) => t.code), ['03']);
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, st: '작성중' }, st).map((t) => t.code), ['05']);
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, ms: true }, st).map((t) => t.code), ['02']);
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, st: 'all', q: '설계' }, st).map((t) => t.code), ['02'], '산출물 · 업무명 · 번호에서 찾음');
  assert.deepEqual(docFilter(all, { ...DOC_FILTER_DEFAULT, st: 'all', q: '05' }, st).map((t) => t.code), ['05']);

  // 위 숫자 · 단계 칸 = 전체 산출물 업무 기준 (협약 이전 포함 — 데모 그대로)
  const s = docSummary(all, st);
  assert.deepEqual([s.n, s.done, s.wip, s.none], [4, 1, 1, 2]);
  assert.deepEqual(s.stages, [{ name: '분석', n: 1, d: 1 }, { name: '설계', n: 1, d: 0 }, { name: '협약 이전', n: 1, d: 0 }, { name: '시험', n: 1, d: 0 }]);
});

test('산출물 마감 색: 미제출 · 7일 안 = 주의, 지남 = 위험, 제출 · 협약 이전 · 날짜 없음 = 없음', () => {
  assert.equal(docDueTone(T({ code: 'a', end: '2026-12-02' }), '미작성', TODAY), 'warn', '7일 남음');
  assert.equal(docDueTone(T({ code: 'a', end: '2026-12-03' }), '미작성', TODAY), '', '8일 남음');
  assert.equal(docDueTone(T({ code: 'a', end: '2026-11-24' }), '작성중', TODAY), 'bad');
  assert.equal(docDueTone(T({ code: 'a', end: '2026-11-24' }), '제출완료', TODAY), '');
  assert.equal(docDueTone(T({ code: 'a', end: '2026-11-24', stage: '협약 이전' }), '미작성', TODAY), '');
  assert.equal(docDueTone(T({ code: 'a' }), '미작성', TODAY), '');
});
