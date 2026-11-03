import test from 'node:test';
import assert from 'node:assert/strict';
import { pageBreaks } from './pdf';

test('걸리는 블록이 없으면 한 장 높이마다 자른다', () => {
  assert.deepEqual(pageBreaks([], 0.4).map((b) => +b.toFixed(3)), [0.4, 0.8]);
  assert.deepEqual(pageBreaks([], 1.2), []); // 한 장에 다 들어감
});

test('표 행이 걸리면 그 행 위에서 자른다', () => {
  // 0.38~0.42 행이 첫 장 경계(0.4)에 걸림 → 0.38에서 자르고 다음 장은 0.38부터
  const cuts = pageBreaks([[0.1, 0.2], [0.38, 0.42], [0.42, 0.5]], 0.4);
  assert.equal(cuts[0], 0.38);
  assert.ok(Math.abs(cuts[1] - 0.78) < 1e-9);
});

test('한 장보다 큰 블록은 어쩔 수 없이 자른다(멈추지 않음)', () => {
  const cuts = pageBreaks([[0.05, 0.95]], 0.4);
  assert.deepEqual(cuts.map((b) => +b.toFixed(3)), [0.4, 0.8]);
});

test('표 전체(큰 블록) 안의 행 경계를 우선한다', () => {
  // 표(0.1~0.9)는 한 장보다 크지만 행 0.35~0.45가 걸리면 0.35에서 자른다
  const cuts = pageBreaks([[0.1, 0.9], [0.35, 0.45]], 0.4);
  assert.equal(cuts[0], 0.35);
});
