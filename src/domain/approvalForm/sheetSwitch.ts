import { z } from 'zod';

/*
  시트 적용 스위치 — 기존 서식(항목 목록이 있는 서식)에 시트 틀을 붙인 뒤, 기안을 시트로 받을지(켜짐) 기존 양식으로 받을지(꺼짐).
  서식 기록(approvalForms)은 읽기 전용이라 여기(approvalSheetSwitches, 새 컬렉션)에 따로 둔다.
  스위치가 없으면: 기존 서식은 꺼짐(붙이는 중인 틀이 기안자에게 보이지 않게), 처음부터 시트로 만든 서식은 켜짐.
*/

export const approvalSheetSwitchSchema = z.object({
  formId: z.string().min(1),
  applied: z.boolean(),
  updatedBy: z.string().default(''),
  updatedByName: z.string().nullable().optional(),
  updatedAt: z.string().default(''),
});
export type ApprovalSheetSwitch = z.infer<typeof approvalSheetSwitchSchema>;

/** 기존 양식이 있는 서식(항목 목록이 있음) — 시트를 붙였어도 옛 문서는 이 항목으로 보인다 */
export const hasLegacyFields = (form: { fields?: unknown[] | null } | null | undefined) => (form?.fields?.length ?? 0) > 0;

/** 이 서식의 기안을 시트로 받는가 */
export function sheetApplied(form: { id: string; fields?: unknown[] | null }, switches: ReadonlyMap<string, boolean>): boolean {
  const s = switches.get(form.id);
  return s ?? !hasLegacyFields(form);
}

/**
 * 기안에 쓸 시트 버전 — 시트가 적용된 서식의 최신 버전, 아니면 null(기존 양식으로 기안).
 * 이미 시트로 쓰던 문서(임시 저장 등)는 그 문서의 버전을 따로 쓴다(이 함수 밖).
 */
export function liveSheetVersion(
  form: { id: string; fields?: unknown[] | null },
  latest: ReadonlyMap<string, number>,
  switches: ReadonlyMap<string, boolean>,
): number | null {
  const v = latest.get(form.id);
  if (v === undefined) return null;
  return sheetApplied(form, switches) ? v : null;
}
