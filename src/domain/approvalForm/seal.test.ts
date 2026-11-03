import assert from 'node:assert/strict';
import test from 'node:test';
import { sealMarkIdOf, stampTableShown } from './seal';

test('직인 서식 — 진행 중·반려·회수·시행반송에는 결재란, 결재가 끝난 완료·시행대기·취소완료에는 절대 숨김', () => {
  for (const s of ['임시저장', '진행중', '반려', '회수', '시행반송']) assert.equal(stampTableShown(s, true), true, s);
  for (const s of ['완료', '시행대기', '취소완료']) assert.equal(stampTableShown(s, true), false, s);
});

test('일반 서식 — 지금처럼 완료·시행대기·취소완료에만 결재란', () => {
  for (const s of ['완료', '시행대기', '취소완료']) assert.equal(stampTableShown(s, false), true, s);
  for (const s of ['진행중', '반려', '회수']) assert.equal(stampTableShown(s, false), false, s);
});

test('sealMarkIdOf — 직인 칸·직인 표 칸 중 처음 고른 직인, 없으면 대표', () => {
  const F = (o: Record<string, unknown>) => o as never;
  assert.equal(sealMarkIdOf([F({ type: '텍스트', markId: 'MK-x' }), F({ type: '직인' })]), undefined);
  assert.equal(sealMarkIdOf([F({ type: '직인', markId: 'MK-a' })]), 'MK-a');
  assert.equal(sealMarkIdOf([F({ type: '표', placeholder: '{"cellStyles":{"0:0":{"seal":true}}}', markId: 'MK-t' }), F({ type: '직인', markId: 'MK-a' })]), 'MK-t');
});
