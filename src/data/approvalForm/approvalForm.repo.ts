import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { approvalFormSchema, type ApprovalForm } from '@/domain/approvalForm/schema';
import { APPROVAL_FORM_SEED } from '@/data/seeds/approvalForm.seed';

/**
 * 결재서식 Repository — Firestore 'approvalForms' 접근 캡슐화(유일 계층).
 * 문서 ID = form.id(=code). Firebase 미설정 시 seed degrade.
 * ([[data-layer-pattern]] · [[DB_이관_대비_설계원칙.md]] 원칙 1)
 */
const COLL = 'approvalForms';

let memory: ApprovalForm[] = APPROVAL_FORM_SEED.map((x) => approvalFormSchema.parse(x));

const byOrder = (a: ApprovalForm, b: ApprovalForm) => a.order - b.order || a.name.localeCompare(b.name);

export const approvalFormRepo = {
  async list(): Promise<ApprovalForm[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const list = snap.docs.map((d) => approvalFormSchema.parse(d.data())).sort(byOrder);
      
      // 자동 마이그레이션 및 동기화: Firestore의 기본 서식(system: true) 필드가 코드 시드와 불일치 시 자동 동기화 및 강제 덮어쓰기
      for (const seedForm of APPROVAL_FORM_SEED.filter((f) => f.system)) {
        const dbForm = list.find((f) => f.id === seedForm.id);
        
        const isMismatched = !dbForm || 
          JSON.stringify(dbForm.fields) !== JSON.stringify(seedForm.fields) ||
          dbForm.name !== seedForm.name ||
          dbForm.docTitle !== seedForm.docTitle ||
          dbForm.closing !== seedForm.closing ||
          dbForm.icon !== seedForm.icon;

        if (isMismatched) {
          const valid = approvalFormSchema.parse(seedForm);
          await setDoc(doc(db, COLL, valid.id), valid);
          if (dbForm) {
            Object.assign(dbForm, seedForm);
          } else {
            list.push(valid);
          }
        }
      }
      return list;
    }
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
};
