import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsPush } from './prefs.js';

test('설정이 없거나 깨졌으면 보낸다', () => {
  assert.equal(allowsPush(undefined, '메신저'), true);
  assert.equal(allowsPush('', '결재'), true);
  assert.equal(allowsPush('{깨짐', '결재'), true);
});

test('방해금지·푸시 끔이면 종류와 상관없이 보내지 않는다', () => {
  assert.equal(allowsPush('{"mute":true}', '일정'), false);
  assert.equal(allowsPush('{"push":false}', '메신저'), false);
});

test('종류별 설정을 따르고 일정·시스템은 종류 설정과 무관하다', () => {
  const off = '{"chat":false,"approval":false}';
  assert.equal(allowsPush(off, '메신저'), false);
  assert.equal(allowsPush(off, '결재'), false);
  assert.equal(allowsPush(off, '일정'), true);
  assert.equal(allowsPush('{"chat":false}', '결재'), true);
});
