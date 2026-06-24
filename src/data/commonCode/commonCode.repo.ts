import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { commonCodeSchema, groupCommonCodes, type CommonCode, type CodeGroup } from '@/domain/commonCode/schema';
import { COMMON_CODE_SEED } from '@/data/seeds/commonCode.seed';

/**
 * 공통코드 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * 문서 ID = `${groupCode}__${code}` (복합 PK). 미설정 시 seed degrade.
 */
const COLL = 'commonCodes';
const docId = (c: CommonCode) => `${c.groupCode}__${c.code}`;

let memory: CommonCode[] = COMMON_CODE_SEED.map((c) => commonCodeSchema.parse(c));

export const commonCodeRepo = {
  /** 전체 코드(flat). enum 소비자용. */
  async list(): Promise<CommonCode[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => commonCodeSchema.parse(d.data()));
    }
    return memory;
  },

  /** 특정 그룹의 사용중 코드만(enum 옵션 생성용). */
  async listByGroup(groupCode: string): Promise<CommonCode[]> {
    const rows = await this.list();
    return rows.filter((c) => c.groupCode === groupCode && c.use).sort((a, b) => a.order - b.order);
  },

  /** 그룹 뷰(화면 표시용). */
  async listGroups(): Promise<CodeGroup[]> {
    return groupCommonCodes(await this.list());
  },

  async save(code: CommonCode): Promise<void> {
    const valid = commonCodeSchema.parse(code);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, docId(valid)), valid);
      return;
    }
    const i = memory.findIndex((m) => m.groupCode === valid.groupCode && m.code === valid.code);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(groupCode: string, code: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, `${groupCode}__${code}`));
      return;
    }
    memory = memory.filter((m) => !(m.groupCode === groupCode && m.code === code));
  },
};
