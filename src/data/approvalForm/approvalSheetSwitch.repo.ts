import { createCrudBackend } from '@/data/_backend/crudBackend';
import { approvalSheetSwitchSchema, type ApprovalSheetSwitch } from '@/domain/approvalForm/sheetSwitch';

/**
 * 시트 적용 스위치 Repository — approvalSheetSwitches 컬렉션(새 컬렉션). 서식마다 한 줄($id = formId).
 * 서식 기록(approvalForms)은 건드리지 않는다.
 */
const backend = createCrudBackend<ApprovalSheetSwitch>({
  coll: 'approvalSheetSwitches',
  parse: (raw) => {
    const p = approvalSheetSwitchSchema.safeParse(raw);
    return p.success ? p.data : null;
  },
  idOf: (s) => s.formId,
  seed: [],
});

export const approvalSheetSwitchRepo = {
  async list(): Promise<ApprovalSheetSwitch[]> {
    return backend.loadAll();
  },

  /** 켜고 끄기 — 서식마다 한 줄을 덮어쓴다 */
  async set(formId: string, applied: boolean, user: { id: string; name?: string }): Promise<ApprovalSheetSwitch> {
    const row: ApprovalSheetSwitch = { formId, applied, updatedBy: user.id, updatedByName: user.name ?? null, updatedAt: new Date().toISOString() };
    await backend.save(row);
    return row;
  },
};
