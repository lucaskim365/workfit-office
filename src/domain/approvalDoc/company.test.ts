import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docNoPrefixOf, isLumefabDoc, isLumefabForm, parseCompany } from './company';

test('문서번호 앞자리 — 루미팹 LF, 그 밖 AP', () => {
  assert.equal(docNoPrefixOf('lumefab'), 'LF');
  assert.equal(docNoPrefixOf(null), 'AP');
  assert.equal(docNoPrefixOf(undefined), 'AP');
});

test('주소의 company 값 — 아는 값만', () => {
  assert.equal(parseCompany('lumefab'), 'lumefab');
  assert.equal(parseCompany('x'), null);
  assert.equal(parseCompany(null), null);
});

test('루미팹 서식 — 코드나 이름으로', () => {
  assert.ok(isLumefabForm({ code: '지출결의', name: '아무개' }));
  assert.ok(isLumefabForm({ code: 'X1', name: '품의서' }));
  assert.ok(!isLumefabForm({ code: '휴가', name: '휴가신청서' }));
});

test('루미팹 문서 판별 — 기존 문서(company 없음)는 워크핏', () => {
  assert.ok(isLumefabDoc({ company: 'lumefab' }));
  assert.ok(!isLumefabDoc({}));
  assert.ok(!isLumefabDoc({ company: null }));
});
