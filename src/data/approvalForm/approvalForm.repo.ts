import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { approvalFormSchema, approvalFolderSchema, type ApprovalForm, type ApprovalFolder } from '@/domain/approvalForm/schema';
import { APPROVAL_FORM_SEED } from '@/data/seeds/approvalForm.seed';

/**
 * 결재서식 Repository — Firestore 'approvalForms' 접근 캡슐화(유일 계층).
 * 문서 ID = form.id(=code). Firebase 미설정 시 seed degrade.
 * ([[data-layer-pattern]] · [[DB_이관_대비_설계원칙.md]] 원칙 1)
 */
const COLL = 'approvalForms';
const COLL_FOLDERS = 'approvalFolders';

// 목업/초기 폴더 시드 데이터
const INITIAL_FOLDER_SEED: ApprovalFolder[] = [
  { id: 'fld-hr', name: '인사', order: 1 },
  { id: 'fld-ga', name: '총무', order: 2 },
  { id: 'fld-req', name: '품의', order: 3 },
  { id: 'fld-cond', name: '경조사', order: 4 },
];

let memory: ApprovalForm[] = APPROVAL_FORM_SEED.map((x) => approvalFormSchema.parse(x));
let memoryFolders: ApprovalFolder[] = INITIAL_FOLDER_SEED.map((x) => approvalFolderSchema.parse(x));



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
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      let list = snap.docs.map((d) => approvalFormSchema.parse(d.data()));
      
      // 구 서식(obsolete) 삭제
      for (const obsId of obsoleteFormIds) {
        if (list.some((f) => f.id === obsId)) {
          await deleteDoc(doc(db, COLL, obsId));
          list = list.filter((f) => f.id !== obsId);
        }
      }

      // 자동 마이그레이션 및 동기화: Firestore에 코드 시드의 서식들을 보급
      for (const seedForm of APPROVAL_FORM_SEED) {
        const dbForm = list.find((f) => f.id === seedForm.id);
        
        // 1. DB에 서식이 아예 존재하지 않으면 무조건 생성 (최초 보급)
        // 2. system: true 인 잠금 서식이고, 시드 파일 대비 내용 불일치 시 덮어쓰기
        const shouldWrite = !dbForm;

        if (shouldWrite) {
          const valid = approvalFormSchema.parse(seedForm);
          await setDoc(doc(db, COLL, valid.id), valid);
          if (dbForm) {
            Object.assign(dbForm, seedForm);
          } else {
            list.push(valid);
          }
        }
      }
      return list.sort(byOrder);
    }
    memory = memory.filter((m) => !obsoleteFormIds.includes(m.id));
    return [...memory].sort(byOrder);
  },

  async save(form: ApprovalForm): Promise<void> {
    const valid = approvalFormSchema.parse(form);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
  },

  // --- 폴더(분류) CRUD 메서드 추가 ---
  async listFolders(): Promise<ApprovalFolder[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL_FOLDERS));
      const list = snap.docs.map((d) => approvalFolderSchema.parse(d.data()));
      
      // 인사, 총무, 품의, 경조사 폴더 유실 방지 및 자동 복구
      for (const f of INITIAL_FOLDER_SEED) {
        if (!list.some((ex) => ex.id === f.id)) {
          await setDoc(doc(db, COLL_FOLDERS, f.id), f);
          list.push(f);
        }
      }
      return list.sort(byFolderOrder);
    }
    return [...memoryFolders].sort(byFolderOrder);
  },

  async saveFolder(folder: ApprovalFolder): Promise<void> {
    const valid = approvalFolderSchema.parse(folder);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL_FOLDERS, valid.id), valid);
      return;
    }
    const i = memoryFolders.findIndex((f) => f.id === valid.id);
    if (i >= 0) memoryFolders[i] = valid;
    else memoryFolders = [...memoryFolders, valid];
  },

  async removeFolder(folderId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      // 1. 폴더 삭제
      await deleteDoc(doc(db, COLL_FOLDERS, folderId));

      // 2. 해당 폴더 아래에 있던 서식들을 루트(null)로 구출
      const forms = await this.list();
      const childForms = forms.filter((f) => f.folderId === folderId);
      for (const form of childForms) {
        form.folderId = null;
        await this.save(form);
      }
      return;
    }
    // 메모리 모드 폴백
    memoryFolders = memoryFolders.filter((f) => f.id !== folderId);
    memory = memory.map((m) => m.folderId === folderId ? { ...m, folderId: null } : m);
  }
};
