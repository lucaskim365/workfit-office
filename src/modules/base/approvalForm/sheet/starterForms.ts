/**
 * 기본 서식 묶음 — 새 시트 서식을 빈 시트 대신 흔히 쓰는 서식(휴가원·지출결의서·품의서 등)에서 시작한다.
 * 처음 이 그룹웨어를 받은 회사가 서식을 하나하나 그리지 않아도 되게(관리자가 다듬고 저장). 고르기만 해서는 아무것도 저장되지 않는다.
 * 바탕은 기본 서식 정의(APPROVAL_FORM_SEED)를 시트로 바꾼 것 — 휴가·외근·출장·휴일근무 연동 기능도 함께 고른 채로 연다.
 */
import { APPROVAL_FORM_SEED } from '@/data/seeds/approvalForm.seed';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { legacyFormToSheet, type LegacyConversion } from '@/modules/gw/approval/sheetForm/fromLegacyForm';

/** 시스템 서식(취소신청)·휴일근무로 바뀐 옛 연장근로는 빼고 */
const EXCLUDED = new Set(['연장근로']);
export const STARTER_FORMS: ApprovalForm[] = APPROVAL_FORM_SEED.filter((f) => !f.system && !EXCLUDED.has(f.code));

/**
 * 기본 서식에서 시작하는 새 서식 — 이름·격식 문서명·아이콘·맺음말·보존연한·머리 설정은 그 서식 것,
 * 코드는 비워 둔다(편집기가 서식명에서 저절로 정함 — 회사에 이미 같은 코드가 있어도 겹치지 않게)
 */
export function starterSheetForm(seed: ApprovalForm, blank: ApprovalForm): { form: ApprovalForm; draft: LegacyConversion } {
  const form: ApprovalForm = {
    ...blank,
    name: seed.name,
    docTitle: seed.docTitle,
    icon: seed.icon,
    closing: seed.closing,
    preservationPeriod: seed.preservationPeriod,
    hiddenHeaderItems: seed.hiddenHeaderItems ?? [],
    fields: [],
    // 다 다듬을 때까지 기안 목록에 안 나오게
    active: false,
  };
  return { form, draft: legacyFormToSheet(seed) };
}
