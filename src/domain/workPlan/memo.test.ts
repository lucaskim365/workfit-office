import assert from 'node:assert/strict';
import test from 'node:test';
import { contentToMemo, memoToContent } from './memo';

test('예전 본문은 서식 없이, 태그 줄은 [태그] 접두, 빈 글은 null', () => {
  assert.equal(contentToMemo('- [x] **보고서** 제출\n\n[회의] 착수'), '보고서 제출\n[회의] 착수');
  assert.equal(contentToMemo('   '), null);
  assert.equal(contentToMemo(''), null);
});

test('메모를 저장했다 다시 읽으면 같은 글 — 할 일·서식처럼 보이는 글자도 그대로', () => {
  const memo = '- 견적서 회신\n[ ] 자료 요청\n* 별표 줄\n2**3 == 6\n[보고] 주간 보고\n{red} 글자';
  assert.equal(contentToMemo(memoToContent(memo)), memo);
});

test('저장 본문은 앞뒤 공백·빈 줄을 뺀다', () => {
  assert.equal(memoToContent('  첫 줄  \n\n  두 번째\n'), '첫 줄\n두 번째');
  assert.equal(memoToContent(' \n '), '');
});

test('예전 본문을 메모로 고쳐 저장하면 보이던 글이 그대로 남는다', () => {
  const legacy = '- [ ] [마감] ==계약서== 검토\n일반 줄\n__c__:0';
  const shown = contentToMemo(legacy)!;
  assert.equal(contentToMemo(memoToContent(shown)), shown);
});
