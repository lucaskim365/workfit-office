import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { routeConditionSources } from '@/domain/approvalForm/sheet/approvalSheet';
import type { Sheet } from '@/lib/sheet';

/** 결재선 규칙의 '선택 값 조건' 후보 — key 는 문서 값(fieldValues)의 키 */
export interface ConditionField {
  key: string;
  label: string;
  options: string[];
}

/**
 * 규칙 조건으로 고를 수 있는 항목 — 기존 양식의 '선택' 항목 + 그 서식 최신 시트의 이름 붙은 선택 칸.
 * 처음부터 시트로 만든 서식은 항목 목록이 비어 있어 시트에서만 나온다.
 * 기존 양식에 시트를 붙인 서식은 칸 이름이 항목 키와 같으므로 한 번만 넣는다(기존 항목이 먼저)
 */
export function routeConditionFields(form: Pick<ApprovalForm, 'fields'> | null | undefined, sheet: Sheet | null | undefined): ConditionField[] {
  const out: ConditionField[] = (form?.fields ?? [])
    .filter((f) => f.type === '선택')
    .map((f) => ({ key: f.key, label: f.label, options: f.options ?? [] }));
  if (sheet) {
    routeConditionSources(sheet).forEach((src) => {
      if (!out.some((f) => f.key === src.key)) out.push(src);
    });
  }
  return out;
}
