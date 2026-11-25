import assert from 'node:assert/strict';
import test from 'node:test';
import { pmChangeRequestSchema, pmTaskSchema, type PmChangeRequest } from './schema';
import { crConflict, crFlow, crList, crTaskPreset, nextCrId } from './cr';

/** 요구사항(CR) 규칙 (데모 siteCR · crForm · crReview · crToWbs) — 테스트용 작은 데이터 (§0.1-1). 오늘 = 2026-11-25 */
const TODAY = '2026-11-25';
const C = (o: Partial<PmChangeRequest> & { id: string }): PmChangeRequest => pmChangeRequestSchema.parse({ projectId: 'P9', title: o.id, ...o });

test('CR 번호: 가장 큰 번호 + 1, 세 자리 (지운 번호는 다시 안 씀)', () => {
  assert.equal(nextCrId([]), 'CR-001');
  assert.equal(nextCrId([C({ id: 'CR-002' }), C({ id: 'CR-010' })]), 'CR-011');
});

test('변경 장부: 사업 · 상태로 거르고 요청일 최근 순 / 흐름 숫자 · 누적 영향은 거르기와 상관없이 전체', () => {
  const L = [
    C({ id: 'CR-001', date: '2026-11-10', status: '승인', days: 5, cost: 300, taskId: 'P9|01' }),
    C({ id: 'CR-002', date: '2026-11-20', status: '승인', days: 3, cost: 1200 }),
    C({ id: 'CR-003', date: '2026-11-22', status: '반려', days: 30, cost: 5000 }),
    C({ id: 'CR-004', date: '2026-11-15', projectId: 'P3' }),
  ];
  assert.deepEqual(crList(L, 'all', 'all').map((c) => c.id), ['CR-003', 'CR-002', 'CR-004', 'CR-001']);
  assert.deepEqual(crList(L, 'P9', '승인').map((c) => c.id), ['CR-002', 'CR-001']);
  assert.deepEqual(crList(L, 'P3', 'all').map((c) => c.id), ['CR-004']);
  assert.deepEqual(crFlow(L), { n: { 검토중: 1, 승인: 2, 반려: 1 }, days: 8, cost: 1500, noTask: 1 }, '반려 영향은 안 셈');
});

test('마일스톤 충돌 위험: 남은 날 − 일정 영향 < 7 · 날짜 없는 마일스톤은 없음 / 업무 추가 미리 채움', () => {
  const m = pmTaskSchema.parse({ id: 'P9|m', projectId: 'P9', code: 'm', name: '구축 완료', end: '2026-12-10' }); // 15일 남음
  assert.equal(crConflict(m, 8, TODAY), false, '15 − 8 = 7');
  assert.equal(crConflict(m, 9, TODAY), true, '15 − 9 = 6');
  assert.equal(crConflict(null, 30, TODAY), false);
  assert.equal(crConflict({ ...m, end: '' }, 30, TODAY), false);
  assert.deepEqual(crTaskPreset(C({ id: 'CR-007', title: '바코드 추가', days: 10 }), TODAY), { name: '[CR-007] 바코드 추가', output: 'CR 반영 결과서', end: '2026-12-05' });
  assert.equal(crTaskPreset(C({ id: 'CR-008', days: 0 }), TODAY).end, '2026-12-02', '일정 영향 0 → 7일');
});
