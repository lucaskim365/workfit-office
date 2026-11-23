import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOC_DRAFT_LIMIT, DOC_PAYLOAD_LIMIT, DOC_TOO_LARGE_MESSAGE, DOC_TOO_LARGE_TO_PROCESS_MESSAGE, assertDocSize } from './docSize';

test('문서 크기 한도 — 넘으면 알아볼 수 있는 말로 막는다', () => {
  assert.doesNotThrow(() => assertDocSize({ id: 'A', fieldValues: { __values: 'x'.repeat(1000) } }));
  // 결재 등 처리 중 — 처리하는 사람은 줄일 수 없으니 기안자에게 알리라고 한다
  assert.throws(() => assertDocSize({ id: 'A', fieldValues: { __sheet: 'x'.repeat(DOC_PAYLOAD_LIMIT) } }), new Error(DOC_TOO_LARGE_TO_PROCESS_MESSAGE));
});

test('작성 중 저장은 여유를 둔 한도 — 결재가 진행되며 문서가 커져도 저장되게', () => {
  assert.ok(DOC_DRAFT_LIMIT < DOC_PAYLOAD_LIMIT);
  const nearly = { fieldValues: { __sheet: 'x'.repeat(DOC_DRAFT_LIMIT) } };
  assert.doesNotThrow(() => assertDocSize(nearly));
  assert.throws(() => assertDocSize(nearly, DOC_DRAFT_LIMIT), new Error(DOC_TOO_LARGE_MESSAGE));
});
