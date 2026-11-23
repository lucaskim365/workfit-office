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
    // 저장소(컬렉션)가 아직 없으면 save 가 조용히 건너뛴다 — 켰다고 보이는데 실제로는 안 켜지는 일이 없게 다시 읽어 확인한다
    // loadAll 은 잠깐 동안 같은 읽기를 나눠 써서, 저장 전에 시작된 읽기 결과가 돌아올 수 있다 — 바로 읽는다
    const saved = (await backend.loadWithQueries([])).find((s) => s.formId === formId);
    if (saved?.applied !== applied) throw new Error('시트 적용 여부를 저장하지 못했습니다. 저장소가 준비되지 않았습니다 — 관리자에게 알려 주세요.');
    return row;
  },
};
