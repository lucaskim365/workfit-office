import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalFormRepo } from '@/data/approvalForm/approvalForm.repo';
import { approvalFormVersionRepo } from '@/data/approvalForm/approvalFormVersion.repo';
import { approvalSheetSwitchRepo } from '@/data/approvalForm/approvalSheetSwitch.repo';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { checkNewVersion, latestVersions, type ApprovalFormVersion } from '@/domain/approvalForm/sheetVersion';
import type { Sheet } from '@/lib/sheet';

/**
 * 시트 서식 버전 훅 — 결재서식 관리(서식 편집기)용.
 * 시트 서식 = 버전이 1개 이상인 서식. 버전 틀은 크므로 머리 목록과 틀 한 벌을 따로 읽는다.
 */
const KEY = 'approvalFormVersions';
const FORMS_KEY = 'approvalForms';

/** 시트 서식별 최신 버전 번호 — 목록 배지·편집기 고르기 */
export function useSheetFormVersions() {
  const q = useQuery({ queryKey: [KEY, 'heads'], queryFn: () => approvalFormVersionRepo.listHeads() });
  const latest = useMemo(() => latestVersions(q.data ?? []), [q.data]);
  return { ...q, latest };
}

/** 시트 적용 스위치 — 서식 id → 켜짐(시트로 기안)/꺼짐(기존 양식으로 기안). 없는 서식은 기본값(sheetApplied) */
export function useSheetSwitches() {
  const q = useQuery({ queryKey: [KEY, 'switches'], queryFn: () => approvalSheetSwitchRepo.list() });
  const switches = useMemo(() => new Map((q.data ?? []).map((s) => [s.formId, s.applied])), [q.data]);
  return { ...q, switches };
}

/** 시트 적용 켜고 끄기 */
export function useSetSheetSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, applied, user }: { formId: string; applied: boolean; user: { id: string; name?: string } }) =>
      approvalSheetSwitchRepo.set(formId, applied, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'switches'] }),
  });
}

/** 한 서식의 버전 머리(최신 먼저) */
export function useFormVersionList(formId: string | null) {
  return useQuery({
    queryKey: [KEY, 'form', formId],
    queryFn: () => approvalFormVersionRepo.listForForm(formId!),
    enabled: !!formId,
  });
}

/** 버전 메모 고치기 — 그 버전을 저장한 사람만(틀은 그대로) */
export function useSetVersionNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, version, note, userId }: { formId: string; version: number; note: string; userId: string }) =>
      approvalFormVersionRepo.setNote(formId, version, note, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'form'] }),
  });
}

/** 서식 버전의 틀을 한 번 읽는다(훅을 쓸 수 없는 곳 — 단추를 눌렀을 때 등) */
export const fetchFormVersionSheet = async (formId: string, version: number) => (await approvalFormVersionRepo.get(formId, version))?.sheet ?? null;

/** 버전 틀 한 벌 — 저장된 버전의 틀은 바뀌지 않으므로 다시 읽지 않는다 */
export function useFormVersionSheet(formId: string | null, version: number | null) {
  return useQuery({
    queryKey: [KEY, 'sheet', formId, version],
    queryFn: () => approvalFormVersionRepo.get(formId!, version!),
    enabled: !!formId && !!version,
    staleTime: Infinity,
  });
}

export interface SaveSheetFormInput {
  form: ApprovalForm;
  sheet: Sheet;
  /** 지금 편집 중인 틀의 바탕 버전(새 서식이면 null) — 같은 틀이면 버전을 쌓지 않는다 */
  baseVersion: number | null;
  /** 대체 서식(연동 유형) — 없으면 null */
  link?: string | null;
  note?: string;
  user: { id: string; name?: string };
  /**
   * 서식 머리(approvalForms)도 저장할지 — 기본 저장. 기존 서식에 시트를 붙일 때는 틀만 저장하고,
   * 서식 설정을 바꿨을 때만 머리를 저장한다(그때도 기존 항목 목록은 그대로 — 옛 문서가 그 항목으로 보임)
   */
  saveHeader?: boolean;
}

export interface SaveSheetFormResult {
  /** 저장 뒤 최신 버전 */
  version: number;
  /** 새 버전을 쌓았는가(틀이 같으면 false — 서식 머리만 저장) */
  created: boolean;
}

/**
 * 시트 서식 저장 — 틀이 바뀌었으면 새 버전을 먼저 쌓고, 그 다음 서식 머리(approvalForms)를 저장한다.
 * 순서: 버전 → 머리. 머리 저장이 실패해도 버전은 남지만, 아무 문서도 가리키지 않는 버전이라 해가 없다.
 */
export function useSaveSheetForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ form, sheet, baseVersion, link = null, note, user, saveHeader = true }: SaveSheetFormInput): Promise<SaveSheetFormResult> => {
      const heads = await approvalFormVersionRepo.listForForm(form.id);
      const latestNo = heads[0]?.version ?? null;
      // 바탕 버전보다 새 버전이 생겼으면(다른 관리자가 저장) 덮어쓰지 않고 알린다
      if (latestNo !== null && baseVersion !== latestNo) {
        throw new Error(`다른 사람이 이 서식을 먼저 저장했습니다(v${latestNo}). 화면을 닫았다 다시 열어 최신 서식에서 고쳐 주세요.`);
      }
      const latest = latestNo !== null ? await approvalFormVersionRepo.get(form.id, latestNo) : null;
      const check = checkNewVersion(sheet, latest?.sheet, link, latest?.link ?? null);
      if (!check.ok) throw new Error(check.reason);

      let version = latestNo ?? 0;
      let created = false;
      if (!check.same) {
        const added: ApprovalFormVersion = await approvalFormVersionRepo.add({
          formId: form.id,
          sheet,
          note,
          link,
          createdBy: user.id,
          createdByName: user.name,
        });
        version = added.version;
        created = true;
      }
      if (saveHeader) await approvalFormRepo.save(form);
      return { version, created };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'heads'] });
      qc.invalidateQueries({ queryKey: [KEY, 'form'] });
      qc.invalidateQueries({ queryKey: [FORMS_KEY] });
    },
  });
}
