import { z } from 'zod';
import { parseSheet, serializeSheet, type Sheet } from '@/lib/sheet';

/**
 * 시트 서식 버전 — 시트 서식의 틀(배치·병합·너비·서식·수식·칸 속성) 한 벌.
 * 서식을 저장할 때마다 새 버전을 쌓고, 이미 쌓인 버전은 고치지 않는다(문서가 그 위에 값만 얹으므로).
 * 서식 머리(이름·코드·폴더·권한)는 approvalForms 에 그대로 두고, 이 컬렉션은 시트 서식만 쓴다.
 * 시트 서식 = 버전이 1개 이상 있는 서식. 기존 서식은 버전이 없어 영향받지 않는다.
 * (docs/superpowers/specs/2026-10-21-sheet-approval-form-design.md §11.2)
 */

/** 버전 틀 JSON 최대 글자 수 — 컬렉션 sheet 속성 크기(appwrite-schema.ts)와 같게 */
export const SHEET_VERSION_MAX_CHARS = 1_000_000;

export const approvalFormVersionSchema = z.object({
  formId: z.string().min(1),
  version: z.number().int().min(1),
  /** 목록 조회(머리만)에서는 없다 */
  sheet: z
    .unknown()
    .transform((v) => (v == null ? undefined : (parseSheet(v) ?? undefined)))
    .optional(),
  /** 바꾼 내용 메모(예: '엑셀에서 불러옴: 발주서.xlsx') */
  note: z.string().nullable().optional(),
  createdBy: z.string(),
  createdByName: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type ApprovalFormVersion = z.infer<typeof approvalFormVersionSchema>;
/** 틀까지 있는 버전 */
export type ApprovalFormVersionFull = ApprovalFormVersion & { sheet: Sheet };

/** 버전 문서 키 — 문서 fieldValues.__formVersion 에도 이 값을 남긴다 */
export function versionKey(formId: string, version: number): string {
  return `${formId}@v${version}`;
}

/** 버전 키 → 서식·번호 (형식이 아니면 null) */
export function parseVersionKey(key: string): { formId: string; version: number } | null {
  const m = /^(.+)@v(\d+)$/.exec(key);
  return m ? { formId: m[1], version: Number(m[2]) } : null;
}

/** 서식별 최신 버전 번호 */
export function latestVersions(heads: Pick<ApprovalFormVersion, 'formId' | 'version'>[]): Map<string, number> {
  const out = new Map<string, number>();
  heads.forEach((h) => out.set(h.formId, Math.max(out.get(h.formId) ?? 0, h.version)));
  return out;
}

export type VersionCheck =
  | { ok: true; same: boolean; json: string }
  | { ok: false; reason: string };

/**
 * 저장 전 확인 — 틀 크기 한도, 직전 버전과 같은지.
 * 같으면 새 버전을 쌓지 않는다(서식 머리만 고친 저장이 버전을 늘리지 않게).
 */
export function checkNewVersion(sheet: Sheet, latest: Sheet | undefined): VersionCheck {
  const json = serializeSheet(sheet);
  if (json.length > SHEET_VERSION_MAX_CHARS) {
    const kb = Math.round(json.length / 1024);
    return { ok: false, reason: `서식이 너무 큽니다(${kb}KB, 최대 ${Math.round(SHEET_VERSION_MAX_CHARS / 1024)}KB). 빈 행·열이나 쓰지 않는 서식을 줄여 주세요.` };
  }
  return { ok: true, same: latest !== undefined && serializeSheet(latest) === json, json };
}
