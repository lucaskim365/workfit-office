import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, shortName, type Live } from '@/domain/pm/rules';
import { siteCtxOf, type SiteInputs } from '@/domain/pm/site';
import { myAlerts } from '@/domain/pm/alerts';
import { gsFind } from '@/domain/pm/search';
import { kpiDefs, kpiScore } from '@/domain/pm/kpi';
import { PM_MENUS } from '@/modules/gw/pm/menu';
import { SEED_BASE_DATE, seedPlans, seedProjects, seedTasks } from './seed';

/**
 * 3-7 확인 숫자 — 데모(같은 내장 데이터, 기록 0건)를 2026-11-25(수)에 띄워 `myAlerts()` · `gsFind()` · `kpiScore()` 로 직접 뽑은 값.
 * 사람 = 사업 PM 이름 (데모 S.me = '박명규' 등) — 여기선 이름을 사용자 ID 처럼 씀.
 */
const TODAY = '2026-11-25';
const tasks = seedTasks();
const projects = seedProjects();
const plans = seedPlans();
const liveMap = new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)]));
const X: SiteInputs = { tasks, liveMap, plans, gov: [], planChecks: [], govLinks: [], agreements: [], baselines: [], issues: [] };
const sites = projects.map((p) => siteCtxOf(p, X, TODAY)).filter((c) => c.ts.length || c.p.start);
const shortOf = (id: string) => { const p = projects.find((x) => x.id === id); return p ? shortName(p, projects) : id; };
const pmOf = (p: (typeof projects)[number]) => [p.pmName.split(/\s+/)[0]].filter(Boolean);
const alerts = (me: string) => myAlerts(me, {
  tasks, liveMap, projects, today: TODAY, logs: [], checks: [], tickets: [], baseDate: SEED_BASE_DATE, sitePm: () => '',
  subtasks: [], actions: [], issues: [], msOk: new Map(), updReq: [], sites, pmOf, shortOf, nameOf: (x) => x,
}).map((a) => `${a.lv}|${a.txt}`);

test('🔔 알림: 데모 myAlerts 와 같은 줄 (PM 3명)', () => {
  assert.deepEqual(alerts('박명규'), [
    'bad|계획서 약속 기한 경과 · 임박 4곳 — 신광 4 · 효광 1 · 효광(AI) 1 · 삼광 1 — 통합 사업 현황 표의 다음 기한',
    'bad|도입기업 챙길 일 4곳 — 신광 2 · 효광 2 · 효광(AI) 2 · 삼광 2 — 통합 사업 현황 표의 도입기업 칸',
  ]);
  assert.deepEqual(alerts('강윤석'), ["bad|만도 · 도입기업 챙길 일 2건 — 착수계 · 기업부담금 납부 · 이행보증보… — 사업 화면 '기한'"]);
  assert.deepEqual(alerts('엄찬호'), [
    "bad|꽃샘 · 계획서 약속 사항 기한 경과 4건 — 사업 화면 '기한'",
    'bad|도입기업 챙길 일 2곳 — 꽃샘 2 · 저스템 2 — 통합 사업 현황 표의 도입기업 칸',
  ]);
  assert.deepEqual(alerts('아무개'), []);
});

const screens = PM_MENUS.flatMap((m) => m.screens.filter((s) => !s.hidden).flatMap((s) =>
  [[s.id, s.label, m.label] as const, ...(s.views ?? []).filter((x) => x.id !== s.id).map((x) => [x.id, x.label, m.label] as const)]));
const find = (q: string) => gsFind(q, { today: TODAY, screens, projects, tasks, liveMap, tickets: [], issues: [], actions: [], people: [], shortOf, nameOf: (x) => x })
  .map((x) => `${x.grp}|${x.label}|${x.sub}`);

test('검색: 데모 gsFind 와 같은 결과', () => {
  assert.deepEqual(find('신광'), ['사업|신광 · 신광테크|부처협업형(산업보안) · PM 박명규', '업무 목록|신광 업무 목록 보기|안 끝난 업무 57건']);
  assert.deepEqual(find('일정'), ['하는 일|TASK 추가 · 일정 수정|바로 가기', '하는 일|원가 변경 · 대금 일정|바로 가기', '화면|일정 변동|업무 목록 · 티켓']);
  assert.deepEqual(find('SF26178367'), ['사업|신광 · 신광테크|부처협업형(산업보안) · PM 박명규'], '과제번호로 사업 찾기 (데모 hit(s.no))');
  assert.deepEqual(find('  '), []);
});

test('성과지표: 계획서 있는 사업 7개 × 지표 2개, 실측 전 (데모 kpiScore)', () => {
  const got = [...projects].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))).map((p) => `${p.id}:${kpiDefs(plans[p.id] ?? null, []).length}:${JSON.stringify(kpiScore(kpiDefs(plans[p.id] ?? null, []), []))}`);
  const want = ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13'].map((k) =>
    ['P4', 'P10', 'P11', 'P12', 'P13'].includes(k) ? `${k}:0:null` : `${k}:2:{"n":0,"total":2,"score":0}`);
  assert.deepEqual(got.filter((x) => !x.startsWith('P1:')), want);
});
