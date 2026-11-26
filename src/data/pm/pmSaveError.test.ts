import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { createPmStore, isPmDbSaveError, isPmPartialSave, PmDbSaveError } from './pm.store';
import { reread, seededDb } from './pmTestStores';
import { isShownPmSaveError, pmSaveBusState, reportPmSaveError } from '@/features/pm/pmSaveBus';
import { PmConflictError } from './pmSync';

/**
 * 7-6 화면 공통 안내 — DB 저장 실패 종류 가르기 (설계 5.7.2 '중간에 실패하면' · 결정 (나)).
 * 공통 안내 · 새로 만드는 창 막기는 이 종류로만 움직임 → 메모리 모드 입력 검사 오류는 지금처럼 각 창이 보여 줌.
 */
const TODAY = '2026-11-25';
mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12) });

test('일부만 저장 = partial 표시가 붙은 DB 저장 실패 · 충돌 = DB 저장 실패(partial 아님) · 메모리 입력 검사 = 아님', async () => {
  // 일부만 저장 — 사업 삭제 도중 끊김
  const db = seededDb(TODAY);
  const s = createPmStore(TODAY, { db });
  await s.refresh();
  db.failAt(150);
  const e1 = await s.removeProject('P2', 'u1').then(() => null, (e: unknown) => e);
  assert.ok(isPmDbSaveError(e1) && isPmPartialSave(e1));
  assert.match((e1 as Error).message, /일부만 저장됐습니다/);

  // 충돌 — B 가 먼저 고친 업무를 A 가 옛 화면에서 고침
  const db2 = seededDb(TODAY);
  const A = createPmStore(TODAY, { db: db2 });
  const B = createPmStore(TODAY, { db: db2 });
  await A.refresh(); await B.refresh();
  const t = (await A.snapshot()).tasks[0];
  await B.updateTask(t.id, { ...t, name: 'B 가 먼저' }, 'u2');
  const e2 = await A.updateTask(t.id, { ...t, name: 'A 가 나중' }, 'u1').then(() => null, (e: unknown) => e);
  assert.ok(isPmDbSaveError(e2) && !isPmPartialSave(e2));
  assert.equal((await reread(db2, TODAY)).tasks.find((x) => x.id === t.id)?.name, 'B 가 먼저');

  // 메모리 모드 입력 검사 오류 (이미 쓰는 사업키) — 공통 안내 대상 아님
  const m = createPmStore(TODAY);
  const p = (await m.snapshot()).projects[0];
  const e3 = await m.addProject({ ...p }, 'none', false, 'u1').then(() => null, (e: unknown) => e);
  assert.ok(e3 instanceof Error, '메모리판도 같은 사업키는 막음');
  assert.equal(isPmDbSaveError(e3), false);
});

test('공통 안내 모음: DB 저장 실패만 받고, 일부만 저장 횟수를 셈 (새로 만드는 창 막기 기준)', () => {
  const plain = new Error('입력 검사');
  reportPmSaveError(plain);
  assert.equal(isShownPmSaveError(plain), false, '메모리 입력 검사 오류는 안 받음 → 콘솔 · 창 표시 그대로');
  assert.equal(pmSaveBusState().last, null);
  const n0 = pmSaveBusState().partials;
  const c = new PmConflictError();
  reportPmSaveError(c);
  assert.ok(isShownPmSaveError(c));
  assert.equal(pmSaveBusState().partials, n0, '충돌은 새로 만드는 창을 막지 않음');
  const pe = new PmDbSaveError('일부만', true);
  reportPmSaveError(pe);
  assert.equal(pmSaveBusState().partials, n0 + 1);
  assert.equal(pmSaveBusState().last?.partial, true);
});
