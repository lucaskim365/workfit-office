import { approvalFormSchema, approvalFolderSchema, type ApprovalForm, type ApprovalFolder } from '@/domain/approvalForm/schema';
import { APPROVAL_FORM_SEED } from '@/data/seeds/approvalForm.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 결재서식 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * 문서 ID = form.id(=code). 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 3 · [[DB_이관_대비_설계원칙.md]] 원칙 1)
 */

// 목업/초기 폴더 시드 데이터
const INITIAL_FOLDER_SEED: ApprovalFolder[] = [
  { id: 'fld-hr', name: '인사', order: 1 },
  { id: 'fld-ga', name: '총무', order: 2 },
  { id: 'fld-req', name: '품의', order: 3 },
  { id: 'fld-cond', name: '경조사', order: 4 },
];

const backend = createCrudBackend<ApprovalForm>({
  coll: 'approvalForms',
  parse: (raw) => {
    const p = approvalFormSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse approvalForm:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: APPROVAL_FORM_SEED.map((x) => approvalFormSchema.parse(x)),
  jsonFields: ['fields'],
});

const folderBackend = createCrudBackend<ApprovalFolder>({
  coll: 'approvalFolders',
  parse: (raw) => {
    const p = approvalFolderSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse approvalFolder:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (f) => f.id,
  seed: INITIAL_FOLDER_SEED.map((x) => approvalFolderSchema.parse(x)),
});

const byOrder = (a: ApprovalForm, b: ApprovalForm) => a.order - b.order || a.name.localeCompare(b.name);
const byFolderOrder = (a: ApprovalFolder, b: ApprovalFolder) => a.order - b.order || a.name.localeCompare(b.name);

export const approvalFormRepo = {
  async list(): Promise<ApprovalForm[]> {
    const obsoleteFormIds = [
      '출장', '보험신청', '운반비청구', '공문발송', '접대비품의',
      '비용청구', '단체상해보험변경', '단체상해보험재가입', '화재보험', '자동차보험',
      '우편택배청구', '퀵서비스청구', '일반공문', '법률문서', '접대비내', '접대비초과',
      '식대', '회식비', '회의비', '교통비', '운반비'
    ];
    let list = await backend.loadAll();

    // 구 서식(obsolete) 삭제
    for (const obsId of obsoleteFormIds) {
      if (list.some((f) => f.id === obsId)) {
        await backend.remove(obsId);
        list = list.filter((f) => f.id !== obsId);
      }
    }

    return [...list].sort(byOrder);
  },

  async save(form: ApprovalForm): Promise<void> {
    await backend.save(approvalFormSchema.parse(form));
  },

  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },

  // --- 폴더(분류) CRUD 메서드 추가 ---
  async listFolders(): Promise<ApprovalFolder[]> {
    const list = await folderBackend.loadAll();

    // 인사, 총무, 품의, 경조사 폴더 유실 방지 및 자동 복구
    for (const f of INITIAL_FOLDER_SEED) {
      if (!list.some((ex) => ex.id === f.id)) {
        await folderBackend.save(f);
        list.push(f);
      }
    }
    return [...list].sort(byFolderOrder);
  },

  async saveFolder(folder: ApprovalFolder): Promise<void> {
    await folderBackend.save(approvalFolderSchema.parse(folder));
  },

  async removeFolder(folderId: string): Promise<void> {
    // 1. 폴더 삭제
    await folderBackend.remove(folderId);

    // 2. 해당 폴더 아래에 있던 서식들을 루트(null)로 구출
    const forms = await this.list();
    const childForms = forms.filter((f) => f.folderId === folderId);
    for (const form of childForms) {
      form.folderId = null;
      await this.save(form);
    }
  }
};
