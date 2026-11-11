import assert from 'node:assert/strict';
import test from 'node:test';
import { docTitleLook } from './docTitle';

test('짧은 제목은 넓게 띄운다', () => {
  assert.deepEqual(docTitleLook('기안서'), { text: '기안서', letterSpacing: '0.5em' });
  assert.deepEqual(docTitleLook('공문'), { text: '공문', letterSpacing: '0.5em' });
});

test('긴 제목은 조금만 띄운다', () => {
  assert.deepEqual(docTitleLook('법인카드 사용 내역서'), { text: '법인카드 사용 내역서', letterSpacing: '0.15em' });
});

test('글자는 입력한 그대로 — 글자마다 띄어 입력한 제목은 공백도 글자로 세어 넓게 벌리지 않는다', () => {
  assert.deepEqual(docTitleLook('기 안 서'), { text: '기 안 서', letterSpacing: '0.15em' });
  assert.deepEqual(docTitleLook('외 주 개 발 용 역 품 의 서'), { text: '외 주 개 발 용 역 품 의 서', letterSpacing: '0.15em' });
});
