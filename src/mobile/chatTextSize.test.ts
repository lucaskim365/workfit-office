import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatTextScaleStyle, parseChatTextSize } from './chatTextSize';

test('저장값이 없거나 모르는 값이면 보통', () => {
  assert.equal(parseChatTextSize(null), 'normal');
  assert.equal(parseChatTextSize('huge'), 'normal');
  assert.equal(parseChatTextSize('large'), 'large');
  assert.equal(parseChatTextSize('xlarge'), 'xlarge');
});

test('단계별 배율 변수', () => {
  assert.deepEqual(chatTextScaleStyle('normal'), { '--chat-text-scale': '1' });
  assert.deepEqual(chatTextScaleStyle('large'), { '--chat-text-scale': '1.2' });
  assert.deepEqual(chatTextScaleStyle('xlarge'), { '--chat-text-scale': '1.4' });
});
