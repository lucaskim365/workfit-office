import { createCrudBackend, DocumentExistsError, Query } from '@/data/_backend/crudBackend';
import {
  approvalFormVersionSchema,
  versionKey,
  type ApprovalFormVersion,
  type ApprovalFormVersionFull,
} from '@/domain/approvalForm/sheetVersion';
import type { Sheet } from '@/lib/sheet/core';

/**
 * 시트 서식 버전 Repository — approvalFormVersions 컬렉션(새 컬렉션, 기존 컬렉션과 분리).
 * 버전은 쌓기만 한다(insert). 틀을 고치거나 버전을 지우는 메서드를 두지 않는다 — 문서가 버전 틀 위에 값만 얹어 저장하므로
 * 이미 쓰인 버전이 바뀌면 결재된 문서 모양이 달라진다. 메모(note)만 저장한 사람이 고칠 수 있다(설명 글이라 문서 모양과 무관).
 */
const backend = createCrudBackend<ApprovalFormVersion>({
  coll: 'approvalFormVersions',
  parse: (raw) => {
    const p = approvalFormVersionSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse approvalFormVersion:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (v) => versionKey(v.formId, v.version),
  seed: [],
  jsonFields: ['sheet'],
});

/** 틀(sheet) 없이 읽을 칸 — 목록·배지용. 틀은 클 수 있어 필요한 버전만 따로 읽는다 */
const HEAD_FIELDS = ['formId', 'version', 'note', 'link', 'createdBy', 'createdByName', 'createdAt'];

const headOf = ({ sheet: _sheet, ...head }: ApprovalFormVersion): ApprovalFormVersion => head;
const byVersionDesc = (a: ApprovalFormVersion, b: ApprovalFormVersion) => b.version - a.version;

/** 동시에 저장해 번호가 겹치면 다시 매겨 시도하는 횟수 */
const INSERT_RETRY = 3;

export const approvalFormVersionRepo = {
  /** 모든 시트 서식의 버전 머리 — 어느 서식이 시트 서식인지 가리는 데 쓴다 */
  async listHeads(): Promise<ApprovalFormVersion[]> {
    const rows = await backend.loadWithQueries([Query.select(HEAD_FIELDS)]);
    return rows.map(headOf);
  },

  /** 한 서식의 버전 머리, 최신 먼저 */
  async listForForm(formId: string): Promise<ApprovalFormVersion[]> {
    const rows = await backend.loadWithQueries([Query.equal('formId', formId), Query.select(HEAD_FIELDS)]);
    return rows.filter((v) => v.formId === formId).map(headOf).sort(byVersionDesc);
  },

  /** 틀까지 읽기 — 없거나 틀이 깨졌으면 null */
  async get(formId: string, version: number): Promise<ApprovalFormVersionFull | null> {
    const rows = await backend.loadWithQueries([Query.equal('formId', formId), Query.equal('version', version), Query.limit(1)]);
    const hit = rows.find((v) => v.formId === formId && v.version === version);
    return hit?.sheet ? { ...hit, sheet: hit.sheet } : null;
  },

  /** 새 버전 쌓기 — 번호는 지금 최신 + 1. 다른 사람이 같은 번호를 먼저 쓰면 다시 매긴다 */
  async add(input: { formId: string; sheet: Sheet; note?: string; link?: string | null; createdBy: string; createdByName?: string }): Promise<ApprovalFormVersion> {
    for (let attempt = 0; ; attempt++) {
      const latest = (await this.listForForm(input.formId))[0]?.version ?? 0;
      const row: ApprovalFormVersion = {
        formId: input.formId,
        version: latest + 1,
        sheet: input.sheet,
        note: input.note?.slice(0, 255) || null,
        link: input.link || null,
        createdBy: input.createdBy,
        createdByName: input.createdByName ?? null,
        createdAt: new Date().toISOString(),
      };
      try {
        await backend.insert(row);
        return headOf(row);
      } catch (e) {
        if (e instanceof DocumentExistsError && attempt < INSERT_RETRY) continue;
        throw e;
      }
    }
  },

  /** 메모만 고치기 — 그 버전을 저장한 사람만. 틀·저장한 사람·시각은 건드리지 않는다 */
  async setNote(formId: string, version: number, note: string, userId: string): Promise<void> {
    const head = (await this.listForForm(formId)).find((v) => v.version === version);
    if (!head) throw new Error('버전을 찾지 못했습니다.');
    if (head.createdBy !== userId) throw new Error('메모는 그 버전을 저장한 사람만 고칠 수 있습니다.');
    await backend.patch(versionKey(formId, version), { note: note.trim().slice(0, 255) || null });
  },
};
