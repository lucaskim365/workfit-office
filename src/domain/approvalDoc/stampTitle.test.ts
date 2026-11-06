import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drafterTitleOf, stepTitleOf, titleOrPosition } from './stampTitle';

const NEW = { titleMode: 'jobTitle' };
const OLD = {};

test('직책이 있으면 직책, 없거나 팀원·임원이면 직급', () => {
  assert.equal(titleOrPosition('팀장', '과장'), '팀장');
  assert.equal(titleOrPosition('', '과장'), '과장');
  assert.equal(titleOrPosition('팀원', '사원'), '사원');
  assert.equal(titleOrPosition('임원', '상무'), '상무');
  assert.equal(titleOrPosition(null, null), '');
});

test('기존 문서 — 예전처럼 직급(지금 직책이 있어도)', () => {
  const person = { position: '과장', jobTitle: '팀장' };
  assert.equal(stepTitleOf(OLD, { approverPos: '대리' }, person), '대리');
  assert.equal(stepTitleOf(OLD, {}, person), '과장');
  assert.equal(drafterTitleOf({ drafterPos: '사원' }, person), '사원');
});

test('새 문서 — 승인한 칸은 승인 때 직책, 승인 전 칸은 지금 직책', () => {
  const person = { position: '부장', jobTitle: '본부장' };
  assert.equal(stepTitleOf(NEW, { approverPos: '과장', approverTitle: '팀장' }, person), '팀장');
  // 승인 때 직책이 없었으면(빈 값) 그때 직급 — 지금 직책으로 바뀌지 않는다
  assert.equal(stepTitleOf(NEW, { approverPos: '과장', approverTitle: '' }, person), '과장');
  assert.equal(stepTitleOf(NEW, {}, person), '본부장');
  assert.equal(stepTitleOf(NEW, {}, { position: '사원', jobTitle: '팀원' }), '사원');
  assert.equal(drafterTitleOf({ ...NEW, drafterPos: '대리', drafterTitle: '' }, person), '대리');
  assert.equal(drafterTitleOf(NEW, person), '본부장');
});
