import assert from 'node:assert/strict';
import test from 'node:test';
import { draftableForms, draftCatalogForms } from './schema';

const form = (code: string, active = true) => ({ id: code, code, active });

test('기안 화면은 취소신청서를 포함한 활성 서식을 모두 쓴다 — 취소 기안이 서식을 찾아야 한다', () => {
  const rows = [form('기안'), form('취소신청'), form('휴가', false)];
  assert.deepEqual(draftableForms(rows).map((f) => f.code), ['기안', '취소신청']);
});

test('서식 선택 목록에서는 취소신청서를 뺀다 — 기존 문서 취소 전용 서식이다', () => {
  const rows = [form('기안'), form('취소신청'), form('휴가', false)];
  assert.deepEqual(draftCatalogForms(rows).map((f) => f.code), ['기안']);
});


test('휴일근무 서식이 켜져 있으면 연장근로는 목록에서만 빠지고 기안은 그대로 찾는다', () => {
  const rows = [form('기안'), form('연장근로'), form('휴일근무')];
  assert.deepEqual(draftCatalogForms(rows).map((f) => f.code), ['기안', '휴일근무']);
  assert.deepEqual(draftableForms(rows).map((f) => f.code), ['기안', '연장근로', '휴일근무']);
});

test('휴일근무 서식이 없거나 꺼져 있으면 연장근로는 목록에 남는다', () => {
  assert.deepEqual(draftCatalogForms([form('연장근로')]).map((f) => f.code), ['연장근로']);
  assert.deepEqual(draftCatalogForms([form('연장근로'), form('휴일근무', false)]).map((f) => f.code), ['연장근로']);
});
