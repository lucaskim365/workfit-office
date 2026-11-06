import assert from 'node:assert/strict';
import test from 'node:test';
import { contentToMemo, memoLines, memoToContent, toggleMemoTask } from './memo';
import { contentToEditorDoc, editorDocToContent, parseInlineMarks } from './richText';

test('본문 → 메모: 서식·체크박스 표기를 그대로, 빈 글은 null', () => {
  assert.equal(contentToMemo('- [x] **보고서** 제출\n\n착수 %%회의%%'), '- [x] **보고서** 제출\n착수 %%회의%%');
  assert.equal(contentToMemo('   '), null);
  assert.equal(contentToMemo(''), null);
});

test('체크 메타(__c__)로만 남은 완료 상태도 - [x] 로 풀린다', () => {
  assert.equal(contentToMemo('- 견적\n- 회신\n__c__:1'), '- [ ] 견적\n- [x] 회신');
});

test('예전 글자만 메모(역슬래시로 막은 줄)는 일반 줄로 읽힌다', () => {
  const lines = memoLines('\\- 견적서 회신\n2\\*\\*3');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].task, null);
  assert.equal(lines[0].text, '- 견적서 회신');
  assert.equal(parseInlineMarks(lines[1].text).map((s) => s.text).join(''), '2**3');
});

test('메모 줄 — 체크박스 순번·태그', () => {
  const lines = memoLines('- [ ] [마감] 계약서\n일반\n- [x] 회신');
  assert.deepEqual(lines.map((l) => l.task), [{ index: 0, checked: false }, null, { index: 1, checked: true }]);
  assert.equal(lines[0].tag, '마감');
  assert.equal(lines[0].text, '계약서');
});

test('체크박스 뒤집기 — 그 줄만, 다른 서식은 그대로', () => {
  assert.equal(toggleMemoTask('- [ ] **가**\n일반\n- [x] 나', 0), '- [x] **가**\n일반\n- [x] 나');
  assert.equal(toggleMemoTask('- [ ] 가\n- [x] 나', 1), '- [ ] 가\n- [ ] 나');
});

test('기울임 표기 ↔ 편집기 왕복', () => {
  const content = '%%기울임%% **굵게** ~~줄~~';
  assert.equal(editorDocToContent(contentToEditorDoc(content)), content);
  assert.deepEqual(parseInlineMarks('%%가%%').map((s) => s.marks), [{ italic: true }]);
  assert.equal(parseInlineMarks('50%% 할인').map((s) => s.text).join(''), '50%% 할인');
});

test('저장 본문은 앞뒤 공백·빈 줄을 뺀다', () => {
  assert.equal(memoToContent('  첫 줄  \n\n  두 번째\n'), '첫 줄\n두 번째');
  assert.equal(memoToContent(' \n '), '');
});
