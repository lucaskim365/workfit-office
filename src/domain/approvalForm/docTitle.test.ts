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

test('예전처럼 글자마다 띄어 저장된 제목은 띄어쓰기를 걷어 낸다', () => {
  assert.deepEqual(docTitleLook('기 안 서'), { text: '기안서', letterSpacing: '0.5em' });
  assert.deepEqual(docTitleLook('법 인 카 드 사 용 내 역 서'), { text: '법인카드사용내역서', letterSpacing: '0.15em' });
});

test('보통 띄어쓰기가 있는 제목은 그대로', () => {
  assert.equal(docTitleLook('개인 경비 사용 신청서').text, '개인 경비 사용 신청서');
  assert.equal(docTitleLook('시외출장비(주유)').text, '시외출장비(주유)');
});
