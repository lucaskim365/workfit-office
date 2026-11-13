import assert from 'node:assert/strict';
import test from 'node:test';
import { managerLabel, pickDeptHeadId } from './deptHead';

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

test('직속 상급자 표시 — 부서장 없는 위원회 소속이면 이름 없이 위원장, 그 밖엔 이름(직급)', () => {
  const ceo = { name: '대표이사', position: '대표이사', jobTitle: '대표' };
  assert.equal(managerLabel({ deptName: '기술경영전략위원회', ownDeptHasOtherHead: false }, ceo), '위원장');
  assert.equal(managerLabel({ deptName: '기술경영전략위원회', ownDeptHasOtherHead: true }, { name: '홍길동', position: '이사', jobTitle: '' }), '홍길동 (이사)');
  assert.equal(managerLabel({ deptName: '경영기획팀', ownDeptHasOtherHead: false }, ceo), '대표이사 (대표이사)');
  assert.equal(managerLabel({ deptName: '개발팀', ownDeptHasOtherHead: true }, { name: '김팀장', position: '', jobTitle: '팀장' }), '김팀장 (팀장)');
  assert.equal(managerLabel({ deptName: '개발팀', ownDeptHasOtherHead: true }, null), '—');
});
