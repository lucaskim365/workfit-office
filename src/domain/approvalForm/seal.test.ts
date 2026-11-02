import assert from 'node:assert/strict';
import test from 'node:test';
import { stampTableShown } from './seal';

test('직인 서식 — 진행 중·반려·회수·시행반송에는 결재란, 결재가 끝난 완료·시행대기·취소완료에는 절대 숨김', () => {
  for (const s of ['임시저장', '진행중', '반려', '회수', '시행반송']) assert.equal(stampTableShown(s, true), true, s);
  for (const s of ['완료', '시행대기', '취소완료']) assert.equal(stampTableShown(s, true), false, s);
});

test('일반 서식 — 지금처럼 완료·시행대기·취소완료에만 결재란', () => {
  for (const s of ['완료', '시행대기', '취소완료']) assert.equal(stampTableShown(s, false), true, s);
  for (const s of ['진행중', '반려', '회수']) assert.equal(stampTableShown(s, false), false, s);
});
