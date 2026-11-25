import assert from 'node:assert/strict';
import test from 'node:test';
import { PM_MENUS, resolvePmRoute, visibleMenus } from './menu';

test('데모 메뉴 6개를 같은 순서로 가진다', () => {
  assert.deepEqual(PM_MENUS.map((m) => m.label), [
    '대시보드', '업무 목록 · 티켓', '점검 · 요구사항 · 산출물', '이슈 · 회의 · 보고', '사업 · 손익', '기준정보',
  ]);
});

test('보기 id 는 전체에서 겹치지 않는다', () => {
  const ids = PM_MENUS.flatMap((m) => m.screens.flatMap((s) => (s.views ? s.views.map((v) => v.id) : [s.id])));
  assert.equal(new Set(ids).size, ids.length);
});

test('보기 id 로 메뉴·화면을 찾는다 (다른 주소의 보기도)', () => {
  const r = resolvePmRoute('sched/gantt');
  assert.equal(r.menu.id, 'task');
  assert.equal(r.screen.id, 'task/wbs');
  assert.equal(r.view, 'sched/gantt');
});

test('메뉴 id 만 오면 그 메뉴 첫 화면', () => {
  const r = resolvePmRoute('money');
  assert.equal(r.screen.id, 'money/site');
  assert.equal(r.view, 'money/site');
});

test('모르는 id·빈 값은 대시보드 첫 화면', () => {
  for (const v of ['nope/x', '', null, undefined]) {
    const r = resolvePmRoute(v);
    assert.equal(r.view, 'dash/overview');
  }
});

test('금액 화면(pm.manage 만): 권한 없으면 사업 · 손익 메뉴 통째로 · 기준정보의 지원 기준 · 품목 탭이 빠짐 (6-4)', () => {
  const ids = (money: boolean) => visibleMenus(money).flatMap((m) => m.screens.map((x) => x.id));
  assert.ok(!visibleMenus(false).some((m) => m.id === 'money'));
  assert.deepEqual(visibleMenus(false).find((m) => m.id === 'master')?.screens.map((x) => x.id), ['master/base', 'master/log']);
  for (const v of ['money/rules', 'money/items']) {
    assert.ok(ids(true).includes(v) && !ids(false).includes(v));
    assert.equal(resolvePmRoute(v).screen.money, true, '주소로 들어와도 PmScreen 이 막는 표시');
  }
});
