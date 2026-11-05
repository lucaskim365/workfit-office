import assert from 'node:assert/strict';
import test from 'node:test';
import { blankForm } from '../utils';
import { validateApprovalSheet, linkIssues } from '@/domain/approvalForm/sheet/approvalSheet';
import { repeatIssues } from '@/domain/approvalForm/sheet/repeatRows';
import { STARTER_FORMS, starterSheetForm } from './starterForms';

test('기본 서식 묶음 — 시스템·옛 연장근로 제외, 모두 바로 저장할 수 있는 시트로', () => {
  const codes = STARTER_FORMS.map((f) => f.code);
  assert.ok(codes.includes('휴가') && codes.includes('지출결의') && codes.includes('품의'));
  assert.ok(!codes.includes('연장근로') && !codes.includes('취소신청'));
  const blank = blankForm();
  for (const seed of STARTER_FORMS) {
    const { form, draft } = starterSheetForm(seed, blank);
    assert.equal(form.code, '', `${seed.name}: 코드는 편집기가 정함`);
    assert.equal(form.active, false);
    assert.deepEqual(form.fields, []);
    const errors = [...validateApprovalSheet(draft.sheet), ...repeatIssues(draft.sheet), ...linkIssues(draft.sheet, draft.link)];
    assert.deepEqual(errors, [], `${seed.name}: 저장 전 검사`);
  }
  assert.equal(starterSheetForm(STARTER_FORMS.find((f) => f.code === '휴가')!, blank).draft.link, '휴가');
});
