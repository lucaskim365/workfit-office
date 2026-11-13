import assert from 'node:assert/strict';
import test from 'node:test';
import { pickDeptHeadId } from './deptHead';

const rank: Record<string, number> = { 대표이사: 1, 상무이사: 3, 부장: 5, 위원회: 9, 사원: 8 };
const rankOf = (p: string) => rank[p] ?? 9;
const m = (id: string, position: string, jobTitle = '', isConcurrent = false) => ({ id, position, jobTitle, isConcurrent });

test('부서장 미지정 부서 — 직급 순 대체는 본직만, 겸직 임원이 남의 부서장이 되지 않는다', () => {
  // 기술경영전략위원회: 부위원장(본직) + 상무이사(겸직, 직책 없음)
  assert.equal(pickDeptHeadId([m('U019', '위원회', '팀원'), m('U003', '상무이사', '', true)], rankOf), 'U019');
});

test('겸직이라도 그 부서 직책이 팀장이면 부서장', () => {
  assert.equal(pickDeptHeadId([m('A', '사원'), m('B', '부장', '팀장', true)], rankOf), 'B');
});

test('직책 우선, 없으면 본직 중 직급 최상위, 본직이 없으면 없음', () => {
  assert.equal(pickDeptHeadId([m('A', '부장'), m('B', '사원', '팀장')], rankOf), 'B');
  assert.equal(pickDeptHeadId([m('A', '사원'), m('B', '부장')], rankOf), 'B');
  assert.equal(pickDeptHeadId([m('C', '상무이사', '', true)], rankOf), null);
  assert.equal(pickDeptHeadId([], rankOf), null);
});
