import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsToast, DEFAULT_NOTIFICATION_PREFS, parseNotificationPrefs } from './schema';

test('설정 전이거나 값이 깨졌으면 모두 받는다', () => {
  assert.deepEqual(parseNotificationPrefs(''), DEFAULT_NOTIFICATION_PREFS);
  assert.deepEqual(parseNotificationPrefs(null), DEFAULT_NOTIFICATION_PREFS);
  assert.deepEqual(parseNotificationPrefs('{깨짐'), DEFAULT_NOTIFICATION_PREFS);
});

test('저장한 값만 끄고 나머지는 기본값이다', () => {
  assert.deepEqual(parseNotificationPrefs('{"chat":false}'), { mute: false, push: true, chat: false, approval: true });
});

test('토스트는 방해금지와 종류별 설정을 따르고 일정·시스템은 방해금지만 따른다', () => {
  const prefs = (patch: object) => ({ ...DEFAULT_NOTIFICATION_PREFS, ...patch });
  assert.equal(allowsToast(prefs({ mute: true }), '일정'), false);
  assert.equal(allowsToast(prefs({ chat: false }), '메신저'), false);
  assert.equal(allowsToast(prefs({ chat: false }), '결재'), true);
  assert.equal(allowsToast(prefs({ approval: false }), '결재'), false);
  assert.equal(allowsToast(prefs({ chat: false, approval: false }), '일정'), true);
  // 푸시를 꺼도 화면 안 토스트는 나온다
  assert.equal(allowsToast(prefs({ push: false }), '메신저'), true);
});
